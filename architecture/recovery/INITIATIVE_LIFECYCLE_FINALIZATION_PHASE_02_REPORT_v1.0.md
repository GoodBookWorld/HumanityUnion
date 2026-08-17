# INITIATIVE LIFECYCLE FINALIZATION — PHASE 02 REPORT v1.0

**Phase:** INITIATIVE LIFECYCLE FINALIZATION — PHASE 02  
**Nature:** Architecture convergence (LifecycleProfile + state authority + persistence contract + experience soft-fail + contract fixes)  
**Date:** 2026-08-16  
**Branch:** `staging`  
**Prior:** `INITIATIVE_LIFECYCLE_FINALIZATION_AUDIT_v1.0.md` (Phase 01)

**Authorities preserved:** Initiative-root ADR; Participant-first / participation-ledger ADRs; `LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md`; Recovery Packs 01–05 CLOSED.

---

## 1. Executive summary

Phase 02 converges the Initiative Lifecycle onto **one profile-aware runtime contract** without creating a second engine:

| Target | Outcome |
|--------|---------|
| ONE Initiative root | Preserved |
| ONE Lifecycle Engine | Preserved; profile selects route |
| ONE Stage Registry | `@hu/types` registry + profile routes |
| ONE derived State Resolver | `resolveInitiativeLifecycleState` |
| ONE transition contract | Helpers + existing `publishInitiativeLifecycleStage` |
| ONE production persistence expectation | Matrix below; Mongo = staging/prod truth |
| ONE Author / Participant progression model | Profile-aware next stage; Discussion remains Center tab |
| ONE notification-event path | `InitiativeLifecycleStagePublished` preserved + next-stage log |

**Not built (deferred):** full PUBLIC_CHOICE UI; Reference Initiatives; Phase 04 Author polish; Phase 05 Participant Journey; Phase 06 recipient matrix.

---

## 2. LifecycleProfile model / contract

**Type:** `InitiativeLifecycleProfile = "STANDARD" | "PUBLIC_CHOICE"`  
**Module:** `packages/types/src/domain/initiative-lifecycle-profile.ts`

| Rule | Behavior |
|------|----------|
| Default | Missing / historical → **STANDARD** (never silently PUBLIC_CHOICE) |
| Persistence | `Initiative.lifecycleProfile?` on create; snapshot Mongo/file/memory |
| Creation API | Optional `lifecycleProfile` on draft create; validated centrally |
| Creation UI selector | **Deferred** to a later Phase (domain/API ready) |
| Profile change | Allowed only while `lifecyclePhase === "draft"` **and** no published lifecycle artifacts beyond Initiative; otherwise refused |

This is **not** two engines, two Initiative domains, or a Candidate-specific backend.

---

## 3. STANDARD route

Domain registry order (Discussion is a Stage Registry entry that reuses the Center-tab `#discussion` contract):

`initiative → discussion → analysis → proposal → revision → petition → decision_session → collective_decision → commitment → tracking → official_response → public_impact → archive`

---

## 4. PUBLIC_CHOICE route

Canonical domain route:

`initiative → discussion → collective_decision → archive`

User-facing Create → Discussion → Vote → Result → Archive remains a **later UX projection**.  
**Result** is a projection of Collective Decision, not a new domain stage.

Required transitions:

- Initiative → Discussion  
- Discussion → Collective Decision  
- Collective Decision → Civic Archive  

## 5. Initiative creation / profile compatibility

| Surface | Status |
|---------|--------|
| `CreateInitiativeDraftInput.lifecycleProfile` | Optional; validated |
| `createInitiativeDraft` | Persists `resolveInitiativeLifecycleProfile(...)` (default STANDARD) |
| Historical Initiatives | No field → STANDARD at resolve time |
| Creation UI selector | Deferred (document only) |

---

## 6. Canonical Stage Registry

**Source of truth:** `INITIATIVE_LIFECYCLE_STAGE_REGISTRY` in `@hu/types`  
**Profile membership / order:** `getLifecycleStageRouteForProfile` / `isLifecycleStageApplicableToProfile`  
**Predecessor / successor:** `getPreviousApplicableLifecycleStageId` / `getNextApplicableLifecycleStageId`  
**Author / participant / publication flags:** existing registry fields (`authorModeApplies`, `hasPublicParticipationAction`, `supportsPublication`, …)  
**Notifications:** stages with `supportsPublication` continue to emit via `publishInitiativeLifecycleStage`

React components must not invent independent ordering. Hash selection is **display-only**.

---

## 7. Canonical lifecycle state authority

**Resolver:** `resolveInitiativeLifecycleState` (`packages/types/src/domain/initiative-lifecycle-state.ts`)

Provides: `lifecycleProfile`, `currentStageId`, `nextStageId`, `completedStageIds`, `availableStageIds`, `lockedStageIds`, `notApplicableStageIds`, `stageApplicability`.

