# INITIATIVE LIFECYCLE FINALIZATION — PHASE 03 REPORT v1.0

**Phase:** INITIATIVE LIFECYCLE FINALIZATION — PHASE 03  
**Nature:** Experience shell resilience + navigation convergence  
**Date:** 2026-08-16  
**Branch:** `staging`  
**Baseline:** Phase 02 checkpoint (state/persistence/profiles complete)

---

## 1. Executive summary

Phase 03 establishes **one resilient Initiative experience shell** driven by the Phase 02 Lifecycle State Resolver.

| Concern | Outcome |
|---------|---------|
| Canonical shell | `PublicInitiativeExperiencePage` (public + owner mode) |
| Navigation authority | API `lifecycleStages` / `currentStageId` from Phase 02 resolver |
| selectedStage vs currentStage | Explicitly separated (DISPLAY-ONLY vs progress) |
| Author Mode | Stewardship (`viewerIsSteward` / owner route); Allies optional |
| Optional failure | Local diagnostics; shell continues |
| PUBLIC_CHOICE nav | Omits NOT_APPLICABLE; selectability skips gaps |
| Legacy petition URL | Redirects to shell `#petition` |
| Analysis link | Canonical shell + initiative-analyses list |

---

## 2. Canonical shell

**Routes:**

| Route | Role |
|-------|------|
| `/initiatives/public/:id` | Canonical public shell |
| `/initiatives/:id` | Same shell + `ownerMode` when steward |

No second shell. Owner is a mode flag, not a parallel page tree.

---

## 3. Navigation authority

- Server: `buildLifecycleNavigation` → `resolveInitiativeLifecycleState`
- Client: consumes `experience.lifecycleStages` / `currentStageId`
- Display filter: `selectLifecycleNavStagesForDisplay` omits `not_applicable`
- Selectability: `isLifecycleStageSelectable` skips NOT_APPLICABLE when choosing next unlocked stage
- No frontend progress inventing from `Initiative.status`

---

## 4. selectedStage vs currentStage

| Field | Authority |
|-------|-----------|
| `experience.currentStageId` | CANONICAL progress (resolver) |
| `selectedStageId` (UI state) | DISPLAY-ONLY inspection/nav |
| URL hash | DISPLAY-ONLY |

Hash/tab never mutates lifecycle progression.

---

## 5. Author Mode resilience

- Experience API sets `viewerIsSteward` from `viewerParticipantId === stewardId`
- Shell: `viewerIsSteward = ownerMode \|\| experience.viewerIsSteward`
- Sidebar: stewards initialize as `author`; Allies success/failure cannot demote them
- Stage projection remains server-authoritative for editors

---

## 6. Optional degradation

- `optionalStageDiagnostics` consumed for petition (local status message)
- Unavailable ≠ absent; public-safe copy only
- Canonical identity, nav, and Author Mode remain

---

## 7. Hash / URL behavior

| Input | Behavior |
|-------|----------|
| Empty / invalid | Overview fallback |
| `#discussion` | Center Discussion tab (reuses Center-tab; no second Discussion) |
| Selectable stage hash | Open lifecycle panel for that stage |
| Locked stage hash | Overview fallback (not false 404) |
| NOT_APPLICABLE hash | Overview fallback |
| `#manage` | Owner manage tab when allowed |

---

## 8. Revision→Petition regression

Fixture coverage (no staging mutation):

- After Revision publish → current = Petition
- Petition `in_progress` with 0 records (LAZY)
- Absent petition = NOT_CREATED_YET
- Selection does not change current derivation

---

## 9. Analysis compatibility

- Shell does not use legacy Analysis for progression
- `ViewCollaborativeAnalysisLink` → `listPublicInitiativeAnalyses` + shell hash
- Legacy `GET /initiatives/:id/analysis` remains COMPATIBILITY_READ_ONLY for other callers (Decision/Petition pages) — migrate Phase 04 if needed

---

## 10. Legacy routes

| Route | Class | Phase 03 action |
|-------|-------|-----------------|
| `/initiatives/public/:id` | CANONICAL | — |
| `/initiative-analyses/public/:id` | COMPATIBILITY | Existing redirect to shell |
| `/petitions/public/:id` | LEGACY | Redirect to shell `#petition` |
| `/collaborative-analysis/*` | LEGACY | Not broadly deleted; shell is primary |
| Activity-root | LEGACY | Untouched |

---

## 11. Lifecycle Guide read-model

`buildLifecycleGuideReadModel` — read-only: profile, current, selected, completed/available/locked/notApplicable, next, stewardship, diagnostics. No Guide UI built.

---

## 12. Exit criteria

1. One canonical Initiative shell? **YES**  
2. Navigation reads Phase 02 resolver only? **YES**  
3. selectedStage separated from currentStage? **YES**  
4. Author Mode survives optional Allies failure? **YES**  
5. Optional failure degrades locally? **YES**  
6. STANDARD navigation deterministic? **YES**  
7. PUBLIC_CHOICE navigation deterministic? **YES**  
8. Revision→Petition lazy renderable without 500? **YES**  
9. Canonical Analysis primary for shell link? **YES**  
10. Legacy routes cannot govern progression? **YES**  
11. Completed stage review works? **YES**  
12. Invalid/locked/not-applicable navigation predictable? **YES**  

---

## 13. Remaining Phase 04+ risks

1. Remaining legacy Analysis callers (Decision/Petition pages) still use compatibility route.  
2. Full Candidate/PUBLIC_CHOICE UX not built.  
3. Author workflow polish / Revision UX → Phase 04.  
4. Residual optional Experience lookups beyond petition/archive.  
5. Collaborative-analysis Stage-root pages still exist (compatibility).  
6. Creation profile selector deferred.

---

## 14. Safety

No staging writes · no R2 · no migration · nothing committed/pushed/deployed
