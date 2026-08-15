# ADR — Initiative as the Canonical Civic Root of the Humanity Union Platform

## 1. Title

**Initiative Is the Canonical Civic Root of the Humanity Union Platform**

---

## 2. Status

**Accepted**

---

## 3. Date

2026-07-28

---

## 4. Decision Authority

| Field | Value |
|---|---|
| **Decision Owner** | Humanity Union Product Owner (authoritative product directive, current task) |
| **Architectural Authority** | This ADR is entered into the `architecture/ARCHITECTURE_DECISION_RECORDS.md` registry's authority chain. Per that registry's own rules ("Explicit Supersession": *"A replaced decision SHALL be marked `Superseded`. The replacing ADR SHALL be identified explicitly."*) and per `implementation/01_MEMBER_JOURNEY_SPECIFICATION.md`'s own stated authority order (`Constitution → Blueprint → Engineering Standards → ADRs → MVP Implementation Strategy → Member Journey Specification → UI Design → Source Code`), an Accepted ADR outranks the Member Journey Specification, the Activity Technical Audit, and any Implementation-layer document. |
| **Evidentiary Basis** | `architecture/recovery/INITIATIVE_ARCHITECTURE_RECONCILIATION_REPORT_v1.0.md` (primary evidence source for this ADR) |
| **Related Blueprint Documents** | `blueprint/17_PROPOSAL_AND_MEMBER_SIGNAL_FRAMEWORK.md`, `blueprint/09_WORKSPACE_ARCHITECTURE.md`, `capabilities/02_participation/*`, `PLATFORM_ARCHITECTURE_BASELINE_V1.md` |
| **Supersedes** | ADR-002 ("Activity as Universal Starting Object") — see §15 |
| **Superseded By** | None |

---

## 5. Context

Repository investigation (`architecture/recovery/INITIATIVE_ARCHITECTURE_RECONCILIATION_REPORT_v1.0.md`) established that three parallel, largely non-communicating civic-lifecycle pipelines coexist in the codebase:

1. **Initiative-centered "Capability-02" pipeline** — `apps/api/src/modules/initiatives` plus 15 `initiative-*` downstream modules. Built first (2026-07-01 → 2026-07-07), fully wired to the shipped frontend, search, and notifications. Enforces referential integrity via application-layer `getInitiativeById()` lookups (no database foreign keys exist anywhere in the system).
2. **Older "Stage" pipeline** — `collaborative-analysis`, `collective-decision`, `petition`, `implementation-commitment`, `implementation`. In-memory, single seeded bootstrap record, no domain events, no automated tests, but genuinely frontend-reachable for viewing/mutating (not creating) records, and mostly (4 of 5 modules) directly and strongly typed to `initiativeId`.
3. **Activity pipeline** — `apps/api/src/modules/{activity,discussion,proposal,decision}`. The newest code (added 2026-07-26), Mongo-backed, transactional-outbox event-driven, fully covered by the real `npm test` suite, but with **zero frontend integration of any kind**.

The repository's documentation is itself internally contradictory about which entity is canonical. A single commit (`a722b9f`, 2026-07-26, the commit immediately prior to this task's investigation) added an entire "Blueprint v2.0" documentation corpus including **ADR-002 — "Activity as Universal Starting Object"** (Status: Accepted, un-superseded), which states: *"Activity is the universal starting object for meaningful civic participation. Every significant civic interaction SHALL begin with an Activity… Parallel civic entry objects SHALL NOT emerge."* ADR-002's own "Alternatives Considered" table never evaluates or mentions Initiative, despite Initiative being a live, working, 11-module aggregate already present in the repository when ADR-002 was authored.

The same commit, however, also added `engineering/00_UBIQUITOUS_LANGUAGE.md` v2.0 (self-declared: *"All future engineering artefacts must conform to the terminology defined here"*), whose Section 15 "Concept Evolution" table explicitly frames **"Activity-centric collaboration"** as superseded **Version 1.x** terminology and **"Initiative-centric collaboration"** as the canonical **Version 2.0** replacement — directly contradicting ADR-002 from within the same documentation drop. `implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md` (also the same commit) resolves this tension unilaterally, by fiat rather than by ADR, classifying the entire Initiative pipeline "LEGACY — ISOLATE" while simultaneously mandating *"The Initiative-centered civic chain SHALL NOT be removed during MVP implementation."* `blueprint/17_PROPOSAL_AND_MEMBER_SIGNAL_FRAMEWORK.md` and `blueprint/09_WORKSPACE_ARCHITECTURE.md`, also from the identical commit, independently describe an Initiative-anchored lifecycle (*"Every Proposal belongs to an Initiative. A Proposal cannot exist independently from an Initiative"*), again contradicting ADR-002. `governance/02_DOCUMENTATION_UPDATE_PLAN.md` confirms 268 of 346 repository documents remain unreconciled, on a still-unexecuted 4–6 month plan.

The product owner has now issued an authoritative directive resolving this ambiguity: **Initiative is the central civic entity of the platform.** This ADR converts that directive into a precise, implementation-safe architectural decision.

---

## 6. Problem Statement

The repository cannot safely proceed with further implementation while:

