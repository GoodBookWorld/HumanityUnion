# MONGODB COLLECTION TOPOLOGY AUDIT v1.0

**Nature:** READ-ONLY infrastructure diagnosis  
**Date:** 2026-08-16  
**Branch:** `staging`  
**Triggering deploy checkpoint:** `be12c77` — ARCH: unify initiative lifecycle author workflow  
**Prior shell checkpoint:** `9de09fc`  
**Observed failure:** Render API deploy dies before bind — `MongoServerError: cannot create a new collection -- already using 500 collections of 500` in `ensureMongoIndexes` ← `bootstrapAuthPersistence` ← `apps/api/src/index.ts`  

**Constraints honored:** no Atlas writes/deletes; no persistence redesign; no Phase 05 commit/push/deploy.

---

## 1. Executive verdict

The Atlas **cluster-wide** shared-tier collection cap (500) is exhausted primarily by **leaked isolation databases** (`hu_test_*` and especially **`hu_verify_*`**), not by a runaway canonical schema.

Phase 04 added **exactly one** new canonical collection (`initiative_discussion_completions`). That new index bootstrap is the **immediate trigger** that tips an already-full cluster past 500 during staging API startup — it is not the root cause of the 500 occupancy.

**Atlas tier upgrade is NOT necessary** for the current canonical topology (~100 collections per environment DB). Headroom must be recovered by deleting abandoned test/verify databases, then preventing recurrence.

---

## 2. Why 500 collections?

| Fact | Evidence |
|------|----------|
| Limit scope | MongoDB Atlas **shared/Flex/M0-class** tiers enforce **500 collections per cluster** (sum across all databases), not per database |
| Startup creates collections | `collection.createIndex(...)` implicitly creates a collection if missing (`mongo-snapshot-store.ensureCollectionIndexes`) |
| Startup path | `index.ts` → `bootstrapAuthPersistence()` → `connectMongoClient()` → `ensureMongoIndexes()` loops **81** `MODULE_INDEXES` entries |
| Failure point | First `createIndex` that would create a **new** collection when cluster already at 500 |

Phase 04’s new index on `initiative_discussion_completions` is the most likely first new namespace after `be12c77` on staging.

---

## 3. Canonical repository topology (static, bounded)

| Metric | Count |
|--------|-------|
| `MONGO_COLLECTIONS` constants | **102** unique static names |
| `MODULE_INDEXES` (bootstrapped at startup) | **81** collections |
| Collections without startup index entry | **21** (created lazily on first write / module hydrate) |

Names are **statically bounded**. Production/staging application code does **not** generate random collection names.

Canonical environment DBs (ops model):

| Database | Classification |
|----------|----------------|
| `humanity_union_staging` | CANONICAL_STAGING |
| `humanity_union_dev` | CANONICAL_DEV |
| `humanity_union_production` | CANONICAL (separate cluster expected) |

---

## 4. Phase 04 collection delta (`9de09fc` → `be12c77`)

| Collection | Module | Canonical? | New in Phase 04? | Bootstrap |
|------------|--------|------------|------------------|-----------|
| `initiative_discussion_completions` | `initiative-discussion-lifecycle` mongo snapshot adapter | YES | **YES (only delta)** | Hydrate in `bootstrap-mongo-persistence`; index `{ initiativeId: 1 }` unique in `mongo-indexes` via `ensureMongoIndexes` |

Improvement Proposals: Phase 04 changed **non-prod default persistence** memory→file and added a **file** adapter. Mongo collection `initiative_improvement_proposals_collections` **already existed** before Phase 04 (not new). It is **not** in `MODULE_INDEXES` (lazy).

**Conclusion:** Phase 04 adds **+1** bootstrapped collection relative to `9de09fc`.

---

## 5. Exact failing bootstrap operation

```
apps/api/src/index.ts
  → bootstrapAuthPersistence()
    → ensureMongoIndexes()
      → ensureCollectionIndexes(collectionName, indexes)
        → collection.createIndex(...)  // creates collection if absent
```

When the cluster is already at 500, **any** missing indexed collection (here, typically the Phase 04 `initiative_discussion_completions`) fails create. Stack naming `ensureMongoCollectionIndexes` / `ensureMongoIndexes` / `bootstrapAuthPersistence` matches this path (driver may label the create step).

Port never opens because listen is after bootstrap.

---

## 6. Test / verify leakage — YES

### 6.1 `hu_test_*` (pnpm test)

| Behavior | Detail |
|----------|--------|
| Strategy | **One** DB per `pnpm test` run: `hu_test_<ts36>_<pid36>_<hex>` |
| Collection growth per run | Up to **~81** when tests call `ensureMongoIndexes` (same MODULE_INDEXES set) |
| Cleanup | Parent runner drops DB after suite unless `KEEP_TEST_DATABASE=1` or drop fails |
| Leak sources | Failed/timeout drop; `KEEP_TEST_DATABASE=1`; kill -9 before cleanup; Atlas already full so drop also fails |

Documented prior residue: `staging-data-migration-pack03-media.test.ts` already skips when Atlas collection limit / `hu_test_*` residue detected.

### 6.2 `hu_verify_*` (verify-*.ts scripts) — **major leak**

| Behavior | Detail |
|----------|--------|
| Isolation helper | `activateVerificationDatabaseIsolation()` builds unique `hu_verify_<sha16>` |
| Restore | `isolation.restore()` **only restores env vars** — **does not `dropDatabase`** |
| Scripts using it | ≥15 lifecycle/civic-archive verify scripts |
| Effect | Each verify run that calls `ensureMongoIndexes` can leave **~81 collections** permanently |

