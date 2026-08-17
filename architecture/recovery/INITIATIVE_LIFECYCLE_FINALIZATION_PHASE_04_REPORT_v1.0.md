# INITIATIVE LIFECYCLE FINALIZATION — PHASE 04 REPORT v1.0

**Phase:** INITIATIVE LIFECYCLE FINALIZATION — PHASE 04  
**Nature:** Uniform Author workflow convergence  
**Date:** 2026-08-16  
**Branch:** `staging`  
**Baseline checkpoint:** `9de09fc` — ARCH: unify initiative lifecycle shell and navigation  

---

## 1. Author Workflow Contract

Documented and exported as `@hu/types` (`initiative-author-workflow.ts`):

OPEN / INITIALIZE → LOAD CANONICAL CONTEXT → PREPARE / GENERATE → EDIT → SAVE DRAFT → PREVIEW → PUBLISH → VERIFY PUBLICATION POSTCONDITION → ADVANCE / UNLOCK NEXT

Behavioral (not identical UI). Stages omit inapplicable steps. Shared helpers:

- `ensureLazyWorkingArtifact` / `ensureLazyWorkingArtifactAsync`
- Phase 02 `publishInitiativeLifecycleStage` + transition postcondition helpers (reused, not duplicated)

---

## 2. Per-stage workflow matrix (summary)

| Stage | Author-editable | Classification | Notes |
|-------|-----------------|---------------|-------|
| Initiative | yes | CANONICAL | Existing publish path |
| Discussion | complete-only | CANONICAL | Center-tab surface + explicit completion marker |
| Collaborative Analysis | yes | CANONICAL | Existing draft/publish |
| Improvement Proposals | yes | CANONICAL | Durable stage collections (file/mongo); legacy proposals COMPATIBILITY for nav counts |
| Revision | yes | CANONICAL | Client+API validation aligned |
| Petition | yes | CANONICAL | Lazy init + save-before-publish hardened |
| Decision Session | yes | CANONICAL | Existing |
| Collective Decision | yes | CANONICAL | Author ≠ Participant ballot (preserved) |
| Implementation Commitments | yes | CANONICAL | Existing |
| Implementation Tracking | yes | CANONICAL | Existing |
| Official Responses | yes | COMPATIBILITY | Dual projection remains |
| Public Impact | yes | COMPATIBILITY | Dual projection remains |
| Civic Archive | yes | CANONICAL | Terminal; next = null |

PUBLIC_CHOICE applicability: same contract; skipped STANDARD stages remain NOT_APPLICABLE and do not initialize.

---

## 3. Persistence convergence

- Improvement Proposals stage: non-prod default **file** (was memory); production durable key still forces **mongodb**.
- Discussion completion: file / memory / mongodb via `INITIATIVE_DISCUSSION_LIFECYCLE_COMPLETION_PERSISTENCE` (durable key).
- Petition drafts: unchanged durable path; save now lazy-inits if missing.

---

## 4. Lazy initialization contract

Shared helper in `apps/api/src/shared/lifecycle/lazy-stage-initialization.ts`.

Petition `getOrCreateWorkingPetitionDraft` uses it. Opening/initializing does not publish or advance progression. Idempotent.

---

## 5. Draft / save behavior

- Petition Save Draft: get-or-create then persist; survives refresh via canonical adapter.
- Revision Save Draft: unchanged store; Publish blocked until Save succeeds.
- No silent memory fallback in production durable keys.

---

## 6. Preview behavior

Unchanged stage preview slots. Preview remains DISPLAY-ONLY (no publish / no progression mutation).

---

## 7. Publication contract

Stages continue to call `publishInitiativeLifecycleStage` after domain persist. Discussion completion now emits the same event with `stageId: "discussion"`.

---

## 8. Transition / postcondition behavior

Reuses Phase 02:

- `resolveNextStageAfterPublish`
- `resolveLifecycleStateAfterStagePublication`
- `assertLifecycleTransitionPostcondition`