**Vocabulary:** `APPLICABLE | NOT_APPLICABLE | AVAILABLE | CURRENT | COMPLETED | LOCKED`  
A skipped profile stage is **NOT_APPLICABLE**, not missing/blocked.

Experience nav (`buildLifecycleNavigation`) and `resolveCurrentStageIdFromPublicationMetadata` **delegate** to this resolver (pure module: `public-initiative-experience-lifecycle-nav.ts`).

**No new independently mutable `currentStageId` field** on Initiative.

---

## 8. Field authority classification

| Field / signal | Class |
|----------------|-------|
| `lifecycleProfile` | **CANONICAL** (default STANDARD when absent) |
| Published lifecycle artifacts / counts | **CANONICAL** progress inputs |
| Derived lifecycle state snapshot | **DERIVED** |
| `lifecyclePhase` (draft/published/projected/archived) | **CANONICAL for Initiative record only** — not stage progress |
| `Initiative.status` | **LEGACY — do not use for progress** |
| Frontend / hash active stage | **DISPLAY-ONLY** |

Exported aid: `INITIATIVE_LIFECYCLE_FIELD_AUTHORITY`.

---

## 9. Persistence convergence matrix (compact)

| Lifecycle concern | Local typical | Test | Staging / production | Notes |
|-------------------|---------------|------|----------------------|-------|
| Initiative root | file / mongodb | mongodb when URI | **mongodb** | Snapshot persistence; `lifecycleProfile` rides with document |
| Collaborative Analysis (canonical) | file / mongodb | mongodb | **mongodb** | Authoritative for lifecycle |
| Legacy `/initiatives/:id/analysis` | memory | memory | empty → **compat read** from published initiative-analyses | Not a second write store |
| Revision drafts / versions | file / mongodb | mongodb | **mongodb** | |
| Petition | **mongo-only** | mongodb | **mongodb** | Absence → `null`; Experience soft-fails throws |
| Allies / collaboration attach | mongo | mongodb | **mongodb** | Soft-fail on Experience; Author Mode uses stewardship |
| Collective Decision / votes | mongo | mongodb | **mongodb** | |
| Stage publication outbox | mongodb | mongodb | **mongodb** | Deterministic eventId → idempotent enqueue |
| Official response / impact / archive lifecycle | file/mongo per module | mongodb | **mongodb** in production contract | |

**Contract:** A lifecycle feature that “works” only via file/memory defaults is **not** staging-ready. Mongo/staging behavior is production truth. Optional missing artifacts return **absence**, not 500.

---

## 10. Local vs staging parity changes

1. Petition applicability no longer uses async Promise truthiness; profile membership only.  
2. Experience optional lookups (`petition`, civic archive, petition projection, collaboration attach) soft-fail via `settleOptionalLookup`.  
3. Progress derivation is profile-aware and shared with `@hu/types`.  
4. Pure nav helpers no longer force Mongo connect in unit tests.  
5. Mongo-backed unit coverage for optional petition absence when `MONGODB_URI` is set.

---

## 11. Experience / petition / allies 500 root fix

| Failure mode | Treatment |
|--------------|-----------|
| Optional artifact **absent** (`null`) | `NOT_CREATED_YET` / `absent` diagnostic; empty stage |
| Optional lookup **throws** (infra) | `INFRASTRUCTURE_FAILURE` / `unavailable` diagnostic + error log; Experience continues |
| Required Initiative / core projection failure | Still throws (must not be wrapped) |
| Petition stage adapter | null → `not_started`; throw → `unavailable` |
| Allies fetch fail in sidebar | Stewardship flag keeps Author Mode |

Shared helper: `apps/api/src/shared/lifecycle/optional-lifecycle-lookup.ts`  
Public-safe diagnostics: `optionalStageDiagnostics` on Experience projection (no raw infra messages).

---

## 14. Unified transition semantics

Conceptual sequence (documented in `initiative-lifecycle-transition.contract.ts`):

1. validate current canonical lifecycle state  
2. validate stage prerequisites (domain-owned)  
3. persist publication (domain-owned, durable)  
4. derived state advances from artifact counts + profile via **resolver postcondition**  
5. next **applicable** stage AVAILABLE/CURRENT  
6. emit `InitiativeLifecycleStagePublished`  
7. update projections  
8. enqueue notification work (Phase 06 consumers)

Helpers: `resolveLifecycleStateAfterStagePublication`, `assertLifecycleTransitionPostcondition`, `resolveNextStageAfterPublish`.  

**Next-stage creation strategy: LAZY** (`LIFECYCLE_NEXT_STAGE_CREATION_STRATEGY`). Opening the next stage initializes empty working state; absence of a pre-created artifact is not failure; retries/idempotent opens required.

**Not** a second transition engine.

---

## 15. Next-stage availability behavior

