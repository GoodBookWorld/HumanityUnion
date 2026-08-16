# Staging Data Migration Assessment v1.0

**Pack:** STAGING DATA MIGRATION PACK 01  
**Mode:** READ-ONLY / DRY-RUN  
**Generated:** 2026-08-16  

**Confirmation:** No Mongo documents were written, updated, deleted, or migrated during this assessment. No credentials or connection strings are included in this document.

---

## Executive answer

| Question | Finding |
|---|---|
| Where are the historical ~4 Participants? | In MongoDB logical database `humanity_union_dev` (`auth_users` + linked `members` / `member_profiles`). Four real-looking accounts are Vlad (`sh***@gmail.com`), Michael, Derek, and Isabella. |
| Where are the historical ~4 Initiatives? | **Not** in Mongo `initiatives`. They live in local file persistence `apps/api/.runtime/initiatives.json` because non-production `INITIATIVE_PERSISTENCE` defaults to **file**. Four primary candidates: *Citizen Support Squad (CSS)*, *The Mind-Safe Alliance*, *Bridging the "New World Disorder"*, *AI for the Common Good* (+ optional fifth: *Development of the Humanity Union platform*). |
| Compatible with current architecture? | Participants: yes (Participant-first). Initiatives: yes as canonical Initiative records, but they require **file → staging Mongo** import and steward identity mapping. |
| What exists in staging? | `humanity_union_staging`: 1 admin Participant (Vlad / `sh***@huws.org`), 1 bootstrap Initiative (`initiative-bootstrap-001`). |
| Can staging admin be preserved? | **Yes.** No email fingerprint collision with historical Vlad (`gmail` ≠ `huws.org`). Pack 02 must never overwrite the staging admin auth row. |

---

## 1. Persistence configuration (safe)

### Mongo resolution
- Env vars: `MONGODB_URI`, `MONGODB_DATABASE` (default logical name `humanity_union` if unset), timeouts/pool vars.
- Local API `.env` logical database: **`humanity_union_dev`**.
- Staging logical database name (docs/gates): **`humanity_union_staging`**.
- Collection names: shared via `MONGO_COLLECTIONS` — identical across databases; separation is by database name only.

### Domain persistence defaults (non-production)
| Domain | Adapter default | Notes |
|---|---|---|
| Auth / Members / Profiles / Membership | Mongo required when URI set | Identity is Mongo-backed |
| Initiatives (+ most civic lifecycle stores) | **file** via `INITIATIVE_PERSISTENCE` etc. | Explains missing Initiatives in Mongo |
| Blog / engagement | Mongo if URI else memory | |
| Legacy Activity / Discussion / Proposal / Decision | Mongo collections still present | **Not** canonical civic roots |

### Legacy adapters still present
Mounted routes under `/api/v1/activities`, `/discussions`, `/proposals`, `/decisions` using collections `activities`, `discussions`, `proposals`, `decisions`.

---

## 2. Historical source identification

Accessible with current local project Mongo credentials (URI redacted):

| Logical database | Role in this assessment |
|---|---|
| `humanity_union_dev` | Primary Mongo historical/dev source for identity + legacy Activity graph |
| `humanity_union_staging` | Current staging target (read-only compared) |
| `apps/api/.runtime/*.json` | **Primary source for historical Initiatives** and related civic artifact files |

Also observed: leftover `hu_test_*` database (test isolation residue) — ignore for migration.

---

## 3. Read-only inventory summary

### `humanity_union_dev` (Mongo)
| Collection | Count |
|---|---:|
| auth_users | 154 |
| members | 4358 |
| member_profiles | 6837 |
| memberships | 20 |
| initiatives | **1** (bootstrap only) |
| initiative_analyses / improvement_proposals / revisions / sessions / collective decisions / impacts / archive | 0 |
| petitions | 11 |
| participant_actions | 160 |
| initiative_comments | 13 |
| blog_posts | 0 |
| **activities (legacy)** | **1785** |
| discussions (legacy) | 789 |
| proposals (legacy) | 563 |
| decisions (legacy) | 0 |

