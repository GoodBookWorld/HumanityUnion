# MONGODB TEST ISOLATION HARDENING PACK 01 REPORT v1.0

**Date:** 2026-08-16  
**Branch:** `staging`  
**Nature:** Prevention hardening for ephemeral Mongo test/verification databases  
**Constraints:** No Atlas deletes; no staging/dev writes; no migration; no R2; no commit/push/deploy; Phase 05 business files untouched

---

## 1. Verdict

Pack 01 makes it structurally difficult to leak `hu_test_*` / `hu_verify_*` databases into the shared Atlas cluster again.

Root leak mechanisms addressed:

1. **`hu_verify_*`:** `restore()` restored env only and never called `dropDatabase`.
2. **`hu_test_*`:** cleanup existed but lacked pressure gating, staging on the forbidden list, post-drop verification, and guaranteed `finally` on spawn throw.
3. **No early warning** before creating another ~81-collection ephemeral DB when the cluster was already near the 500 limit.

Operational incident (500/500) was already remediated by owner-approved drops; this pack is prevention only.

---

## 2. Protected database contract

Central module: `apps/api/src/infrastructure/mongodb/ephemeral-mongo-database-safety.ts`

Never drop via automated cleanup:

- `humanity_union_staging`
- `humanity_union_dev`
- `humanity_union_production` / `humanity_union` / system DBs
- any non-ephemeral `MONGODB_DATABASE` from env

Drop path requires:

- exact run-owned name match
- `hu_test_*` or `hu_verify_*` pattern for the declared kind
- fail-closed otherwise

No wildcard / historical bulk cleanup command exists.

---

## 3. `hu_test_*` cleanup contract

Strategy: **A — isolated DB + guaranteed cleanup**

- `run-tests-recursively.ts` generates one owned DB per `pnpm test` run
- collection-pressure gate before create
- cleanup in `finally` (pass, fail, or spawn throw)
- `KEEP_TEST_DATABASE=1` — diagnostic preserve only
- drop verifies absence when possible; cleanup failure logged loudly without overriding test exit code

---

## 4. `hu_verify_*` cleanup contract

Strategy: **A — isolated DB + guaranteed cleanup**

Lifecycle:

```
isolation = await activateVerificationDatabaseIsolationAsync(...)
try { run verification }
finally { await isolation.dispose() }  // cleanupDatabase + restoreEnvironment
```

- `restoreEnvironment()` / deprecated `restore()` → **env only**
- `cleanupDatabase()` → owned `dropDatabase` (+ absence verify)
- `dispose()` → cleanup then env restore
- `finalizeVerificationResources()` disposes any still-active isolations (safety net)
- `KEEP_VERIFICATION_DATABASE=1` — diagnostic preserve only

---

## 5. Collection pressure thresholds

Configured against default cluster limit **500** (`DEFAULT_CLUSTER_COLLECTION_LIMIT`):

| Total collections | Level | Ephemeral create |
|-------------------|-------|------------------|
| &lt; 300 | OK | allow |
| 300–349 | INFO | allow |
| 350–424 | WARNING | allow |
| ≥ 425 | HIGH RISK | refuse unless `ALLOW_EPHEMERAL_DB_UNDER_HIGH_COLLECTION_PRESSURE=1` |

Guard applies only around ephemeral DB creation / verification tooling — not production/staging API startup.

---

## 6. Topology inspector

Permanent read-only command:

```bash
pnpm inspect:mongo-topology
# equivalent:
pnpm --filter @hu/api inspect:mongo-topology
```

Never prints URI/credentials/document contents. Never drops or writes.

---

## 7. Bounded DB strategy decision

| Family | Strategy |
|--------|----------|
| `pnpm test` (`hu_test_*`) | **A** unique per run + guaranteed finally cleanup |
| Lifecycle/civic-archive verify (`hu_verify_*`) | **A** unique per run + dispose/cleanup |
| Community-intelligence live packs | **A** (existing owned `hu_test_*` + explicit drop) |
| **C** unique DB without cleanup | **FORBIDDEN** |

Reusable shared test DB (**B**) deferred — not required once cleanup is guaranteed.

---

## 8. Phase 05 overlap

**NO** Phase 05 business behavior edits.

Touched infrastructure that was already local from the topology audit (`inspect-mongo-topology`, continuity docs, `apps/api/package.json` script) plus Pack 01 isolation/hardening files and verify-script isolation call sites.

---

## 9. Confirmation

- No Atlas delete in this pack
- No staging/dev document/collection modification
- No migration / R2 / deploy / commit / push
- Phase 05 remains unstaged