1. Two formally "Accepted"/"Approved" documents (ADR-002 and the Activity Technical Audit) assert an architecture that contradicts the product owner's directive and contradicts sibling documents from their own commit.
2. Three independently-persisted implementations exist for overlapping civic concepts (at least three "Decision" aggregates, two "Analysis" aggregates, two "Proposal" aggregates, two "ImplementationCommitment" aggregates), with no formal statement of which is canonical.
3. Two parallel "Workspace" endpoints are mounted simultaneously (`GET /api/v1/workspace`, self-labeled canonical, fed only by the unused Activity pipeline; `GET /api/v1/workspace/home`, self-labeled `@deprecated`, fed only by the Initiative pipeline and the *only* one the shipped frontend calls) — a direct contradiction between source-code labels and actual product behavior.
4. No governing document formally states what "Initiative ancestry" means, how it must be enforced, or what Activity's bounded role is if it is not the civic root.

Without resolving these four points, any further engineering work risks building on the wrong aggregate, duplicating already-duplicated concepts further, or silently breaking the one Workspace surface real users depend on.

---

## 7. Decision

**Initiative SHALL be the single canonical civic root of the Humanity Union platform.**

Every meaningful unit of civic work — collaboration, discussion, contribution, evidence, AI assistance, support-group activity, promotion, proposal, petition, collective decision, implementation, and public impact — MUST be directly or transitively traceable to exactly one Initiative.

No Discussion, Proposal, Petition, Decision, Implementation, or Impact record MAY exist as, or become, an independent civic root. Any record of these types MUST carry, or be derivable through an unbroken reference chain to, a validated `initiativeId`.

Activity MUST NOT remain, and MUST NOT be re-introduced in any future work, as an alternative or parallel civic root. Activity MAY continue to exist strictly as a bounded, subordinate participation-trace concept, as defined in §12.

This decision applies platform-wide: to identity, ownership, lifecycle, traceability, collaboration, governance, implementation, impact, workspace projections, notifications, search, and public projections, as detailed in §8–§13.

This ADR does not, by itself, delete, rename, or modify any module, route, or document. It establishes the target architecture and governing invariant against which the migration plan in the companion roadmap (`architecture/recovery/INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md`) MUST be executed.

---

## 8. Canonical Definitions

### Initiative

Initiative MUST be understood as:

- **The durable civic object.** An Initiative is a persistent, long-lived aggregate representing a concern, cause, or proposed course of civic action. It is not a transient event or a log entry.
- **The owner of the complete civic lifecycle.** Every stage of civic progress — from first articulation through collaboration, decision, implementation, and impact — is scoped to exactly one Initiative.
- **The source of civic context.** Any downstream record (a Discussion, a Proposal, a Decision, an Implementation Commitment, an Impact observation) derives its meaning, scope, and eligibility rules from the Initiative it belongs to.
- **The primary entity surfaced to Members.** Search results, navigation, notifications, and the Workspace MUST organize civic information around Initiatives as the primary unit, not around individual Activity, Discussion, Proposal, or Decision records in isolation.

### Activity

Activity MUST be redefined, from this ADR forward, as:

> **Activity is a traceable record of a meaningful Member action performed within the lifecycle of an Initiative.**

Activity is not itself a civic lifecycle. It is a record *about* something that happened within an Initiative's lifecycle. Representative examples: joined an Initiative; added a contribution; submitted evidence; supported a proposal; signed a petition; participated in a decision; accepted an implementation commitment; recorded an impact observation.

Under this definition:

- Activity MUST NOT own Discussion.
- Activity MUST NOT own Proposal.
- Activity MUST NOT own Decision.
- Activity MUST NOT start or imply a parallel lifecycle independent of Initiative.
- Activity MAY support audit history, participation history, Workspace feeds, notifications, and Social Activity Score calculations, each of which reads from Initiative-scoped events rather than substituting for them.

This target meaning is adopted as the safest default per the task's own instruction, because it preserves the Activity pipeline's genuinely reusable engineering investment (see §12) while eliminating its architectural role as a competing root.

### Discussion, Proposal, Petition, Collective Decision, Implementation, Impact

Each of these MUST be understood as a **civic artifact or lifecycle stage attached to exactly one Initiative** — never as an independently-rooted entity. See §9 for the canonical lifecycle and §10 for aggregate ownership rules.

---

## 9. Canonical Lifecycle

The canonical Initiative lifecycle, reconciling product intent with the repository's own most Initiative-consistent documents (`PARTICIPATION_PIPELINE.md`, `blueprint/17_PROPOSAL_AND_MEMBER_SIGNAL_FRAMEWORK.md`) and the currently-implemented `initiative-*` module chain, is:

```
Initiative
   → Collaboration / Discussion   (collaborative analysis: contributions, evidence, signals)
   → Contributions and Evidence   (part of Collaboration, not a separate root)
   → Proposal                     (Improvement Proposal, scoped to a published Collaborative Analysis)
   → Collective Decision          (via a Decision Session, when formal decision-making is warranted)
   → Petition, where applicable   (public endorsement, only after an approved Collective Decision)
   → Implementation Commitment
   → Implementation
   → Impact
```