Non-`@example.com` auth users sampled: **17** (mix of real gmail accounts + `*.test` harness accounts).

### `humanity_union_staging` (Mongo)
| Collection | Count |
|---|---:|
| auth_users | 1 (admin) |
| members / member_profiles / memberships | 1 each |
| initiatives | 1 (`initiative-bootstrap-001`) |
| legacy activities/discussions/proposals | 0 |
| all other civic collections inventoried | 0 |

### File runtime (`apps/api/.runtime`)
| Artifact | Count / note |
|---|---|
| initiatives.json | 592 total (mostly verification fixtures) |
| Historical candidate Initiatives | 4–5 real civic titles (see below) |
| Related analyses/proposals/revisions | Present for CSS / Mind-Safe; revisions for all four primary candidates |

---

## 4. Expected historical records — located

### Participants (approximate 4)
| Display name | Email (masked) | memberId (safe) | Auth in `humanity_union_dev` | Steward of historical Initiative? |
|---|---|---|---|---|
| Vlad | `sh***@gmail.com` | `a5e65d2f-…` | yes (role `member`) | yes (CSS, Mind-Safe) |
| Michael | `us***@gmail.com` | `9cde6a4e-…` | yes | yes |
| Derek | `tu***@gmail.com` | `57696395-…` | yes | yes |
| Isabella | `co***@gmail.com` | `5bb8e373-…` | yes | yes |

Staging admin Vlad (`sh***@huws.org`, memberId `58229b2a-…`, role `admin`) is a **different** auth identity (no email fingerprint collision).

### Initiatives (approximate 4 primary + 1 optional)
| initiativeId | Title | Steward | lifecycle / status / visibility | Related (file runtime) |
|---|---|---|---|---|
| `initiative-1783748417899` | Citizen Support Squad (CSS) | Vlad (gmail) | projected / proposal / public | analyses 2, proposals 3, revisions 1 |
| `initiative-1784349613932` | The Mind-Safe Alliance | Vlad (gmail) | projected / proposal / public | analyses 1, revisions 1 |
| `initiative-1785636843367` | Bridging the "New World Disorder" | Michael | projected / proposal / public | revisions 1 |
| `initiative-1785693642422` | AI for the Common Good | Derek | projected / proposal / public | revisions 1 |
| `initiative-1785948978037` *(optional)* | Development of the Humanity Union platform | Isabella | projected / proposal / public | revisions 1 |

---

## 5. Staging comparison

| Check | Result |
|---|---|
| Same auth userIds | 0 collisions |
| Same memberIds | 0 collisions |
| Same email fingerprints | 0 collisions (admin `huws.org` ≠ historical `gmail.com`) |
| Same initiativeIds | 1 collision: bootstrap `initiative-bootstrap-001` already in both |
| Staging admin protected | Yes if Pack 02 never replaces admin auth by display-name |
| Orphan members/profiles in dev | Large (thousands) — mostly geography/seed/test residue; **do not bulk-migrate** |
| Initiatives missing steward in Mongo | Bootstrap steward `member-bootstrap-001` has no auth user (integrity warning, already duplicated in staging) |
| Legacy Activity graph | Huge in dev; **exclude** from direct Initiative migration |

---

## 6. Classification

### A. SAFE TO MIGRATE (with auth reset)
- Michael, Derek, Isabella auth+member+profile rows from `humanity_union_dev` (no staging collision), **without** copying password hashes as login credentials of record — prefer invite/password-reset after import.

### B. REQUIRES TRANSFORM
- Historical Initiatives + related file-runtime analyses/proposals/revisions → staging Mongo under production persistence.
- Historical Vlad (`gmail`) identity: migrate as ordinary Participant **or** link steward references to staging admin after explicit human decision — default recommendation: **migrate as separate Participant**, keep staging admin untouched; remap Initiative `stewardId` only if product chooses merge.

