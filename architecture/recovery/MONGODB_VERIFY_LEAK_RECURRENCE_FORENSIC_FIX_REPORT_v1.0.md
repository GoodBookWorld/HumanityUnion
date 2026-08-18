# Mongo Verify Leak Recurrence — Forensic Fix Report

**Date:** 2026-08-17  
**Scope:** Forensic proof + root-cause fix for two leaked `hu_verify_*` databases after Phase 05A deploy / `verify:staging`.  
**Constraints honored:** No Phase 06; no live `verify:initiative-lifecycle`; no Atlas drops executed; no staging/dev mutation; no commit/push/deploy.

---

## Verdict

| # | Question | Answer |
|---|----------|--------|
| 1 | Creator of `hu_verify_3934665e1d5c34be` | Local `pnpm verify:initiative-lifecycle` (golden3 log) — Phase 05A golden-path verifier |
| 2 | Creator of `hu_verify_5ff83866d10afecc` | Local `pnpm verify:initiative-lifecycle` (golden2 log, fingerprint match) — same family |
| 3 | Did deploy/startup create either? | **NO** |
| 4 | Did `verify:staging` create either? | **NO** |
| 5 | Cleanup escape path | Fire-and-forget `createMongoSnapshotPersistence.save()` rejection → Node unhandledRejection/uncaughtException → process abort **before** `finally { await isolation.dispose() }` |
| 6 | Root fix | Capture persist errors inside `save()`; emergency dispose hooks in `runVerificationScript`; reconnect settle flush |
| 7 | Regression test | `apps/api/test/unit/infrastructure/verification-leak-recurrence.test.ts` |
| 8 | Is `verify:initiative-lifecycle` safe after fix? | **Yes** for this leak class (dispose runs even when background persist fails). Do not re-run live against Atlas until operator cleans the two leaked DBs and collection pressure is reviewed. |

---

## 1. Timeline reconstruction

Known clean state: `hu_verify_* = 0`, total ≈ 165.

Observed operator sequence after Phase 05A (`c042a69`):

1. Deploy on Render → API/Web Live  
2. `pnpm verify:staging -- --check-media-http` → PASS  
3. `pnpm inspect:mongo-topology` → two `hu_verify_*` present  

**Deploy/startup:** Dockerfile `CMD ["node", "dist/index.js"]`. No verify isolation in build/start. Staging boot uses `humanity_union_staging` only.

**`verify:staging`:** Connects to `APPROVED_TARGET_DATABASE` (`humanity_union_staging`). Never calls `activateVerificationDatabaseIsolation*`.

**Actual creators:** Local Phase 05A golden-path runs against the shared Atlas URI (same cluster as staging), immediately before/around deploy:

| Log | Time (local) | Outcome | DB |
|-----|--------------|---------|-----|
| `/tmp/hu-lifecycle-golden2.log` | ~21:35 | Crash at revision persistence checkpoint (`MongoDB client is not connected` in background `persistSnapshot`) — **no dispose** | `hu_verify_5ff83866d10afecc` (fingerprint) |
| `/tmp/hu-lifecycle-golden3.log` | ~21:39 | STANDARD PASS → PUBLIC_CHOICE crash `E11000` on `hu_verify_3934665e1d5c34be.initiative_discussion_completions` — **no dispose** | **proven** `hu_verify_3934665e1d5c34be` |
| `/tmp/hu-lifecycle-golden4.log` | ~21:44 | PASS + dispose `hu_verify_1a7bce85dec46550` | disposed |

Coincidence with `verify:staging` is temporal correlation, not causation.

---

## 2. Creator / caller matrix (`hu_verify_`)

| Creator | File | Function | Command | Cleanup | Escape risks |
|---------|------|----------|---------|---------|--------------|
| Isolation helper | `verification-database-isolation.ts` | `activateVerificationDatabaseIsolation(Async)` | all verify scripts using isolation | `cleanupDatabase` / `dispose` / `disposeActiveVerificationIsolations` | Historical: `restore()` env-only (Pack 01 fixed callers) |
| Golden lifecycle | `verify-initiative-lifecycle.ts` | `main` via `runVerificationScript` | `pnpm verify:initiative-lifecycle` | `finally → isolation.dispose()` + finalize | **THIS INCIDENT:** unhandled rejection from fire-and-forget persist bypassed finally |
| Stage e2e family | `verify-initiative-lifecycle-*-e2e.ts` | various | matching pnpm scripts | mostly `dispose()` in finally | Same persist escape if they disconnect mid-write |
| Civic archive verify | `verify-civic-archive-*.ts` | various | matching pnpm scripts | `dispose()` | Same class if using mongo snapshot + disconnect |
| Test runner | test isolation helpers | `hu_test_*` (not verify) | unit/integration | Pack 01 finally | N/A for these two DBs |

