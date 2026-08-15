# Initiative Architecture Recovery Roadmap v1.0

**Authority:** This roadmap is governed by, and MUST be executed in accordance with, `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` ("the ADR"). Where this roadmap and the ADR appear to conflict, the ADR controls.

**Evidentiary basis:** `architecture/recovery/INITIATIVE_ARCHITECTURE_RECONCILIATION_REPORT_v1.0.md` ("the reconciliation report").

**Status:** Superseded — see the appended notice at the end of this document. The body below is preserved exactly as originally written, per this repository's Historical Integrity convention; do not edit it further to reflect the supersession.

*(Original status text, preserved for historical record: "Proposed — planning document only. No task in this roadmap has been executed. Creating this document does not modify, delete, rename, or move any application source code, route, or existing document.")*

---

## 1. Recovery Objective

Migrate the Humanity Union platform from its current state of three parallel, partially-contradictory civic-lifecycle pipelines to a single Initiative-anchored architecture, as decided in the ADR, without breaking any behavior currently relied upon by real users, and without a large-bang rewrite. Every phase must leave the system in a fully working, typechecked, linted, tested, and buildable state.

---

## 2. Current-State Summary

(Full detail in the reconciliation report; summarized here for roadmap context.)

- **Initiative pipeline** (`initiatives` + 15 `initiative-*` modules): fully implemented, fully frontend-integrated, wired to search/notifications, but has no automated test suite and uses application-layer-only ancestry validation. This is the platform's actual product today.
- **Activity pipeline** (`activity`, `discussion`, `proposal`, `decision`): fully implemented, Mongo-backed, event-driven (transactional outbox), fully covered by automated tests, but has zero frontend integration — it is invisible to every Member.
- **Older Stage pipeline** (`collaborative-analysis`, `collective-decision`, `petition`, `implementation-commitment`, `implementation`): in-memory, single seeded record, no events, no automated tests, but partially frontend-reachable (view/mutate, not create) and — for 4 of 5 modules — carries a genuine `initiativeId` reference already.
- **Workspace** is split across two mounted, non-communicating modules: `workspace` (event-driven, tested, unused) and `workspace-home` (synchronous, untested, `@deprecated`-labeled, but the only one the frontend calls).
- **Documentation** is internally contradictory: ADR-002 asserts Activity as universal root; `engineering/00_UBIQUITOUS_LANGUAGE.md` and the Activity Technical Audit disagree with each other and with ADR-002 from within the same commit; 268 of 346 documents remain formally unreconciled.

---

## 3. Target Architecture Summary

- **Initiative** is the sole civic root (ADR §7–§11).
- **Activity** becomes a bounded participation-trace recorder, subordinate to Initiative, reusing its existing outbox/event infrastructure (ADR §12).
- **Discussion/Proposal/Decision** (Activity-scoped) are retired as independent roots; their responsibilities remain served exclusively by `initiative-collaborative-analysis`, `initiative-improvement-proposal`, and `initiative-collective-decision` (ADR §14).
- **The older Stage pipeline** is progressively absorbed into its `initiative-*` counterparts, retaining its currently-live mutation UIs until replacements exist (ADR §14).
- **Workspace** converges on one implementation: `workspace`'s event-driven mechanism, populated with `workspace-home`'s Initiative-sourced data model, with `workspace-home` retired only once parity is verified (ADR §13).
- **Documentation** is realigned so that no Accepted document contradicts the ADR (ADR §15).

---

## 4. Migration Phases

| Phase | Name | Objective |
|---|---|---|
| 1 | Establish canonical contracts | Formal ancestry contract + shared validation utility, no behavior change |
| 2 | Add Initiative ancestry and tests | Close ancestry gaps (route-only validation) and add first automated test coverage to the Initiative pipeline |
| 3 | Reconcile Workspace projections | Repoint `workspace` to project Initiative-lifecycle data; verify parity with `workspace-home` |
| 4 | Reuse Activity as participation-trace infrastructure | Retarget Activity's outbox/event machinery to emit Initiative-scoped Member-action events |
| 5 | Reconcile Discussion and Proposal | Retire old-Stage `collaborative-analysis` and Activity-scoped `discussion`/`proposal` once `initiative-collaborative-analysis`/`initiative-improvement-proposal` are confirmed complete replacements |
| 6 | Reconcile Decision and Petition | Upgrade `collective-decision`'s ancestry, consolidate onto `initiative-collective-decision`, keep `petition` as-is but repoint its decision dependency |
| 7 | Reconcile Implementation and Impact | Port old-Stage mutation UIs to `initiative-implementation-commitment`/`initiative-implementation-tracking`/`initiative-public-impact`, then retire old-Stage `implementation-commitment`/`implementation` |
| 8 | Retire legacy routes and modules | Unmount and remove modules confirmed fully superseded and parity-verified in Phases 3–7 |
| 9 | Align documentation and validation | Update ADR registry status, reconcile the 268 pending documents, retire inaccurate self-certifications |
| 10 | Resume product development | Return to feature work on the now-unified Initiative architecture |