| Profile | After | Next |
|---------|-------|------|
| STANDARD | Initiative published | Discussion |
| STANDARD | Discussion completed | Collaborative Analysis |
| STANDARD | Revision published | Petition |
| PUBLIC_CHOICE | Initiative published | Discussion |
| PUBLIC_CHOICE | Discussion completed | Collective Decision |
| PUBLIC_CHOICE | Collective Decision published | Civic Archive |

---

## 18. Reference Initiatives (prepare only)

Later finalization creates:

- **REFERENCE A — STANDARD INITIATIVE** — full lifecycle  
- **REFERENCE B — PUBLIC CHOICE / CANDIDATE** — Initiative → Discussion → Collective Decision → Civic Archive  

Both use the same Initiative root, Stage Registry, State Resolver, transition contract, notification system, and verification harness. Both later receive a Lifecycle Guide sidebar that **reads** derived state only. **Not built in Phase 02.**

---

## 21. Remaining risks for Phase 03+ (post-addendum)

1. Residual optional Experience lookups may still lack diagnostics (beyond petition/archive).  
2. Discussion completion marker wiring to Author UX (durable progress signal) still needs product/UX confirmation in Phase 03/04.  
3. Legacy analysis callers still use compatibility route — migrate in Phase 03/04.  
4. Profile creation UI selector deferred.  
5. LAZY next-stage open/init paths must stay idempotent per stage workspace (verify in Phase 03).  
6. Improvement Proposals memory default residual (BH-07).  
7. Notification fan-out still Ally-centric until Phase 06.

---

## 23. Architecture review addendum (2026-08-16)

Corrections applied before Phase 02 acceptance:

1. PUBLIC_CHOICE route corrected to include Discussion.  
2. Soft-fail no longer masks infrastructure failure as absence; diagnostics are observable.  
3. Transition postcondition exercises the canonical resolver (not only nextStage helper).  
4. Analysis compatibility classified `COMPATIBILITY_READ_ONLY`; deprecate Phase 03–04.  
5. Profile remains configuration, not progress state.  
6. Reference A/B plan updated.

### Acceptance checklist (YES/NO)

1. Exactly one LifecycleProfile-aware Stage Registry? **YES**  
2. PUBLIC_CHOICE includes Discussion? **YES**  
3. Exactly one lifecycle state resolver? **YES**  
4. Normal absence distinguishable from infrastructure failure? **YES**  
5. /experience survives optional-section failure without lying? **YES**  
6. Successful publication has deterministic resolver postcondition? **YES**  
7. Next applicable stage reachable without hidden manual infrastructure? **YES** (LAZY)  
8. Retry behavior safe? **YES** (deterministic eventId / duplicate_ignored)  
9. Server restart preserves lifecycle progress? **YES** (published artifacts)  
10. Canonical Analysis sole write authority? **YES**  
11. Historical Initiatives safely STANDARD? **YES**  
12. Profile configuration separate from progress state? **YES**

## 12. Legacy Analysis resolution

**Route:** `GET /api/v1/initiatives/:initiativeId/analysis`  
**Classification:** `COMPATIBILITY_READ_ONLY`  
**Callers (web):** `getCollaborativeAnalysisByInitiativeId` (collective-decision pages, petition page, ViewCollaborativeAnalysisLink, DecisionActions).

**Phase 02 action:** On legacy in-memory miss, **read** published canonical initiative-analyses. **No write bridge.**  
**Write authority:** initiative-analyses / lifecycle Collaborative Analysis only.  
**Deprecation:** Phase 03–04 — migrate remaining callers; then remove compatibility route.

---

## 13. Revision 400 contract resolution

| Field | Contract |
|-------|----------|
| `revisionSummary` | **Required** authored content on publish |
| `title`, `description`, `activityArea` | **Required** |
| `communitySlug` / community association | **Optional** |

---

## 16. Author Mode stability impact

- Author identity remains Initiative stewardship.  
- Allies optional-fetch failure must not demote steward Author Mode.  
- Remaining Author UX inconsistencies → **Phase 04**.

---

## 17. Notification foundation

- Stage publishes emit `InitiativeLifecycleStagePublished` via durable outbox.  
- Deterministic eventId → `duplicate_ignored` on retry.  
- Phase 06 extends recipient matrix. No notifications from React components.

---

## 19. Tests

Focused unit: profile routes (incl. Discussion), absence vs infra failure, resolver postconditions (Discussion→Analysis / Discussion→Collective Decision / Revision→Petition), Experience nav, Revision contract, idempotent event ids.

Mongo-backed (optional): `RUN_MONGO_INTEGRATION_TESTS=1` + reachable URI runs live absence case; default suite asserts INFRASTRUCTURE_FAILURE classification without connecting.

---

## 20. Phase 03 entry condition

Enter Phase 03 only after Phase 02 acceptance. Do not start Phase 03 while addendum review is open.

**PHASE 03 — Experience shell resilience + Stage URL quarantine**

---

## 22. Safety confirmations

- No real staging write  
- No R2 write  
- No bulk migration / humanity_union_dev copy  
- Nothing committed / pushed / deployed by this Phase task