| Stage | Responsibility | Parent relationship | Minimum required Initiative reference | Mandatory or optional | May have its own aggregate identity? | May exist independently? |
|---|---|---|---|---|---|---|
| **Initiative** | Root civic object; scope, stewardship, lifecycle phase | None (root) | Self | Mandatory (the root) | Yes — it is the aggregate root | N/A |
| **Collaboration / Discussion (Collaborative Analysis)** | Structured understanding-building: contributions, evidence, signals | Child of Initiative | Direct, typed `initiativeId` | Optional per Initiative, but required before Proposal | Yes, as a bounded child aggregate | No — MUST NOT exist without a validated parent Initiative |
| **Contributions and Evidence** | Individual inputs within Collaboration | Child of Collaborative Analysis (transitively of Initiative) | Transitive, via Collaborative Analysis | Optional | No — entity within Collaborative Analysis, not a separate aggregate root | No |
| **Proposal** | Formal recommendation derived from Collaboration | Child of Initiative, scoped by a published Collaborative Analysis | Direct or derived (from `analysisId → initiativeId`), never independently client-supplied | Optional — not every Initiative requires a formal Proposal | MAY have its own aggregate identity for lifecycle tracking (draft/submitted/decided), but MUST NOT be a standalone civic root | No |
| **Collective Decision** (via Decision Session) | Structured, eligibility-gated decision process | Child of Initiative, via a Decision Session | Direct, typed `initiativeId` + `decisionSessionId` | Optional — formal collective decision-making is not mandatory for every Initiative | Yes, as a bounded child aggregate | No |
| **Petition** | Public endorsement of an approved Collective Decision | Child of Initiative, gated by an approved Collective Decision | Direct, typed `initiativeId` (and `collectiveDecisionId`) | **Optional, not mandatory** — Petition MUST NOT be required for every Initiative | Yes, as a bounded child aggregate | No |
| **Implementation Commitment** | Capacity/readiness to execute | Child of Initiative, gated by a closed Collective Decision | Direct, typed `initiativeId` + `decisionId` | Optional — only Initiatives that reach execution require this | Yes, as a bounded child aggregate | No |
| **Implementation** | Execution tracking: phases, milestones, achievements, evidence | Child of Initiative, via Implementation Commitment | Direct or derived `initiativeId` | Optional | Yes, as a bounded child aggregate | No |
| **Impact** | Verified outcome observation | Child of Initiative, via Implementation Tracking | Derived `initiativeId` | Optional | Yes, as a bounded child aggregate | No |

**Binding clarifications, per product direction:**

- Not every Initiative MUST traverse every stage. An Initiative MAY remain at Collaboration indefinitely, or conclude without a formal Decision, Petition, or Implementation.
- Petition MUST NOT be mandatory. It is one optional public-endorsement mechanism among the lifecycle's later stages, not a required gate.
- Proposal and Petition MUST NOT be treated as, or re-implemented as, separate civic roots. Each MUST carry provable Initiative ancestry.
- Human authority remains sovereign at every decision-bearing stage; AI-assisted tooling (workspace-assistant, AI facilitation) remains advisory only and MUST NOT possess decision authority, consistent with the existing, non-conflicting Blueprint principle (ADR-005 equivalent).
- Partial participation paths (an Initiative that only ever reaches Collaboration, or only reaches Collective Decision without a Petition) remain fully valid and MUST be supported, not treated as incomplete or erroneous.
- The full history of every stage a given Initiative does traverse MUST remain traceable back to that Initiative, regardless of which optional stages were used.

---

## 10. Aggregate Ownership Rules

1. **Initiative is the only entity that MAY be an independent aggregate root with no required parent reference.** Every other civic aggregate in this lifecycle MUST carry a direct or transitively-derivable `initiativeId`.
2. **Direct typed reference is preferred over derived reference**, and derived reference is preferred over untyped/generic reference. Concretely, in descending order of acceptability:
   - Direct, statically-typed `initiativeId: InitiativeId` field, validated at creation via an existence + eligibility lookup (the pattern used by `initiative-collaborative-analysis`, `decision-session`, `initiative-collective-decision`, `petition`, `implementation-commitment`, `implementation`).
   - Derived `initiativeId`, computed server-side from an already-validated parent reference rather than trusted from client input (the pattern used by `initiative-improvement-proposal` via `analysisId`, `initiative-implementation-tracking` via `commitmentId`, `initiative-public-impact` via `trackingId`).
   - Generic, untyped subject reference (`decisionSubjectId: string` with a `decisionSubjectType` enum) — this pattern, used by the older-Stage `collective-decision` module, is a **weaker** form of ancestry and SHALL be upgraded to a direct typed reference during migration (see roadmap Phase 5–6).
   - No reference at all — this pattern MUST NOT be introduced for any new module and MUST be corrected wherever it exists today (`initiative-comments` and `initiative-support` currently validate `initiativeId` only at the Express route boundary, not inside the service layer — this is a gap to close, not a pattern to replicate).