---

## 5. Ordered Implementation Tasks

Each task below is intentionally small and independently revertible, per Migration Principle 6. "Prerequisite" references other task IDs in this table.

### Phase 1 — Establish canonical contracts

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P1.1 | Define a shared `InitiativeAncestry` TypeScript contract/type (e.g. in `packages/types`) formalizing "every civic record MUST resolve to one `InitiativeId`" | `packages/types` (additive only) | Low | None | `pnpm typecheck` | Revert the added type file | No |
| P1.2 | Write a shared ancestry-validation utility (`assertInitiativeExists` / `resolveInitiativeAncestry`) usable by all `initiative-*` service layers, without yet wiring it in | New utility module only | Low | P1.1 | `pnpm typecheck`; unit test for the utility itself | Revert new file | No |
| P1.3 | Update `architecture/ARCHITECTURE_DECISION_RECORDS.md` registry entry for ADR-002 to `Status: Superseded`, `Superseded By: ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` | `architecture/ARCHITECTURE_DECISION_RECORDS.md` | Low | ADR accepted | Manual review; Git diff review | Revert single-line status edit | No |

### Phase 2 — Add Initiative ancestry and tests

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P2.1 | Add service-layer ancestry validation to `initiative-comments` and `initiative-support` (currently route-only), using the P1.2 utility | `apps/api/src/modules/initiative-comments`, `apps/api/src/modules/initiative-support` | Low-Medium | P1.2 | New unit tests asserting rejection of invalid `initiativeId`; `pnpm typecheck`; `pnpm lint`; focused test run | Revert service-layer change; route-layer validation remains as fallback | No |
| P2.2 | Add first unit test suite for `initiatives` core module (currently zero automated tests) | `apps/api/src/modules/initiatives` (tests only) | Low | None | New tests pass; `pnpm typecheck` | Delete new test files | No |
| P2.3 | Add unit tests asserting ancestry validation for each of the 8 remaining `initiative-*` downstream modules not yet covered | `apps/api/src/modules/initiative-*` (tests only) | Low | P2.2 pattern established | New tests pass | Delete new test files | No |
| P2.4 | Introduce direct typed `initiativeId` reference (in place of generic `decisionSubjectId`) as an *additive* field on `collective-decision`, populated wherever derivable, without removing the existing field | `apps/api/src/modules/collective-decision` | Medium | P1.1 | `pnpm typecheck`; existing collective-decision tests (if any) continue to pass; new field-population test | Revert additive field; existing field untouched | Additive only — no destructive migration |

### Phase 3 — Reconcile Workspace projections

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P3.1 | Inventory the exact data shape `workspace-home` currently returns to the frontend (field-by-field) as a fixed contract to preserve | `apps/api/src/modules/workspace-home` (read-only inspection, produces a spec doc) | Low | None | Manual review against live frontend usage | N/A (documentation only) | No |
| P3.2 | Extend `workspace`'s event-driven projection to consume Initiative-lifecycle read models directly (bridging read, not yet event-sourced, since Initiative modules do not yet emit domain events) | `apps/api/src/modules/workspace` | Medium | P3.1 | New integration test comparing `workspace` output to the P3.1 contract for a fixture Member | Revert projection change; `workspace` reverts to Activity-only projection | No |
| P3.3 | Side-by-side parity test: for a sample of real seeded Members, assert `workspace`'s output is a superset-or-equal of `workspace-home`'s output | `apps/api/src/modules/workspace`, `workspace-home` (test-only) | Low | P3.2 | New comparison test passes | Delete comparison test | No |
| P3.4 | Repoint the frontend's workspace API client from `/api/v1/workspace/home` to `/api/v1/workspace`, behind confirmation that P3.3 parity holds | `apps/web/src/features/workspace-home/workspace-home-api.ts` (or successor) | Medium-High | P3.3 passing | Manual QA pass on Workspace page; no visual regression | Revert the API client change; `workspace-home` route still mounted | No |
| P3.5 | Mark `workspace-home` route as deprecated-with-a-verified-replacement (only now permitted per Migration Principle 10) and schedule removal in Phase 8 | `apps/api/src/app.ts` (comment/annotation only, not unmounting) | Low | P3.4 verified in production-like environment | Manual review | Revert annotation | No |

