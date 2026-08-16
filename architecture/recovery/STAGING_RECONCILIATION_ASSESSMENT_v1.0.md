# Staging Historical Data Reconciliation — Pack 04 Assessment

**Pack:** STAGING HISTORICAL DATA RECONCILIATION PACK 04  
**Mode:** Tooling + dry-run (real staging `--execute` not performed in this Pack development task)

## Auth failure root cause

Pack 02 intentionally wrote **unusable** bcrypt hashes (`migration-reset-required-…`) and forced `emailVerificationStatus=pending` for the four historical Participants.

Login path requires:

1. matching password hash
2. then `emailVerificationStatus=verified` (otherwise `email_confirmation_required`)

Historical source hashes in `humanity_union_dev` are compatible **bcrypt `$2b$` cost 12** and accounts were `verified` there.

## Auth recovery strategy (approved)

**Option A:** At reconciliation `--execute`, restore password hashes **from source DB only** (never committed to Git) and restore `emailVerificationStatus=verified` for the four approved Participants. Never touch staging admin. No sessions/tokens copied.

## Engagement inventory (approved Initiatives only)

| Initiative | comments | commentReactions | analysisReactions | supportReg | supportVisitor | bookmarks | views |
|---|---:|---:|---:|---:|---:|---:|---:|
| CSS | 0 | 0 | 0 | 1 | 2 | 0 | 23 |
| Mind-Safe | 6 | 7 | 1 | 2 | 6 | 0 | 94 |
| Bridging NWD | 1 | 1 | 0 | 2 | 3 | 0 | 46 |
| AI Common Good | 0 | 0 | 0 | 1 | 2 | 0 | 13 |
| Isabella / HU platform | 3 | 4 | 0 | 3 | 2 | 1 | 20 |
| **Total** | **10** | **12** | **1** | **9** | **15** | **1** | **196** |

`participant_actions` scoped to approved Initiative IDs: **0** (excluded; do not import unscoped/legacy Activity-root ledger rows).

Legacy roots excluded: `activities`, `discussions`, `proposals`, `decisions`.

## Media UI

Mongo staging already stores approved R2 `imageUrl` / `coverMedia` for all five Initiatives; objects return HTTP 200. Live API public projection returns R2 URLs.

UI hardening:

- Reset `InitiativeImage` fallback when URL changes
- Reject localhost media URLs on staging/production Web hosts
- Pack 03 media execute now attempts Initiative Mongo hydrate after writes

## Statistics

- **proposals:** 3 migrated Improvement Proposals are all `draft` → platform statistic correctly counts **0** under submitted/accepted/partially_accepted/declined rule
- **authors:** Blog capability grants only — do not fabricate from Initiative stewardship
- **countries/regions:** participation-area / profile geography — Initiative metadata alone does not increment these counters

## Commands

- `pnpm reconcile:staging-historical-data` (dry-run default)
- `pnpm reconcile:staging-historical-data -- --execute` + `ALLOW_STAGING_RECONCILIATION=true`
- `pnpm verify:staging`
- Bundle: `architecture/recovery/staging-reconciliation-source-v1/`