3. **No new database foreign keys are mandated by this ADR** (the current architecture uses application-layer integrity checks throughout, and this ADR does not require introducing a relational database). However, every service function that mutates a civic-lifecycle aggregate MUST itself validate Initiative ancestry — reliance on the route layer alone (as `initiative-comments`/`initiative-support` currently do) SHALL be treated as a defect to remediate, not an acceptable long-term pattern.
4. **Cross-cutting services** (`notifications`, `global-search`, `workspace`) MUST resolve `initiativeId` for every civic record they process, using the existing `resolveInitiativeIdFromEntity`-style pattern already implemented in `notifications`, extended to cover any additional lifecycle stage introduced in the future.

---

## 11. Initiative Ancestry Invariant

**Binding invariant:** For any civic record `R` in the system (Discussion, Contribution, Evidence, Proposal, Collective Decision, Petition, Implementation Commitment, Implementation, Impact, or any future lifecycle stage record), there MUST exist a resolvable, non-circular reference chain `R → … → Initiative` such that:

- The chain terminates at exactly one Initiative.
- Every link in the chain is validated (existence-checked) at the time `R` is created or mutated, not merely assumed.
- The chain is resolvable by at least one of: a direct `initiativeId` field on `R`; a derived `initiativeId` computed from an already-validated parent; or (during migration only, see roadmap) a generic subject reference explicitly flagged for upgrade.

**No exceptions.** A civic record that cannot satisfy this invariant MUST NOT be classified as part of the canonical Initiative lifecycle; it MUST instead be classified per §14 as Legacy, Transitional, or Requires-a-separate-product-decision, pending remediation or retirement.

This invariant does not require immediate code changes. It defines the acceptance criterion that the migration roadmap's Phase 2 ("Add Initiative ancestry and tests") MUST verify for every existing module, and that any new module proposed after this ADR MUST satisfy from inception.

---

## 12. Activity Target Role

Activity's target role is defined in §8. This section documents the conflict between that target role and the currently-implemented Activity infrastructure, as required by the task.

**Documented conflict:** The currently-implemented `apps/api/src/modules/{activity,discussion,proposal,decision}` chain does not implement Activity as a bounded participation-trace concept. Instead, it implements Activity as the root of its own four-stage lifecycle (`Activity → Discussion → Proposal → Decision`), structurally parallel to, and with zero code-level cross-reference to, Initiative. This is a direct conflict with the target role defined in §8: today's `Activity` aggregate does not record "a meaningful Member action performed within the lifecycle of an Initiative" — it records the *start* of an entirely separate, un-anchored lifecycle.

**Resolution directive:** This conflict MUST be resolved by migration, not by immediate deletion. Specifically:

- The Activity pipeline's **aggregate model** (an `Activity` record that itself roots `Discussion`/`Proposal`/`Decision`) MUST be retired as a civic root. Its four-stage lifecycle MUST NOT be extended, promoted, or relied upon as a parallel path to Initiative.
- The Activity pipeline's **infrastructure** — the transactional outbox pattern, the domain-event envelope (correlation/causation metadata), the idempotent handler-registry dispatch, and its associated automated test suite — is genuinely reusable and SHOULD be retargeted to serve the redefined Activity role: emitting a `MemberActionRecorded`-class event (or equivalent) whenever a Member performs a meaningful action within an Initiative's lifecycle (joining, contributing, supporting, signing, deciding, committing, observing impact), with `initiativeId` as a mandatory field on every such event.
- `discussion` and `proposal` (Activity-scoped) MUST NOT be retained as independent aggregates under the redefined model; their responsibilities are already covered by `initiative-collaborative-analysis` (discussion/collaboration) and `initiative-improvement-proposal` (proposal), which already carry proper Initiative ancestry. Their disposition is addressed further in the companion roadmap and remains subject to the Decision Questions raised in the reconciliation report (specifically Q3), since whether any residual capability in `discussion`/`proposal` is worth preserving as reusable infrastructure versus retiring outright is a narrower engineering judgment outside this ADR's scope.
- `decision` (Activity-scoped) MUST NOT be retained as an independent civic-decision root; `initiative-collective-decision` is the canonical Decision implementation per §14.

---

## 13. Workspace Target Role

**Workspace is the Member's operational home.** It MUST present a unified, Initiative-centered operational view of the Member's civic life, regardless of which backend module currently produces that view.

The target Workspace MUST surface:

- the state of the Member's Initiatives (owned and participated-in);
- collaboration updates (new contributions, evidence, or analysis activity within Initiatives the Member follows or stewards);
- discussions/collaborative analyses requiring the Member's attention;
- proposal and petition progress;
- collective decision results and open decisions requiring participation;
- implementation commitments and their status;
- impact updates;
- relevant notifications;
- available next civic actions (a call-to-action surface derived from lifecycle state, not a separate data model).

**Resolution of the `workspace` vs. `workspace-home` contradiction:**