### Phase 4 — Reuse Activity as participation-trace infrastructure

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P4.1 | Define the Member-action event contract (e.g. `MemberActionRecorded`) with mandatory `initiativeId`, reusing Activity's existing event-envelope shape | `packages/types` or Activity's event-definitions module (additive) | Low | P1.1 | `pnpm typecheck` | Revert added type | No |
| P4.2 | Emit the new Member-action event from each `initiative-*` service's existing mutation points (join, contribute, submit evidence, support proposal, sign petition, participate in decision, accept commitment, record impact), using Activity's outbox writer | `apps/api/src/modules/initiative-*` (service layer, additive event emission), Activity's outbox writer (reused, not modified) | Medium | P4.1, Phase 2 ancestry tests in place | New tests asserting the event is emitted with correct `initiativeId` on each mutation | Revert emission call sites; core mutation logic unaffected | No |
| P4.3 | Retarget the old `Activity` aggregate's creation entry point to be driven by the new Member-action events instead of standalone client-initiated creation | `apps/api/src/modules/activity` | Medium | P4.2 | Existing Activity test suite adjusted and passing; new integration test confirming Activity records are created from Initiative-scoped actions | Revert retargeting; Activity module continues standalone (previous behavior) until re-attempted | No — existing Activity documents remain valid history |

