# Staging Data Migration Execution Plan v1.0

**Pack:** STAGING DATA MIGRATION PACK 02  
**Mode:** Controlled import (script defaults to DRY RUN)  
**Target:** `humanity_union_staging`  
**Source identity:** `humanity_union_dev`  
**Source Initiatives:** `apps/api/.runtime/*.json` (file persistence)

---

## Decisions locked from Pack 01 approval

| Decision | Value |
|---|---|
| Historical Vlad Gmail | **SEPARATE_PARTICIPANT** — do not merge with staging-admin Vlad HUWS |
| Display name "Vlad" | Not an identity key |
| Isabella Initiative | **In scope** (`initiative-1785948978037`) — REQUIRES_TRANSFORM file→Mongo |
| Bootstrap Initiative | Retain `initiative-bootstrap-001`; do not delete in Pack 02 |
| Legacy Activity/Discussion/Proposal/Decision | **Excluded** |

Expected after successful migration:

- ~5 Participants (staging admin + 4 historical)
- 5 historical Initiatives (+ retained bootstrap)

---

## Exact migration order

1. Validate Pack 01 manifest + Pack 02 decisions.
2. Enforce database pair guards (`humanity_union_dev` → `humanity_union_staging`).
3. DRY RUN plan (default): classify create / skip / transform / conflict.
4. On `--execute` only (after dual guards): write pre-migration snapshot to gitignored runtime path.
5. Import Participants (auth shell → member → profile → membership).
6. Import Initiatives (preserve IDs + stewardMemberId).
7. Import related artifacts in ancestry order:
   - analyses → improvement proposals → version revisions → petition drafts
8. Post-assert staging admin unchanged (userId, memberId, email, role, passwordHash).
9. Verify counts and stewardship.

---

## Source → target mapping

| Entity | Source | Target collection |
|---|---|---|
| Auth shells | `humanity_union_dev.auth_users` | `humanity_union_staging.auth_users` |
| Members | `humanity_union_dev.members` (or synthesized) | `humanity_union_staging.members` |
| Profiles | `humanity_union_dev.member_profiles` (or synthesized) | `humanity_union_staging.member_profiles` |
| Memberships | `humanity_union_dev.memberships` (allow-listed only) | `humanity_union_staging.memberships` |
| Initiatives | **Pack 02A portable bundle** `architecture/recovery/staging-data-source-v1/` | `humanity_union_staging.initiatives` |
| Analyses / proposals / revisions / petition drafts | same portable bundle | matching Mongo collections |

Pack 02A: Render and local execution **must not** depend on `apps/api/.runtime`. The portable bundle is version-controlled and checksum-validated.

---

## Identity mapping

| Key | memberId | Classification |
|---|---|---|
| historical_vlad_gmail | `a5e65d2f-3be7-4f8f-acd9-87c68027d662` | SEPARATE_PARTICIPANT |
| michael | `9cde6a4e-0fda-4132-8e7e-78432b864231` | SAFE_TO_MIGRATE_WITH_AUTH_RESET |
| derek | `57696395-199d-48b2-bbeb-bc30d2a1ba6c` | SAFE_TO_MIGRATE_WITH_AUTH_RESET |
| isabella | `5bb8e373-c042-4786-a69c-0340301711d8` | SAFE_TO_MIGRATE_WITH_AUTH_RESET |

Collision priority: userId → memberId → normalized email → uniqueName. **Never displayName.**

---

## Initiative steward mapping

| Initiative | stewardMemberId |
|---|---|
| CSS | historical Vlad Gmail |
| Mind-Safe Alliance | historical Vlad Gmail |
| Bridging the "New World Disorder" | Michael |
| AI for the Common Good | Derek |
| Development of the Humanity Union platform (Isabella) | Isabella |

Historical Vlad-owned Initiatives must **not** reference staging-admin HUWS memberId.

---

## Auth strategy

- Copy auth account shell (IDs, email, displayName, timestamps).
- Replace `passwordHash` with a freshly generated unusable hash.
- Force `emailVerificationStatus=pending`.
- Demote accidental source `admin` role to `member` for historical imports.
- If `members` / `member_profiles` rows are missing in source (observed for historical Vlad + Michael), **synthesize** compatible Member/Profile records from the auth shell (`REQUIRES_TRANSFORM`) — do not abort.
- Do **not** migrate `auth_sessions`, refresh tokens, verification tokens, password-reset tokens, or JWTs.
- Staging admin auth row must remain byte-stable for identity + passwordHash.

---

## Collision / inconsistency handling

- Identical canonical identity already in target → skip (idempotent).
- Same ID/email with different linkage → **conflict / abort** (no silent overwrite).
- Partial auth-without-member inconsistencies → abort.

---

## Idempotency

- Insert-if-absent keyed by `userId`, `memberId`, `profile.userId`, `initiativeId` (`_id`), artifact IDs.
- Second execute creates zero duplicates when first run succeeded.

---

## Rollback strategy

1. Pre-migration snapshot at `apps/api/.runtime/recovery/STAGING_DATA_PRE_MIGRATION_SNAPSHOT_v1.0.json` (gitignored).
2. Preferred rollback: restore target from Mongo backup / snapshot taken before execute.
3. Do not attempt automated delete of migrated rows in Pack 02 tooling.
4. Source `humanity_union_dev` and `.runtime` files are never modified.

---

## Dual write guards

Execute requires **all** of:

- `NODE_ENV=production`
- `PLATFORM_MODE=staging`
- `ALLOW_STAGING_DATA_MIGRATION=true`
- CLI `--execute`
- target = `humanity_union_staging` (or `hu_test_*` under `NODE_TEST_ENV=true`)
- source ≠ target; source approved; target not production/dev/unknown

---

## Post-migration verification checklist

- [ ] Staging admin still role=admin, same userId/memberId/email
- [ ] Historical Vlad present separately (Gmail)
- [ ] Michael, Derek, Isabella present
- [ ] ~5 auth users (admin + 4)
- [ ] Five historical Initiatives present with correct stewards
- [ ] Bootstrap retained
- [ ] Related analyses/proposals/revisions present for CSS/Mind-Safe
- [ ] No activities/discussions/legacy proposals imported
- [ ] Admin Panel Participant + Initiative directories list expected rows
- [ ] Platform statistics reflect imported Initiatives (Mongo persistence mode)

---

## Command

```bash
# Dry-run (default)
pnpm migrate:staging-historical-data

# Execute (operator-approved only)
NODE_ENV=production PLATFORM_MODE=staging \
ALLOW_STAGING_DATA_MIGRATION=true \
MONGODB_DATABASE=humanity_union_staging \
pnpm migrate:staging-historical-data -- --execute
```