- `apps/api/src/modules/workspace-home` currently implements the actual product experience described above (it is Initiative-sourced and is the only endpoint the shipped frontend calls), but is self-labeled `@deprecated` in its own source comment and is classified "LEGACY — ISOLATE" by `implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md`.
- `apps/api/src/modules/workspace` currently implements a well-architected, event-driven, tested projection pattern (transactional-outbox-fed, idempotent, replay-capable), but is fed exclusively by the unused Activity pipeline and has zero frontend callers.
- **This ADR determines the target responsibility as follows, based on product experience, actual frontend use, Initiative-centered architecture, and reusable projection infrastructure — not on which module is currently labeled canonical or deprecated:**
  - The target Workspace's **data model and product surface** MUST be the one presently implemented by `workspace-home` (Initiative-sourced: My Initiatives, Collaborative Analyses, Improvement Proposals, Decision Sessions/Collective Decisions, Implementation Commitments/Tracking, Public Impact).
  - The target Workspace's **technical implementation pattern** SHOULD be the one presently implemented by `workspace` (event-driven projection via the transactional outbox), because it is the only tested, replay-capable, idempotent projection mechanism in the repository. The synchronous, direct-read pattern currently used by `workspace-home` does not scale and has no event trail.
  - **Directive:** `workspace` (the module) SHOULD absorb `workspace-home`'s data responsibilities by being re-pointed to project from Initiative-lifecycle events (once those events exist, per §12's Activity-infrastructure-reuse directive and roadmap Phase 3) rather than from the Activity pipeline's events. `workspace-home` (the module) SHOULD then be retired once `workspace` demonstrably produces equivalent or superior output and the frontend has been migrated to call it. This ADR does not implement this merge; it is scoped to the recovery roadmap (Phase 3).
  - Until that migration completes, `workspace-home`'s route MUST remain mounted and MUST NOT be removed or marked deprecated-and-scheduled-for-deletion in a way that risks its removal before `workspace` is a verified, equivalent replacement (Migration Principle 10, §16).

---

## 14. Existing Module Classification

This classification is authoritative for planning purposes and supersedes the "LEGACY — ISOLATE" labeling applied to Initiative-pipeline modules by `implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md`. No module is modified, deleted, or renamed by virtue of this classification; the roadmap governs sequencing.

**Legend:** A = Canonical (retain as primary implementation) · B = Reusable (adapt into Initiative lifecycle) · C = Transitional (temporarily retain during migration) · D = Legacy (isolate, later retire) · E = Cross-cutting (retain independently) · F = Requires a separate product decision

| Module | Path | Class | Target responsibility | Migration dependency | Route must remain temporarily? | Frontend currently depends on it? | Confidence |
|---|---|---|---|---|---|---|---|
| `initiatives` | `apps/api/src/modules/initiatives` | **A** | Canonical Initiative aggregate root | None — already canonical | Yes (permanently) | Yes, fully | High |
| `activity` | `apps/api/src/modules/activity` | **B** | Infrastructure donor: retarget as the Member-action/participation-trace recorder defined in §12 | Depends on Initiative-lifecycle events existing to record against (Phase 4) | Yes, until retargeted | No | Medium |
| `discussion` | `apps/api/src/modules/discussion` | **F** | Superseded in role by `initiative-collaborative-analysis`; whether any residual capability is worth porting is a narrower product/engineering decision outside this ADR | Depends on Q3 resolution (reconciliation report) | Yes, until resolved | No | Medium |
| `proposal` (Activity-scoped) | `apps/api/src/modules/proposal` | **F** | Superseded in role by `initiative-improvement-proposal`; disposition requires Q3 resolution | Depends on Q3 resolution | Yes, until resolved | No | Medium |
| `decision` (Activity-scoped) | `apps/api/src/modules/decision` | **D** | Superseded by `initiative-collective-decision`; weakest-tested member of the Activity chain | Retire after Activity pipeline retargeting (Phase 4/8) | Yes, until Phase 8 | No | Medium |
| `collaborative-analysis` (older Stage) | `apps/api/src/modules/collaborative-analysis` | **D** | Superseded by `initiative-collaborative-analysis`; duplicate implementation | The `/collaborative-analysis/[id]` frontend page must be repointed first | Yes, until frontend repointed (Phase 5) | Yes — one live page reads it | High |
| `initiative-collaborative-analysis` | `apps/api/src/modules/initiative-collaborative-analysis` | **A** | Canonical Collaboration/Discussion stage | None | Yes | Yes (partially) | High |
| `initiative-improvement-proposal` | `apps/api/src/modules/initiative-improvement-proposal` | **A** | Canonical Proposal stage | None | Yes | Yes, fully | High |
| `decision-session` | `apps/api/src/modules/decision-session` | **A** | Canonical decision-preparation stage (eligibility, packaging) | None | Yes | Yes (read path); creation UI is orphaned dead code, not a backend gap | High |
| `collective-decision` (older Stage) | `apps/api/src/modules/collective-decision` | **D** | Superseded by `initiative-collective-decision`; weaker (untyped) Initiative reference | `petition`, `implementation-commitment`, `implementation` (old Stage) still call into it in-process — those dependents must be resolved first | Yes, until Phase 6 | Yes — one live page reads it | High |
| `initiative-collective-decision` | `apps/api/src/modules/initiative-collective-decision` | **A** | Canonical Collective Decision stage | None | Yes | Yes (partially — no vote-casting UI wired yet) | High |
| `petition` | `apps/api/src/modules/petition` | **A** | Canonical Petition stage (sole implementation; no competing `initiative-petition` module exists) | Its typed `initiativeId` reference already satisfies §11; only its coupling to old-Stage `collective-decision` needs remediation (Phase 6) | Yes, permanently | Yes, fully (public + signing) | Medium-High |
| `implementation-commitment` (older Stage) | `apps/api/src/modules/implementation-commitment` | **C** | Transitional — retains the platform's only working contribution/withdrawal mutation UI until ported to the Initiative-side model | `initiative-implementation-commitment` must gain equivalent UI before this is retired (Phase 7) | Yes, until Phase 7 | Yes — real mutation UI live | High |
| `implementation` (older Stage) | `apps/api/src/modules/implementation` | **C** | Transitional — retains the platform's only working achievement/evidence-recording UI until ported | Same as above | Yes, until Phase 7 | Yes — real mutation UI live | High |
| `initiative-implementation-commitment` | `apps/api/src/modules/initiative-implementation-commitment` | **A** | Canonical Implementation Commitment stage | Needs UI components built before old-Stage counterpart can retire | Yes | Yes (API-only; zero UI components today) | High |
| `initiative-implementation-tracking` | `apps/api/src/modules/initiative-implementation-tracking` | **A** | Canonical Implementation tracking stage | Same as above | Yes | Yes (API-only; zero UI components today) | High |
| `initiative-public-impact` | `apps/api/src/modules/initiative-public-impact` | **A** | Canonical Impact stage | None | Yes | Yes (read path; no creation UI) | High |
| `workspace` | `apps/api/src/modules/workspace` | **B** | Reusable projection *mechanism* (event-driven, tested); target data source must shift from Activity events to Initiative-lifecycle events | Depends on Phase 4 (Activity retargeting) producing Initiative-scoped events to project | Yes | No (currently unused by frontend) | High |
| `workspace-home` | `apps/api/src/modules/workspace-home` | **C** | Transitional — remains the product's real Workspace implementation until `workspace` absorbs its responsibilities | `workspace` must reach parity first (Phase 3) | Yes, until Phase 3 completes | Yes, fully — this is the module the shipped frontend actually calls | High |
| `notifications` | `apps/api/src/modules/notifications` | **E** | Cross-cutting; already correctly resolves `initiativeId` transitively for every Initiative-scoped module | Extend resolver as new lifecycle events are introduced | Yes | Yes | High |
| `global-search` | `apps/api/src/modules/global-search` | **E** | Cross-cutting; already correctly indexes Initiative-scoped modules by `initiativeId` | Extend to index any newly-canonicalized module | Yes | Yes | High |
| `workspace-assistant` | `apps/api/src/modules/workspace-assistant` | **E** | Cross-cutting AI-advisory service; already correctly requires and validates `initiativeId` | None | Yes | Yes | High |

