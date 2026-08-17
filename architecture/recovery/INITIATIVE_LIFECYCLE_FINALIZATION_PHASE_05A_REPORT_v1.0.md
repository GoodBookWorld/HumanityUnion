# INITIATIVE LIFECYCLE FINALIZATION — PHASE 05A REPORT v1.0

**Date:** 2026-08-17  
**Branch:** `staging`  
**Nature:** Full lifecycle runtime certification & completion  
**Constraints:** No commit/push/deploy; no staging writes; no R2; no migration

---

## 1. Was full Initiative→Archive previously complete?

**PARTIAL.**

Per-stage Author packs (Analysis → Archive) and profile-aware resolver existed, plus many stage-local verify scripts. There was **no** certified STANDARD zero-community golden path, **no** PUBLIC_CHOICE Create UX, and progress derivation had a critical Revision bootstrap defect that made early stages appear missing/N/A.

---

## 2. Exact missing/broken stages (pre-fix)

| Issue | Classification |
|-------|----------------|
| Bootstrap Revision v1 counted as lifecycle progress | **BROKEN** |
| Petition Author "published" vs Public Ready/Draft visibility mismatch | **BROKEN** |
| Petition projection could fail while entity existed | **PARTIAL** |
| Empty Improvement Proposals collection could not publish | **BROKEN** (accidental zero-community gate) |
| Mongo snapshot `replaceRecordMap` stripped `idField` → unique index null collisions | **BROKEN** |
| Mongo snapshot `save` dropped in-flight writes | **BROKEN** |
| `lifecycleProfile` Create UI | **NOT_IMPLEMENTED** → fixed |
| Full STANDARD + PUBLIC_CHOICE golden verify command | **NOT_IMPLEMENTED** → fixed |

---

## 3. Collaborative Analysis inconsistency — root cause

**Not** proposal-mark unlocking. Proposal-marked comments are **content sources** only.

Primary lifecycle defect: `createInitialInitiativeVersionRevision` (v1 "Initial published version.") was counted as published `revision` stage evidence. Resolver then jumped `current` to Petition and labeled empty earlier stages **Not applicable** — Analysis appeared missing until later actions/refreshes confused the picture.

---

## 4. Petition contradiction — root cause

Same Initiative could show:

| Claim | Source | Why wrong together |
|-------|--------|--------------------|
| In Progress · Current | Nav when petition is current + no public records | Valid if unpublished |
| Unavailable | Adapter/optional lookup INFRASTRUCTURE_FAILURE or projection throw | Infra only |
| Already published | Workspace treated `status !== "Draft"` (included **Ready**) | Too broad |
| NOT STARTED | Public projection null for Draft/Ready | Correct for Ready |

**Fix:** shared `isPetitionPubliclyVisible` (excludes Draft+Ready); harden visitor-signal enrichment; Author workspace uses same rule.

---

## 5. Decision Session preview vs Not Started — root cause

**By design for draft preview:** Generate/Save/Preview writes lifecycle draft / renders unpublished preview; resolver/nav only advance on **published** `decision_sessions`. Preview ≠ publish.

If publish succeeded but nav stayed Not Started, that would be persistence mismatch — golden path now proves publish advances `current` to Collective Decision.

---

## 6. Stage certification matrix (post-fix)

| Stage | Classification | Zero-community completable |
|-------|----------------|----------------------------|
| Initiative | CERTIFIED | YES |
| Discussion | CERTIFIED | YES (Author marker) |
| Collaborative Analysis | CERTIFIED | YES |
| Improvement Proposals | CERTIFIED | YES (empty collection publish allowed) |
| Revision | CERTIFIED | YES (bootstrap v1 excluded from progress) |
| Petition | CERTIFIED | YES (Open + zero signatures) |
| Decision Session | CERTIFIED | YES |
| Collective Decision | CERTIFIED | YES (zero votes close) |
| Implementation Commitments | CERTIFIED* | YES* (steward self-commitment OK) |
| Implementation Tracking | CERTIFIED | YES |
| Official Responses | CERTIFIED | YES |
| Public Impact | CERTIFIED | YES |
| Civic Archive | CERTIFIED | YES |

\*PUBLIC_CHOICE still seeds minimal Decision Session + Public Impact substrates for Collective Decision / Archive (documented in verify script) — engine route is correct; substrate coupling is legacy-dependent.

---

## 7–10. Golden path results

| Path | Result |
|------|--------|
| STANDARD zero-community → Archive | **PASS** |
| PUBLIC_CHOICE → Archive | **PASS** |
| Mongo disconnect/reconnect checkpoints | **PASS** (analysis, revision, petition, collective decision) |
| Ephemeral `hu_verify_*` disposed | **PASS** |

Command: `pnpm verify:initiative-lifecycle`

---

## 11. Creation profile selector

Explicit **Standard Initiative** / **Public Choice** radios on Create Initiative; `lifecycleProfile` sent on draft create. Default STANDARD. API already accepted the field.

---

## 12–13. Legacy / parallel paths

- Legacy improvement-proposal module still feeds stage counts as fallback.
- Petition bootstrap Collective Decision remains.
- Official Response dual CAP/lifecycle package paths remain.
- PUBLIC_CHOICE still needs Decision Session + Public Impact substrates for later stages today.

No second lifecycle engine introduced.

---

## 14. Changes made (summary)

- Exclude bootstrap Revision from lifecycle progress evidence
- Unify Petition public visibility; harden projection enrichment
- Allow empty Improvement Proposals collection publish
- Chain Mongo snapshot writes; preserve idField on replace
- Presentation contradiction detectors + unit tests
- Create UX lifecycleProfile selector
- `verify:initiative-lifecycle` Mongo golden path (dispose in finally)

---

## 15–20. Quality gates

See final operator report in chat (tests/typecheck/lint/builds/diff-check/topology).

---

## 21. Remaining blockers before Phase 06

1. Human staging steward acceptance run (STANDARD + PUBLIC_CHOICE) on live staging.
2. Optional: remove PUBLIC_CHOICE substrate seeds by making Collective Decision / Archive not require Decision Session / Public Impact when profile is PUBLIC_CHOICE (separate task).
3. Phase 05 product commit/deploy still pending owner instruction.

Phase 06 notifications remain blocked until staging acceptance PASS.

---

## 22. Staging certification procedure (human)

**Do not run destructive automated staging writes from this pack.**

### STANDARD
1. Create Initiative → choose **Standard Initiative** → publish.
2. Discussion tab → Complete Discussion (no comments required).
3. Analysis → Generate → Save → Publish.
4. Improvement Proposals → Generate → Publish (empty OK).
5. Revision → edit → Publish (must advance past bootstrap v1).
6. Petition → Generate → Publish → Public Preview shows Open (0 signatures OK). Author must NOT say “already published” while preview says Not Started.
7. Decision Session → Generate → Save → Preview (still Not Started) → Publish → becomes completed; Collective Decision available.
8. Continue Commitments → Tracking → Official Responses → Public Impact → Civic Archive.

### PUBLIC_CHOICE
1. Create → choose **Public Choice**.
2. Discussion → Complete.
3. Collective Decision → Publish (STANDARD-only stages Not applicable).
4. Civic Archive.

---

## 23. Confirmation

No commit / push / deploy / staging write / R2 / migration in this phase.