Only community-intelligence live verify scripts appear to explicitly `dropDatabase`. Lifecycle Part B–M verifies generally **do not**.

### 6.3 Theoretical growth

| Scenario | Collections |
|----------|-------------|
| Canonical staging alone | ~80–102 |
| + canonical dev on same cluster | ~160–204 |
| + **one** leaked verify/test DB | +~81 |
| + **4** leaked DBs | +~324 → near/over 500 with staging+dev |

**Likely source of exhaustion:** accumulated `hu_verify_*` / `hu_test_*` residue on the **same Atlas cluster** used by staging (and possibly local verify against staging URI). Confirmed by prior migration test skip messages.

---

## 7. Classification rubric (for operator listing)

| Category | Pattern / evidence |
|----------|-------------------|
| CANONICAL_STAGING | `humanity_union_staging` + names in `MONGO_COLLECTIONS` |
| CANONICAL_DEV | `humanity_union_dev` |
| TEST_LEAK | Abandoned `hu_test_*` DBs (not an active run) |
| VERIFY_LEAK | Abandoned `hu_verify_*` DBs (common) |
| LEGACY | Unknown DBs with Cap-02 Activity names only / obsolete projects |
| RECOVERY_TEMPORARY | Migration scratch DBs if any (should be rare; guards prefer staging) |
| UNKNOWN | Anything else — inspect before delete |

Do not classify solely by name when a DB is actively mid-test.

---

## 8. Ranked safe remediation

1. **A (immediate):** On RENDER API WEB SHELL, run read-only `pnpm --filter @hu/api inspect:mongo-topology` (or root `pnpm inspect:mongo-topology`). Identify abandoned `hu_test_*` / `hu_verify_*` DBs.
2. **A continued:** With explicit owner approval in a **separate** remediation task, `dropDatabase` **only** abandoned `hu_test_*` / `hu_verify_*` (never staging/dev/production). Prefer dropping whole DBs (removes all collections at once).
3. **B:** Remove any obsolete non-canonical DBs confirmed unused.
4. **D/E (prevention — Pack 01):** Implemented in `MONGODB_TEST_ISOLATION_HARDENING_PACK_01_REPORT_v1.0.md` — `hu_verify_*` dispose/drop, `hu_test_*` finally cleanup, protected-name contract, collection-pressure gate, permanent inspector.
5. **C:** Unnecessary for now — canonical set is already bounded (~102).
6. **F:** Atlas tier upgrade **not required** for legitimate canonical topology; only if product later needs >> hundreds of concurrent isolation DBs on one cluster (prefer separate test cluster instead).

**Remediation status (2026-08-16):** Owner-approved drop of five abandoned `hu_test_*` DBs completed (336 collections freed). Cluster returned to 164 collections; staging/dev unchanged. Phase 04 staging verification `PASS`. Prevention hardening: Pack 01.

---

## 9. Long-term prevention

See Pack 01 report for implemented prevention. Summary:

- Permanent `pnpm inspect:mongo-topology` (read-only).
- Collection-pressure gate before ephemeral DB creation (refuse ≥425 unless diagnostic override).
- `hu_verify_*` must `dispose()` / `cleanupDatabase()` — `restoreEnvironment()` is env-only.
- `hu_test_*` owned cleanup in `finally` unless `KEEP_TEST_DATABASE=1`.
- No automatic wildcard historical cleanup.

---

## 10. Phase 05 protection

| Question | Answer |
|----------|--------|
| Phase 05 unstaged locally? | YES — keep local |
| Adds new `MONGO_COLLECTIONS`? | **NO** (journey uses existing ledger/domain stores) |
| Safe to leave uncommitted while remediating Atlas? | **YES** |
| Deploy Phase 05 now? | **NO** — staging API cannot start until headroom restored |
| Commit/push Phase 05 in this audit? | **NO** |

---

## 11. Operator read-only command

**Location: RENDER API WEB SHELL**

```bash
cd ~/project/src   # or the Render API service root that contains apps/api
pnpm --filter @hu/api inspect:mongo-topology
```

If the script is not yet on the deployed commit, paste-equivalent one-liner is still possible via `mongosh` **read-only** (operator-owned). Prefer the script after merge of the inspector-only commit, or run from a laptop with the staging URI (never print URI).

Outputs: DB names, collection counts, `hu_test_*`/`hu_verify_*` totals, collection name lists for `humanity_union_staging` and `humanity_union_dev`. No secrets/docs.

---

## 12. Files created/modified (this audit)

| Path | Change |
|------|--------|
| `architecture/recovery/MONGODB_COLLECTION_TOPOLOGY_AUDIT_v1.0.md` | Created (this report) |
| `apps/api/src/scripts/inspect-mongo-topology.ts` | Created (read-only) |
| `apps/api/package.json` | Added `inspect:mongo-topology` script |
| Continuity docs | Updated for blocking deploy issue |

---

## 13. Continuity note

**INFRASTRUCTURE INCIDENT RESOLVED OPERATIONALLY** (approved test-DB cleanup + Phase 04 staging verify PASS).

**Prevention:** Mongo Test Isolation Hardening Pack 01 (see companion report).

**NEXT PRODUCT ACTION:** finalize/commit/deploy Lifecycle Finalization Phase 05 (still local/unstaged as of Pack 01).

---

## 14. Confirmation

- READ ONLY diagnosis (inspector reads metadata only)
- NO ATLAS DELETE in this task
- NO DATABASE WRITE
- NO COMMIT / NO PUSH / NO DEPLOY of Phase 05
- Phase 05 remains local unstaged/uncommitted as found