---

## 15. Documentation Supersession

**This ADR formally supersedes ADR-002 ("Activity as Universal Starting Object") and any other repository statement treating Activity as the universal or sole civic root.** Per the ADR registry's own rule (`architecture/ARCHITECTURE_DECISION_RECORDS.md`, "Explicit Supersession"), ADR-002's status in that registry MUST be updated to `Superseded`, with `Superseded By: ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` recorded against it, as a documentation-governance action outside the scope of this task (this task does not modify existing documents).

| Document | Conflicting statement | Reason it conflicts | Required future action |
|---|---|---|---|
| `architecture/ARCHITECTURE_DECISION_RECORDS.md`, ADR‑002 | *"Activity is the universal starting object for meaningful civic participation. Every significant civic interaction SHALL begin with an Activity… Parallel civic entry objects SHALL NOT emerge."* | Directly contradicts this ADR's decision that Initiative is the civic root; never evaluated Initiative as an alternative despite Initiative already existing in code | **Supersede** — mark `Superseded By: ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` |
| `integration/00_ACTIVITY_ARCHITECTURE_INTEGRATION_REVIEW.md` | *"Activity — The immutable civic trace anchor (ADR-002)… Every significant civic interaction is intended to create an Activity"*; pipeline diagram omits Initiative entirely | Restates and depends on ADR-002's superseded claim | **Supersede** (by reference to this ADR) and **amend** in a future documentation wave to reflect Activity's redefined bounded role (§8, §12) |
| `implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md` | *"Initiative lifecycle \| LEGACY — ISOLATE"* (repeated across ≥6 tables); *"this implementation does not represent the Blueprint v2.0 civic lifecycle"* | Labels the canonical civic root (per this ADR) as legacy, based on the now-superseded ADR-002 premise | **Amend** — the "LEGACY — ISOLATE" classification of Initiative-pipeline modules MUST be replaced with the classification in §14 of this ADR. Its correct, still-valid observation that the Initiative modules "SHALL NOT be removed during MVP implementation" is **retained with clarification**: retained not as a temporary compatibility shim but because Initiative is now the permanent canonical root |
| `engineering/00_UBIQUITOUS_LANGUAGE.md` v2.0, Section 15 "Concept Evolution" | Already states *"Activity-centric collaboration → Initiative-centric collaboration"* (Version 1.x → Version 2.0) | **This document does not conflict with this ADR — it already agrees with it.** It conflicts internally with ADR-002 and with `implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md` from the same commit | **Retain with clarification** — cite this document as corroborating evidence for this ADR; no change needed to this section of the document itself |
| `implementation/01_MEMBER_JOURNEY_SPECIFICATION.md` v2.0 | Lists "Activity Architecture" and "Decision Lifecycle Architecture" among its Blueprint dependencies without reference to Initiative; frames the Member's civic entry point implicitly around Activity | Presents an Activity-first Member experience inconsistent with the Initiative-anchored decision | **Amend** in a future documentation wave to re-anchor the Member Journey around Initiative as the entry/context object, consistent with §8–§9 of this ADR |
| `blueprint/05_ACTIVITY_ENGINE_SPECIFICATION.md` | Describes Activity as passive "institutional memory," not managing workflows or decisions | **Does not conflict with this ADR** — this document's own framing of Activity as a non-anchoring, passive record is consistent with §8/§12's redefinition | **Retain with clarification** — cite as corroborating evidence; no amendment required |
| `engineering/ENGINEERING_DOCUMENTATION_ALIGNMENT_REPORT_v1.0.md`, `ENGINEERING_ARCHITECTURE_CONSISTENCY_REVIEW.md` | *"0 Terminology conflicts,"* *"CERTIFIED"* alignment status | These self-certifications failed to detect the ADR-002 vs. Ubiquitous-Language contradiction that this ADR now resolves | **Archive** the specific "0 conflicts" certification as inaccurate-at-time-of-issue; a corrected re-certification SHOULD be produced only after the roadmap's Phase 9 documentation alignment work completes |
| `governance/00_DOCUMENTATION_AUDIT.md`, `governance/02_DOCUMENTATION_UPDATE_PLAN.md` | Schedule (but have not executed) reconciliation of Capability 02 (Initiative) documents into the "normative" Activity-first stack in a still-future Wave 3 | Predicated on Activity being the target normative model, which this ADR now supersedes | **Amend** — re-scope Wave 3 (and any other wave referencing Activity-as-anchor) to reconcile documents *toward* the Initiative-centered model defined in this ADR, not away from it |
| `PLATFORM_ARCHITECTURE_BASELINE_V1.md`, `PLATFORM_CAPABILITY_MAP.md`, `capabilities/02_participation/**`, `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`, `blueprint/BLUEPRINT_CHANGELOG.md`, `blueprint/17_PROPOSAL_AND_MEMBER_SIGNAL_FRAMEWORK.md`, `blueprint/09_WORKSPACE_ARCHITECTURE.md` | Already Initiative-anchored | **Do not conflict with this ADR** | **Retain with clarification** — these documents are corroborating evidence and require no amendment; a future documentation wave SHOULD add explicit cross-references to this ADR |