**Not creators:** `verify-staging.ts`, API `index`/Dockerfile boot, production bootstrap.

`KEEP_VERIFICATION_DATABASE` was **not** set in the investigated environment (unset / not in `.env`).

---

## 3. Collection fingerprints (READ-ONLY)

### `hu_verify_3934665e1d5c34be` — 94 collections

Includes late STANDARD lifecycle lazies: civic archive versions/drafts, commitment/tracking/official-response packages, public impact reports, decision session drafts, etc.

**Family:** `verify:initiative-lifecycle` after full STANDARD Archive path (matches golden3).

### `hu_verify_5ff83866d10afecc` — 81 collections

Exactly MODULE_INDEXES-scale set. **Missing** the 13 late-stage package/archive collections present in the 94-DB.

**Family:** `verify:initiative-lifecycle` mid-STANDARD (revision checkpoint) — matches golden2 crash before petition/archive packages.

---

## 4–6. Hardening audit + root cause

Pack 01 contract (`try → verify → finally → await dispose()`) was present in `verify-initiative-lifecycle.ts`, but:

1. `createMongoSnapshotPersistence.save()` queued async `persistSnapshot` **without a terminal `.catch()`**.
2. Persistence checkpoint disconnected Mongo while a late write could still run → `MongoDB client is not connected`.
3. Separately, E11000 on unique index became an unhandled rejection.
4. Node 24 default unhandled-rejection → fatal path → **`finally` dispose skipped**.

`verify:staging` and deploy are clean.

---

## 7. Root fix (implemented, not deployed)

1. **`create-mongo-snapshot-persistence.ts`** — terminal `.catch` stores `lastPersistError`; `flush()` rethrows. No unhandledRejection from `save()`.
2. **`verification-script-lifecycle.ts`** — emergency dispose on `unhandledRejection` / `uncaughtException` for any still-active owned isolation.
3. **`verify-initiative-lifecycle.ts`** — extra `setImmediate` + flush before disconnect; log owned DB name.

Invariant restored: completed verification command process must dispose owned `hu_verify_*` whether the verification path passes or fails (including background persist failure).

---

## 8. Regression test

`apps/api/test/unit/infrastructure/verification-leak-recurrence.test.ts`

- Asserts `save()` failure does not emit `unhandledRejection`
- Replays golden-path caller pattern: late persist fail → throw → `dispose()` still drops owned DB
- Asserts leftover active isolations are disposed by finalize path

---

## 9. Operator cleanup plan (DO NOT EXECUTE YET)

**Allowlist only (exact names):**

- `hu_verify_3934665e1d5c34be`
- `hu_verify_5ff83866d10afecc`

**Protected (never drop):**

- `humanity_union_staging`
- `humanity_union_dev`

Reuse `dropOwnedEphemeralDatabase` / guarded exact-name safety (Pack 01). Example operator plan after owner approval:

```bash
# LOCAL MAC TERMINAL or RENDER API WEB SHELL — after explicit owner approval only
# Pseudocode: drop ONLY the two exact names via guarded helper; refuse protected names.
```

A disposable `/tmp` script patterned on prior approved `hu_test_*` cleanup is preferred over wildcard deletes. **This report does not execute deletion.**

---

## 10. Quality / safety confirmations

| Gate | Result |
|------|--------|
| Focused leak regression + Pack 01 tests | **24 pass / 0 fail** |
| `tsc --noEmit` (API) | **pass** |
| ESLint touched paths | **pass** |
| `pnpm run build` (API) | **pass** |
| `git diff --check` | **pass** |
| `KEEP_VERIFICATION_DATABASE` | **unset** |
| STAGED | **0** |
| Atlas drop executed | **NO** |
| Push / deploy | **NO** |
| Live `verify:initiative-lifecycle` re-run | **NO** (deferred until cleanup + pressure review) |

Operator allowlist cleanup script (dry-run by default; not executed):  
`architecture/recovery/OPERATOR_CLEANUP_PLAN_hu_verify_leaks_2026-08-17.mjs.plan.txt`