### C. LEGACY — DO NOT MIGRATE DIRECTLY
- `activities` (1785), `discussions` (789), `proposals` (563) in `humanity_union_dev`.
- Sample titles are mostly repeated verification fixtures (“Community Water Quality Review”) with distinct creators — not Initiative roots.
- Must not be revived as parallel civic roots.

### D. DUPLICATE / ALREADY PRESENT
- `initiative-bootstrap-001` / Community Garden Initiative in both databases.

### E. INTEGRITY ISSUE / HUMAN REVIEW
- Bootstrap Initiative steward `member-bootstrap-001` unresolved in auth.
- Mass orphan `members` / `member_profiles` counts in dev (do not interpret as “4358 Participants”).
- Optional fifth Initiative (Isabella) — confirm inclusion.
- Display-name overlap “Vlad” across two emails — merge only with explicit approval.

---

## 7. Identity preservation plan

1. **Never modify** staging admin (`role=admin`, `sh***@huws.org`).
2. Import historical Participants by preserving `userId`/`memberId` when free; if conflict arises, allocate new IDs and maintain a mapping table (none needed for current collision set).
3. **Do not migrate password hashes as authoritative secrets** for restored logins. Store/import account shell + force password reset / invite confirmation.
4. Migrate member profile public fields only (display/public name, visibility) — no tokens/sessions.
5. Memberships: import only for the selected Participant set if rows exist; do not bulk-copy all 20 blindly without review.

---

## 8. Initiative migration plan

1. Source of truth for the four Initiatives: **`apps/api/.runtime/initiatives.json`** (+ related `.runtime` files), not Mongo `initiatives`.
2. Preserve `initiativeId` values (no collisions with staging except bootstrap).
3. Preserve `lifecyclePhase=projected`, `status=proposal`, `visibility.public` as stored.
4. Preserve `stewardId` only after corresponding Participant exists in staging (or after approved remap to staging admin memberId).
5. Import related file artifacts for those Initiative IDs: analyses, improvement proposals, version revisions. Leave empty decision/implementation/archive chains as empty.
6. After import, staging must run with Mongo initiative persistence (`NODE_ENV=production` / `INITIATIVE_PERSISTENCE=mongodb`) so Admin Panel lists them.
7. Ancestry: children already carry `initiativeId`; importing parent first then children preserves Initiative Ancestry Invariant. Do not invent missing parents from Activities.

---

## 9. Exact Pack 02 sequence (proposed, not executed)

1. Freeze staging admin identity; snapshot staging counts.
2. Select Participant allow-list (4 primary + optional Isabella).
3. Dry-run identity import into `humanity_union_staging` (auth without secret reuse → reset flow).
4. Import selected Initiatives from `.runtime` into staging Mongo `initiatives`.
5. Import related analyses/proposals/revisions for those IDs only.
6. Rebuild projection/search indexes as required by existing ops scripts.
7. Verify Admin `/admin/initiatives` lists the four Initiatives; verify public projection eligibility.
8. Explicitly skip legacy Activity/Discussion/Proposal collections.
9. Produce Pack 02 write report + rollback notes.

---

## 10. Tooling

Read-only inspector:

```bash
pnpm exec tsx apps/api/src/scripts/staging-data-migration-inspect.ts \
  --source=humanity_union_dev \
  --target=humanity_union_staging
```

- Defaults to dry-run; rejects `--write` / `--execute`.
- Never prints `MONGODB_URI`.
- Writes safe metadata to `architecture/recovery/STAGING_DATA_MIGRATION_MANIFEST_v1.0.json`.

---

## 11. Pack 02 gate — APPROVED

Pack 02 decisions (locked):

- Isabella Initiative is **in scope**.
- Historical Vlad Gmail remains a **SEPARATE_PARTICIPANT** (do not merge with staging-admin Vlad HUWS).
- Display name is never an identity merge key.
- See `STAGING_DATA_MIGRATION_EXECUTION_PLAN_v1.0.md` and `migrate:staging-historical-data` (dry-run default).