---

## 16. Migration Principles

The following principles are binding on all future implementation work executed under this ADR:

1. **Preserve existing product behavior during migration.** No migration step MAY degrade what a Member can currently do, including via the currently-"deprecated"-labeled `workspace-home`.
2. **Do not delete a live route before frontend consumers are migrated.** A route with any confirmed frontend caller MUST remain mounted until its replacement is verified equivalent and the frontend has been repointed.
3. **Introduce Initiative ancestry before retiring duplicate roots.** A duplicate or legacy module MUST NOT be retired until its responsibility has a verified, ancestry-compliant (§11) replacement.
4. **Reuse tested Activity infrastructure where appropriate.** The outbox, event-envelope, and handler-registry patterns MUST be preferred over building new event infrastructure from scratch.
5. **Avoid large-bang rewrites.** No single implementation task MAY simultaneously touch more than one of: aggregate model, persistence layer, routes, and frontend, unless strictly required for internal consistency of that one bounded change.
6. **Make one bounded architectural change per task.** Each task in the recovery roadmap MUST have a single, independently-revertible objective.
7. **Require typecheck, lint, focused tests, build, and Git review after each task.** No task is complete until `pnpm typecheck`, `pnpm lint`, the relevant focused test subset, and `pnpm build` all pass, and the change has been reviewed.
8. **Preserve existing data or define an explicit migration path.** Any change to a persistence shape MUST either preserve existing records or ship with an explicit, reviewed data-migration step.
9. **Do not use naming changes as a substitute for domain reconciliation.** Renaming a module or route MUST NOT be treated as resolving a duplication or ancestry gap; the underlying behavior must actually change.
10. **Do not mark a module deprecated until a verified replacement exists.** No module MAY be labeled `@deprecated` in source, nor classified "Legacy — isolate" for retirement purposes, until its replacement has been built and verified equivalent (this directly corrects the sequencing error that produced the `workspace-home` contradiction).
11. **Add tests to the Initiative path before removing parallel tested paths.** Given the current test-coverage inversion (Activity: fully tested, unused; Initiative: untested, fully used), the Initiative path MUST gain unit/integration coverage before any Activity-path test coverage is removed or repurposed.
12. **Keep human governance and architectural traceability invariant.** No migration step MAY reduce human decision authority, weaken AI's advisory-only role, or break the Initiative Ancestry Invariant (§11) even temporarily.

---

## 17. Consequences

**Positive:**

- A single, unambiguous civic root eliminates the current three-way pipeline duplication over time.
- The Workspace contradiction (canonical-labeled-but-unused vs. deprecated-labeled-but-live) gets a principled resolution path rather than remaining an unaddressed defect.
- Activity's genuinely well-built event infrastructure is preserved and repurposed rather than discarded.
- Search, notifications, and workspace projections converge on one integrity model instead of maintaining two.
- Future contributors have one authoritative document to consult instead of navigating two contradictory corpora.