Covered by Phase 04 unit tests for Revision→Petition, Petition→Decision Session, Archive terminal null next.

---

## 9. Discussion completion semantics

| Question | Resolution |
|----------|------------|
| What completes Discussion? | Explicit Author action `POST …/initiative-discussion-lifecycle/…/complete` |
| Who can advance? | Initiative steward (ownership) |
| Artifact | Durable `InitiativeDiscussionCompletion` marker (not a parallel Discussion domain) |
| Event | `InitiativeLifecycleStagePublished` (`stageId: discussion`) |
| Visiting `#discussion` | Never completes |

Experience nav counts discussion records from the completion marker.

---

## 10. Revision fix

- Client: required-field gate (title, description, activity area, revisionSummary) before Publish; actionable message; Publish disabled when incomplete.
- Save-then-publish: Publish aborts if Save fails (no silent continue).
- API: `revisionSummary` required; `communitySlug` optional (Phase 02) — unchanged, now mirrored in UI.

---

## 11. Petition first-save / publish regression

Root cause: `handleSave` swallowed errors; Publish still ran on stale draft.

Fix:

1. `handleSave` returns boolean; Publish requires success.
2. Client required-field gate aligned with API validators.
3. Server Save lazy-inits draft if absent.

---

## 12. Improvement Proposals persistence result

- Default non-prod: **file** under `.runtime/…collections.json`.
- Production: mongodb (durable contract).
- Experience progress prefers published **stage collections**; legacy proposals remain COMPATIBILITY fallback when no collection published.

---

## 13. Author Mode resilience

Preserved Phase 03: `viewerIsSteward` authoritative. Optional diagnostics cannot demote Author Mode. Regression test added.

---

## 14. Validation UX

Revision + Petition: field-level required messaging; Publish disabled when known requirements missing; API remains final authority.

---

## 15. Assistant stage-context result

No change required. Existing hash/route → `stageId` resolution in `resolve-assistant-surface.ts` continues. Assistant does not own progression/publish.

---

## 16. STANDARD result

Revision→Petition transition + Discussion completion marker + Petition lazy/save/publish path converged under one Author workflow contract.

---

## 17. PUBLIC_CHOICE result

Skipped stages remain NOT_APPLICABLE (resolver + nav). No forced init of STANDARD-only stages.

---

## 18. Tests

- `apps/api/test/unit/initiative-lifecycle-stage/phase04-author-workflow.test.ts` — PASS
- Phase 02 revision/nav regressions — PASS
- `apps/web/.../phase04-author-mode-resilience.test.ts` — PASS
- Phase 03 shell tests — PASS

---

## 19. Typecheck

`@hu/types`, `@hu/api`, `@hu/web` — PASS

---

## 20. Lint

Touched API + web paths — PASS

---

## 21. Builds

`@hu/types` build, `@hu/api` build, `@hu/web` build — PASS

---

## 22. git diff --check

PASS

---

## 23. Files created / modified (primary)

**Created:** Author workflow types; discussion-lifecycle module; lazy-init helper; proposals file persistence; Discussion completion banner + web API; Phase 04 tests; this report.

**Modified:** experience stage records; proposals persistence resolver; petition/revision editors; Center panel; production persistence keys; mongo bootstrap/collections/indexes; continuity docs.

---

## 24. Remaining risks for Phase 05+

- Official Response / Public Impact dual COMPATIBILITY projections still dual-read.
- Full Participant Journey / Lifecycle Guide UI / Candidate presentation deferred.
- Phase 06 notification recipient matrix not expanded (event preserved).
- End-to-end staging soak of Discussion complete → next stage still recommended before production cutover.

---

## 25. git status --short

See live `git status --short` at handoff (Phase 04 working tree uncommitted).

---

## 26. Staged count

`0` (nothing staged)

---

## 27. Confirmation

No commit / push / deploy / staging write / R2 change / migration executed in Phase 04.

---

## Exit criteria

All Phase 04 exit criteria **PASS**. Phase 04 is **COMPLETE**.