### Phase 5 — Reconcile Discussion and Proposal

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P5.1 | Confirm (via focused code review, not full audit) that `initiative-collaborative-analysis` and `initiative-improvement-proposal` cover 100% of the product-relevant behavior of old-Stage `collaborative-analysis` and Activity-scoped `discussion`/`proposal` | `initiative-collaborative-analysis`, `initiative-improvement-proposal`, `collaborative-analysis`, `discussion`, `proposal` (read-only review) | Low | None | Written gap analysis; resolves reconciliation report Decision Question Q3 | N/A | No |
| P5.2 | Repoint the one live frontend page (`/collaborative-analysis/[id]`) that currently reads old-Stage `collaborative-analysis` to instead read `initiative-collaborative-analysis` | `apps/web` page + API client | Medium | P5.1 confirms parity | Manual QA on that page; no visual regression | Revert page's data source | Possibly — seeded old-Stage record must have an Initiative-side equivalent created first |
| P5.3 | Unmount old-Stage `collaborative-analysis` route once P5.2 is verified in place and no other caller exists | `apps/api/src/app.ts` | Low | P5.2 | `pnpm build`; confirm no remaining route references | Re-mount the route | No |
| P5.4 | Unmount Activity-scoped `discussion`/`proposal` routes (no frontend caller today; safe once Phase 4's retargeting no longer depends on them) | `apps/api/src/app.ts` | Low | P4.3, P5.1 | `pnpm build` | Re-mount the routes | No |

### Phase 6 — Reconcile Decision and Petition

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P6.1 | Repoint `petition`'s dependency on old-Stage `collective-decision` to instead reference `initiative-collective-decision`'s decision records | `apps/api/src/modules/petition`, `initiative-collective-decision` | Medium | P2.4 (typed ancestry field on collective-decision) | New integration test: petition creation succeeds against an `initiative-collective-decision` record | Revert dependency change; `petition` keeps reading old-Stage decisions | Existing petition/signature records preserved; only the decision-lookup path changes |
| P6.2 | Repoint the one live frontend page reading old-Stage `collective-decision` to read `initiative-collective-decision` instead | `apps/web` page + API client | Medium | P6.1 | Manual QA on that page | Revert page's data source | Possibly — seeded record parity required |
| P6.3 | Unmount Activity-scoped `decision` route (already zero frontend usage; weakest-tested Activity member) | `apps/api/src/app.ts` | Low | P4.3 | `pnpm build` | Re-mount the route | No |
| P6.4 | Unmount old-Stage `collective-decision` route once P6.1–P6.2 verified and `implementation-commitment`/`implementation` (old-Stage) no longer depend on it in-process | `apps/api/src/app.ts` | Medium | P6.2, Phase 7 dependents resolved | `pnpm build`; confirm no remaining in-process calls | Re-mount the route | No |

### Phase 7 — Reconcile Implementation and Impact

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P7.1 | Build the missing UI components for `initiative-implementation-commitment` (contribution/withdrawal mutation forms), mirroring old-Stage `implementation-commitment`'s existing live UI | `apps/web` (new components), `initiative-implementation-commitment` (API already exists) | Medium | Phase 2 ancestry tests | Manual QA: new UI performs equivalent mutations against the Initiative-side API | Remove new components; old-Stage UI remains authoritative | No |
| P7.2 | Build the missing UI components for `initiative-implementation-tracking`/`initiative-public-impact` (achievement/evidence-recording forms), mirroring old-Stage `implementation`'s existing live UI | `apps/web` (new components) | Medium | P7.1 pattern established | Manual QA parity | Remove new components | No |
| P7.3 | Migrate old-Stage `implementation-commitment`/`implementation` seeded/created data into their Initiative-side equivalents | `implementation-commitment`, `implementation`, `initiative-implementation-commitment`, `initiative-implementation-tracking` (data only, one-off script) | Medium-High | P7.1, P7.2 | Record-count and field-level parity check post-migration | Migration script is additive/non-destructive; old-Stage data untouched until Phase 8 | **Yes** — explicit data migration required |
| P7.4 | Repoint frontend from old-Stage `implementation-commitment`/`implementation` UI to the new Initiative-side UI built in P7.1/P7.2 | `apps/web` | Medium | P7.3 | Manual QA; no functionality loss | Revert frontend routing to old-Stage UI | No |
| P7.5 | Unmount old-Stage `implementation-commitment` and `implementation` routes | `apps/api/src/app.ts` | Low | P7.4 | `pnpm build` | Re-mount routes | No |

### Phase 8 — Retire legacy routes and modules

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P8.1 | Remove `workspace-home` module and route, now that `workspace` has verified parity (P3.3–P3.5) | `apps/api/src/modules/workspace-home`, `apps/api/src/app.ts` | Medium | P3.5 | `pnpm build`; full manual QA of Workspace page | Restore module from Git history | No |
| P8.2 | Remove Activity-scoped `discussion`/`proposal`/`decision` bare modules (pending Phase 5/6 resolution of Decision Question Q3) | `apps/api/src/modules/{discussion,proposal,decision}` | Low-Medium | P5.4, P6.3 | `pnpm build` | Restore modules from Git history | No |
| P8.3 | Remove old-Stage `collaborative-analysis`, `collective-decision`, `implementation-commitment`, `implementation` modules | `apps/api/src/modules/{collaborative-analysis,collective-decision,implementation-commitment,implementation}` | Medium | P5.3, P6.4, P7.5 | `pnpm build`; full regression QA pass | Restore modules from Git history | No |
| P8.4 | Remove now-unused seed/bootstrap fixtures tied exclusively to retired modules | Seed/fixture files | Low | P8.1–P8.3 | `pnpm build`; `pnpm test` | Restore fixtures from Git history | No |

### Phase 9 — Align documentation and validation

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P9.1 | Amend `implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md` classification tables per ADR §15 | Documentation only | Low | ADR accepted | Manual editorial review | Revert document edit | No |
| P9.2 | Amend `integration/00_ACTIVITY_ARCHITECTURE_INTEGRATION_REVIEW.md` and `implementation/01_MEMBER_JOURNEY_SPECIFICATION.md` to re-anchor around Initiative | Documentation only | Low | ADR accepted | Manual editorial review | Revert document edit | No |
| P9.3 | Re-issue `engineering/ENGINEERING_DOCUMENTATION_ALIGNMENT_REPORT_v1.0.md` and `ENGINEERING_ARCHITECTURE_CONSISTENCY_REVIEW.md` certifications, corrected | Documentation only | Low | P9.1, P9.2 | Manual editorial review | Revert document edit | No |
| P9.4 | Execute (or re-scope) the remaining waves of `governance/02_DOCUMENTATION_UPDATE_PLAN.md`'s 268-document backlog, re-scoped toward the Initiative-centered model | Documentation only | Low | P9.1–P9.3 | Manual editorial review | Revert document edits | No |
| P9.5 | Add automated architectural validation script(s) enforcing the Initiative Ancestry Invariant (ADR §11) as part of CI/`verify:*` scripts | `scripts/verify-*.ts` | Low-Medium | Phase 2–8 complete | New script passes on the reconciled codebase | Remove new script | No |

### Phase 10 — Resume product development

| ID | Objective | Modules affected | Risk | Prerequisite | Expected validation | Rollback boundary | Data migration? |
|---|---|---|---|---|---|---|---|
| P10.1 | Formal close-out review confirming all validation gates (§8 below) are satisfied | Whole repository (review only) | Low | Phases 1–9 complete | Full `pnpm typecheck && pnpm lint && pnpm build && pnpm test` green run | N/A | No |
| P10.2 | Resume feature backlog under the now-unified Initiative architecture | N/A | N/A | P10.1 | N/A | N/A | N/A |

---

## 6. Dependency Graph

```
Phase 1 (contracts)
   │
   ├──> Phase 2 (ancestry + tests) ──────────────┐
   │                                              │
   ├──> Phase 3 (workspace projection) <──────────┤ (needs P2 ancestry patterns for confidence,
   │        │                                     │  not strictly blocking)
   │        └──> P3.5 (mark workspace-home        │
   │             deprecated w/ verified repl.)     │
   │                  │                            │
   ├──> Phase 4 (activity → participation trace)   │
   │        │                                      │
   │        ├──> Phase 5 (discussion/proposal) ────┤
   │        │        │                             │
   │        └──> Phase 6 (decision/petition) ──────┤
   │                 │  (needs P2.4 typed ancestry) │
   │                 └──> Phase 7 (impl./impact) ───┤
   │                          │                     │
   └──────────────────────────┴──> Phase 8 (retire legacy)
                                        │
                                        └──> Phase 9 (docs) ──> Phase 10 (resume dev)
```

**Critical path:** Phase 1 → Phase 2 → Phase 4 → Phase 6 (needs P2.4) → Phase 7 → Phase 8 → Phase 9 → Phase 10.
**Parallelizable side branch:** Phase 3 (Workspace) can proceed in parallel with Phases 4–7 once Phase 1–2 land, since it depends on Initiative read models, not on Activity/Decision/Implementation reconciliation specifically — but Phase 8's removal of `workspace-home` still waits on Phase 3's own parity gate (P3.3–P3.5), not on Phases 4–7.
**Documentation task P1.3** (ADR-002 status update) has no code dependency and MAY be executed immediately upon ADR acceptance.

---

## 7. Risk Register

| Risk | Likelihood | Impact | Phase(s) affected | Mitigation |
|---|---|---|---|---|
| Breaking the live Workspace experience by retiring `workspace-home` prematurely | Medium | High | 3, 8 | Mandatory parity test (P3.3) gates P3.4/P3.5/P8.1; Migration Principle 10 |
| Silent runtime breakage from application-layer-only integrity checks (no DB foreign keys) | Medium | High | All | Phase 2 adds explicit ancestry tests before any retirement; Migration Principle 3 |
| Data loss from old-Stage `implementation`/`implementation-commitment` retirement | Low-Medium | High | 7 | Explicit, verified, non-destructive migration step (P7.3) before any deletion |
| Search/notification blind spots for newly-canonicalized modules | Low | Medium | 3–8 | `global-search`/`notifications` resolver updates included as implicit sub-steps of each phase; verified in P9.5 |
| Governance confusion from two "Accepted" ADRs appearing to conflict | Low | Medium | 1, 9 | P1.3 updates the registry immediately upon ADR acceptance |
| Scope creep — treating this migration as a rewrite opportunity | Medium | Medium | All | Migration Principles 5–6; each task ID above has one bounded objective |
| Frontend regression from repointing API clients (P3.4, P5.2, P6.2, P7.4) | Medium | Medium | 3, 5, 6, 7 | Manual QA gate on each repointing task; old route stays mounted until verified |
| Decision Question Q3 (discussion/proposal disposition) left unresolved, blocking Phase 5/8 | Medium | Low-Medium | 5, 8 | P5.1 explicitly forces this resolution before any retirement action |
| Documentation backlog (268 documents) never completing | High | Low (governance, not functional) | 9 | Re-scoped, ADR-anchored plan (P9.4); tracked separately from functional migration |

---

## 8. Validation Gates

No phase may be considered complete, and no dependent phase may begin, until its gate passes:

| Phase | Gate |
|---|---|
| 1 | `pnpm typecheck` passes with new contract types; ADR-002 registry status updated |
| 2 | New ancestry-validation unit tests pass for all 17 Initiative-pipeline modules (`initiatives` + 15 `initiative-*` + comments/support fix); `pnpm typecheck`, `pnpm lint` |
| 3 | Parity test (P3.3) shows `workspace` output ⊇ `workspace-home` output for sample Members; manual QA sign-off on live Workspace page after P3.4 |
| 4 | New Member-action events verified emitted with correct `initiativeId` for every listed action type; existing Activity test suite still green |
| 5 | Gap analysis (P5.1) documented; manual QA sign-off on repointed collaborative-analysis page; `pnpm build` after route unmounts |
| 6 | Integration test confirms petition creation against `initiative-collective-decision`; manual QA sign-off on repointed decision page; `pnpm build` after route unmounts |
| 7 | New UI components verified functionally equivalent to old-Stage UI; data migration (P7.3) record-count/field parity confirmed; manual QA sign-off |
| 8 | Full regression QA pass across all previously-live pages; `pnpm build`, `pnpm test` green after each module removal |
| 9 | No remaining Accepted document contradicts the ADR (manual editorial review); new architectural validation script (P9.5) passes |
| 10 | `pnpm typecheck && pnpm lint && pnpm build && pnpm test` all green in a single run; sign-off review completed |

Every phase additionally requires, per Migration Principle 7: `pnpm typecheck`, `pnpm lint`, the relevant focused test subset, `pnpm build`, and a Git review of the specific diff — before merge, not just before phase close-out.

---

## 9. Rollback Rules

1. **Every task is independently revertible.** No task may be structured such that reverting it requires reverting a later, unrelated task.
2. **Route unmounting is the last step, never the first.** A route MUST NOT be unmounted until its replacement has passed its phase's validation gate (§8) and, where applicable, its frontend consumer has been repointed and QA'd.
3. **Data migrations MUST be additive/non-destructive until the corresponding retirement task's own gate passes.** Source records MUST NOT be deleted in the same task that migrates them; deletion (if ever performed) is a separate, later, explicitly-scoped task outside this roadmap's Phase 1–10 sequence.
4. **Any task that fails its validation gate MUST be reverted, not patched forward, unless the fix is trivial and reviewed within the same task's scope.**
5. **Git history is the rollback mechanism for module removals** (Phase 8) — no module is to be deleted without being fully committed and reviewable beforehand, so `git revert`/`git checkout` can restore it.
6. **Workspace migration (Phase 3, Phase 8/P8.1) has an explicit rollback boundary:** if parity issues are discovered after P3.4 (frontend repointed) but before P8.1 (old module removed), the frontend API client change (P3.4) can be reverted independently, since `workspace-home` remains mounted until P8.1.
7. **No rollback rule in this roadmap authorizes force-pushes, history rewriting, or skipping Git review**, consistent with standard repository safety practice.

---

## 10. Documentation Update Backlog

Beyond the amendments already scoped as Phase 9 tasks (P9.1–P9.4), the following documentation-governance items are tracked for completeness but are explicitly **not** implementation tasks:

1. Update `architecture/ARCHITECTURE_DECISION_RECORDS.md` registry entry for this new ADR itself (add it to the registry's index, per the registry's own contribution rules) — distinct from the ADR-002 status update in P1.3.
2. Reconcile `blueprint/BLUEPRINT_CHANGELOG.md` to record this ADR's issuance.
3. Update `governance/00_DOCUMENTATION_AUDIT.md`'s conflict tally once P9.1–P9.4 land.
4. Cross-reference this ADR from `PLATFORM_ARCHITECTURE_BASELINE_V1.md` and `PLATFORM_CAPABILITY_MAP.md` (currently correct in substance but silent on this ADR's existence).
5. Re-run and correct `engineering/ENGINEERING_DOCUMENTATION_ALIGNMENT_REPORT_v1.0.md` and `ENGINEERING_ARCHITECTURE_CONSISTENCY_REVIEW.md` (tracked in P9.3, restated here for backlog completeness).
6. Continue execution of the remaining `governance/02_DOCUMENTATION_UPDATE_PLAN.md` waves (268 pending documents), re-scoped per P9.4.
7. Resolve reconciliation-report Decision Questions Q1, Q3, Q4, and Q5 formally (each as a short addendum note or follow-up micro-ADR, not a rewrite of this ADR), as their resolutions are consumed by Phases 4–7 respectively.

---

## 11. Completion Criteria

This recovery effort is complete when **all** of the following hold simultaneously:

1. Exactly one mounted, canonical implementation exists for each lifecycle stage: Initiative, Collaboration/Discussion, Proposal, Collective Decision, Petition, Implementation Commitment, Implementation, Impact, and Workspace.
2. Every civic record in the system satisfies the Initiative Ancestry Invariant (ADR §11), verified by the automated validation script introduced in P9.5.
3. No route is mounted solely for legacy compatibility without an active retirement plan; all modules classified Legacy (D) or Transitional (C) in ADR §14 have either been retired (Phase 8) or had their classification formally revised.
4. Activity operates exclusively in its redefined bounded role (ADR §8/§12) — as a participation-trace recorder feeding Workspace/notifications/Social Activity Score — with no residual code path treating it as an independent civic root.
5. `pnpm typecheck && pnpm lint && pnpm build && pnpm test` all pass in a single clean run.
6. No Accepted or Approved document in the repository contains a normative statement contradicting the ADR (verified via the Phase 9 documentation review).
7. The ADR registry (`architecture/ARCHITECTURE_DECISION_RECORDS.md`) correctly reflects this ADR as Accepted and ADR-002 as Superseded.
8. Product development resumes (Phase 10) on a single, unambiguous civic-lifecycle architecture, with no known parallel pipeline remaining.

---

## 12. Supersession Notice (Appended — Does Not Reopen §1–§11)

**This roadmap is superseded by `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md`.** Nothing in §1–§11 above is edited, reopened, or reinterpreted by this notice; it is appended, per this repository's Historical Integrity convention, to record what actually happened against what this roadmap planned.

**What actually executed, as Recovery Tasks 01–33 (per `architecture/recovery/RECOVERY_STATUS.md`, the authoritative closure record):**

- **Phase 1** (contracts) — complete: shared `InitiativeAncestry` contract and validator, ADR-002 status update.
- **Phase 2** (ancestry + tests) — complete: ancestry validation and tests added across every `initiative-*` module plus `decision-session` and `participation-area`.
- **Phase 4** (Activity → participation trace) — **not executed as planned.** Task 20's discovery found `activity` structurally unsuitable to become the ledger's persistence owner (see that task's findings, and `ADR-MEMBER-ACTION-LEDGER-v1.0.md` §12/§17 for the explicit divergence this roadmap's own §4 anticipated might occur). A **different** decision was made instead: a new, dedicated Participant Action Ledger (not a retargeted `activity`), populated by Petition and Vote as its first two durable producers.
- **Phases 3, 5, 6 (beyond Petition), 7, 8, 9** — **not executed.** Workspace reconciliation, Discussion/Proposal retirement, Decision/old-Stage consolidation, Implementation/Impact UI migration, legacy module retirement, and documentation-backlog alignment all remain open.
- **Phase 10** (resume product development) — the successor condition is satisfied by a different route than this roadmap anticipated: not by completing Phases 1–9 as specified here, but by the Recovery Closure Task's baseline review, which found the *narrower* completed scope (Phases 1–2 plus the pivoted ledger pilot) sufficient to close the Recovery Phase and open the Architecture Evolution Phase.

**Governing successor document:** `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md`, which defines the platform's forward roadmap (Stages I–V, the Architecture Assessment Pipeline, and the Approved Assessment Backlog) independently of this roadmap's now-abandoned Phase 3–9 sequencing. Any future work on Workspace, Discussion/Proposal, old-Stage module retirement, or documentation-backlog alignment must be re-scoped under the v2.0 roadmap's own assessment process, not resumed directly from this document's Phase 3–9 task tables.