**Negative / costs:**

- Migration work is required across at least 6 duplicate/legacy modules and 2 Workspace implementations; this is not a zero-cost decision.
- Some currently-live UI (old-Stage `implementation`/`implementation-commitment` mutation forms) must be ported before their backends can retire, adding sequencing constraints.
- The Activity pipeline's four-stage aggregate model (as opposed to its infrastructure) becomes obsolete, representing sunk engineering cost that will not be reused as-is.
- Documentation debt (268 unreconciled documents per `governance/02_DOCUMENTATION_UPDATE_PLAN.md`) is not resolved by this ADR alone; it requires the follow-on documentation wave described in §15.

---

## 18. Risks

Risks of executing this decision without following the migration principles (§16) and roadmap sequencing:

1. **Breaking the live Workspace experience** if `workspace-home` is retired before `workspace` reaches functional parity (highest-impact risk identified in the reconciliation report).
2. **Silent runtime breakage** from partial module retirement, since no database foreign keys exist anywhere in the system — every dependency is an application-layer function call that fails at request time, not at build time.
3. **Data loss** if old-Stage `implementation`/`implementation-commitment` records (and their contribution/evidence history) are not migrated before those modules retire.
4. **Search and notification blind spots** if newly-canonicalized modules are not added to `global-search`'s and `notifications`' resolution tables at the same time their canonical status changes.
5. **Governance risk** if this ADR's supersession of ADR-002 is not also reflected in the ADR registry's own status field, leaving two "Accepted" ADRs in apparent conflict indefinitely.

Risks of **not** executing this decision (leaving all three pipelines active indefinitely) are documented exhaustively in `architecture/recovery/INITIATIVE_ARCHITECTURE_RECONCILIATION_REPORT_v1.0.md`, §13, and are incorporated here by reference: ongoing user-facing data invisibility (Activity-pipeline actions are written but never surfaced to the Member), search/notification blind spots, compounding governance and documentation debt, and false confidence from self-certifying alignment reports that have already been shown to be inaccurate.

---

## 19. Non-Decisions

The following matters are explicitly **outside the scope of this ADR** and MUST NOT be inferred from it:

- Final UI visual design for any migrated or reconciled page.
- The final Social Activity Score formula or calculation methodology.
- The exact AI provider or model used by `workspace-assistant` or any future AI-facilitation feature.
- Translation architecture implementation details.
- Long-term institutional governance design (Institution formation, Working Groups, cross-institutional coordination) beyond the extent that Initiative ancestry applies to civic lifecycle records.
- The `apps/admin` application (confirmed empty stub; not addressed here).
- Performance optimization of any pipeline, present or future.
- Unrelated Civic Media Center work (explicitly preserved, untouched, and out of scope per this task's safety rules).
- The precise resolution of Decision Questions Q1, Q3, Q4, and Q5 as originally posed in the reconciliation report — this ADR resolves the **root-anchor** question (Initiative vs. Activity) and Q2 (Workspace target responsibility) definitively, but leaves the specific engineering choices within Q1 (event-infrastructure migration mechanics), Q3 (final disposition of `discussion`/`proposal` bare modules), Q4 (exact `collective-decision` consolidation mechanics), and Q5 (exact UI-porting mechanics) to be resolved as discrete tasks within the recovery roadmap, not decided wholesale here.

---

## 20. Validation Requirements

Before any roadmap phase is considered complete, the following MUST be validated:

1. **Initiative Ancestry Invariant compliance (§11)** — for every module reclassified as Canonical (A) or Reusable (B) in §14, an automated test MUST assert that the module rejects operations referencing a non-existent or ineligible Initiative.
2. **No regression in currently-live frontend behavior** — every page/route confirmed frontend-reachable in the reconciliation report's Frontend Exposure Matrix (§7 of that report) MUST continue to function identically or better after each roadmap phase.
3. **`pnpm typecheck`, `pnpm lint`, `pnpm build` pass** after every implementation task, per Migration Principle 7.
4. **Focused test coverage added to the Initiative path** before any corresponding Activity-path test is removed or repurposed (Migration Principle 11) — measured by: does `apps/api/test/unit` and `apps/api/test/integration` contain at least one test file per canonicalized Initiative-lifecycle stage before that stage's legacy counterpart is retired.
5. **Workspace parity validation** — before `workspace-home` is retired, `workspace`'s projection output MUST be verified (via a side-by-side comparison test or manual QA pass) to contain equivalent information for a representative sample of Members' civic states.
6. **Documentation registry update** — ADR-002's status in `architecture/ARCHITECTURE_DECISION_RECORDS.md` MUST be updated to `Superseded` (a documentation-governance action, tracked in the roadmap's documentation backlog, not performed by this task).
7. **No new circular or unresolvable ancestry chains** — any newly-introduced reference between civic aggregates MUST be checked for cycles before merge.

This ADR does not itself perform any of the above validations; they are binding acceptance criteria for the recovery roadmap's phases, detailed in `architecture/recovery/INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md`.
