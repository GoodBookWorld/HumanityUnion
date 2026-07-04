# DOMAIN DECISIONS

## Capability 02 — Participation

### Epic 06 — Implementation

Version: 1.0

Status: Draft

---

# Purpose

This document records the architectural decisions that define the **Implementation** Aggregate.

These decisions explain why the domain is designed as it is.

They protect architectural consistency throughout the evolution of Capability 02 — Participation.

Changes require Architecture Review.

Terminology must conform to:

- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`

---

# Decision 01

## Implementation Begins Only After Approved Implementation Commitment

### Decision

**Implementation** begins only after an eligible **Implementation Commitment** exists on the approved participation path.

Implementation references `ImplementationCommitmentId` and eligible prior stage outcomes.

It does not precede Commitment or substitute for readiness collection.

### Reason

Stage 6 answers who is prepared to help.

Stage 7 answers what is being done.

Beginning Implementation before Commitment would skip preparedness accountability and blur the distinction between declared capacity and execution recording.

The Participation Pipeline preserves distinct civic questions at each stage.

### Consequences

- Implementation creation requires reference to an approved Implementation Commitment context.
- Implementation Commitment readiness remains an eligibility input — not redefined by Implementation.
- Commitment lifecycle and Implementation lifecycle remain independent.
- Journey presentation shows Commitment as a preceding stage before execution recording.
- Bootstrap and production eligibility gates enforce reference integrity.

### Status

Approved

---

# Decision 02

## Implementation Records Collective Progress, Not Individual Work

### Decision

Implementation records **collective** execution progress — Achievements, Milestone satisfaction and derived community-level indicators.

It does not record individual work logs, personal task completion or participant productivity metrics.

### Reason

The platform exists to support transparent civic execution — not workforce surveillance or personal performance management.

Individual work tracking would:

- shift civic meaning toward employment administration;
- expose private labor detail inappropriately on public surfaces;
- violate Human Leadership by implying the platform assigns or monitors personal work.

Collective progress preserves dignity and public legitimacy.

### Consequences

- Achievement language describes community accomplishment — not personal to-do completion.
- Operational and public surfaces present aggregate progress by default.
- Domain model excludes task boards, assignees and individual workload entities.
- Anti-term enforcement: Achievement ≠ Task; Progress ≠ Activity.
- Experience copy must avoid personal productivity framing.

### Status

Approved

---

# Decision 03

## Progress Is Derived from Achievements

### Decision

**Collective Progress** and **Progress Indicators** are derived exclusively from recorded Achievements, Milestone state and applicable Completion Criteria.

Progress is never manually entered or edited as source of truth.

### Reason

If progress were manually editable, the platform could claim implementation advancement without recorded collective accomplishment — weakening public trust and bypassing aggregate boundaries.

Derived progress preserves:

- Explicit Publicity — observers understand progress as an outcome of recorded activity;
- Historical Integrity — progress changes trace back to achievements and milestone state;
- Aggregate Independence — progress is owned by Implementation derivation, not administrator opinion.

### Consequences

- Store and API layers treat Collective Progress as read-only derived output.
- Validators block PATCH of derived progress fields.
- Workspace and public projection label progress as derived.
- Achievement recording triggers progress recalculation.
- Progress Snapshots capture derived state — they do not replace live derivation authority.

### Status

Approved

---

# Decision 04

## Completion Is Derived from Completed Required Milestones

### Decision

**Completion** and **Completion Assessment** are derived when recorded collective progress satisfies **Completion Criteria**, including satisfaction of all **Required Milestones**.

Optional Milestones inform context but do not block Completion when required criteria are met.

Completion is never manually toggled as authority.

### Reason

Completion must reflect defined civic closure conditions — not discretionary sign-off or implicit "done" sentiment.

Tying Completion to required milestone satisfaction:

- preserves policy-governed meaning of complete;
- distinguishes required from optional civic expectations;
- prevents premature or arbitrary closure of the execution record.

Completion is not Collective Decision re-approval.

### Consequences

- Milestones declare `requirementType` as Required or Optional.
- Completion Assessment evaluates required milestone satisfaction explicitly.
- Completion Indicators reflect assessment outcomes — not manual approval buttons.
- Store commands cannot set Completion directly without satisfying derivation rules.
- Public copy must state that Completion is derived — not administrator decree.

### Status

Approved

---

# Decision 05

## Evidence Supports Transparency but Does Not Establish Objective Truth

### Decision

**Evidence** substantiates recorded Achievements and supports civic transparency.

Evidence increases confidence in what was recorded.

Evidence does not, by itself, establish objective truth, legal proof or platform adjudication of external facts.

### Reason

The platform records collective civic narrative with supporting material — it is not a court, auditor or forensic authority.

Treating evidence as automatic truth would:

- overstate platform epistemic authority;
- invite disputes the domain is not designed to resolve;
- blur the line between substantiation and verdict.

Evidence supports accountability of recording — not omniscient validation.

### Consequences

- Evidence Reference, Evidence Attachment and Evidence Link associate with Achievements — they do not replace them.
- Workspace and public copy use language of support and substantiation — not proof or certification.
- Disputed external facts remain outside aggregate adjudication scope.
- Evidence visibility follows Implementation Visibility policy — not universal public exposure by default.
- Anti-term enforcement: Evidence ≠ Opinion — though evidence must remain factual in intent, not persuasive commentary.

### Status

Approved

---

# Decision 06

## Every Achievement Belongs to Exactly One Milestone

### Decision

Every **Achievement** belongs to exactly one **Milestone** within one **Implementation**.

Achievements do not float unattached or span multiple milestones as a single record.

### Reason

Milestones define collective civic checkpoints toward completion.

Orphan achievements would:

- break Completion Assessment traceability;
- weaken explainability of progress toward defined outcomes;
- invite ambiguous progress reporting.

One achievement — one milestone preserves structural clarity and auditability.

### Consequences

- `Achievement.milestoneId` is mandatory and immutable after recording under policy.
- Commands reject achievements without valid milestone reference.
- Derived progress maps achievements to milestone satisfaction explicitly.
- Public progress summaries remain explainable milestone-by-milestone.
- Invariant **IM-004** enforced at store layer.

### Status

Approved

---

# Decision 07

## Every Milestone Belongs to Exactly One Phase

### Decision

Every **Milestone** belongs to exactly one **Implementation Phase** within one **Implementation**.

Phases organize narrative grouping.

Milestones do not exist outside phase structure in Version 1.

### Reason

Implementation Phases provide coherent periods of collective execution narrative.

Milestones without phase ownership would:

- weaken orientation in workspace and public timeline;
- complicate ordered civic storytelling;
- increase arbitrary milestone sprawl.

Phase ownership preserves structured collective execution record.

### Consequences

- `Milestone.implementationPhaseId` is mandatory.
- Phase sequence and milestone sequence support Implementation Timeline presentation.
- Completion Criteria may scope milestones by phase where policy defines structure.
- Invariant **IM-003** enforced at store layer.
- Bootstrap data demonstrates phase → milestone hierarchy.

### Status

Approved

---

# Decision 08

## Frozen Policy Remains Immutable During Implementation

### Decision

**Frozen Policy** referenced by `frozenPolicyId` is read-only during Implementation.

Implementation reads milestone semantics, evidence rules, visibility boundaries and completion criteria through policy reference.

Implementation commands must not mutate policy content in place.

### Reason

Stable policy during execution preserves:

- predictable Completion Criteria meaning;
- auditable explanation of why completion was derived;
- alignment with Living Policy Lifecycle **Frozen** stage semantics.

In-place policy mutation during active implementation would retroactively change closure rules — violating Historical Integrity and public trust.

### Consequences

- Policy change requires governed reference update to a new policy generation — not PATCH of frozen content.
- Store reads policy through read-only fixture or external policy module boundary.
- Validators block frozen policy mutation through Implementation endpoints.
- Invariant **IM-014** enforced at store layer.
- Public projection carries public-safe policy summary — not full internal policy mechanics.

### Status

Approved

---

# Decision 09

## Implementation Never Manages Tasks or Assignments

### Decision

Implementation does not provide task management, personal assignment, backlog ownership or work delegation semantics.

Achievements record collective accomplishment.

Milestones define collective checkpoints.

Neither assigns work to individuals.

### Reason

Task and assignment semantics belong to coordination and workforce domains — not civic execution recording.

Introducing tasks would:

- redefine Implementation as project management software;
- violate aggregate boundary with Implementation Commitment preparedness semantics;
- expose the platform to employment and assignment expectations it does not govern in Version 1.

Implementation records what was done collectively — not who must do what next operationally.

### Consequences

- Domain model excludes Task, Assignment, Assignee and Backlog entities.
- API surface excludes task CRUD and assignment commands.
- Workspace excludes kanban, task boards and personal to-do views.
- Anti-term enforcement: Achievement ≠ Task; Milestone ≠ Personal Assignment.
- Future Coordination Space remains explicitly deferred — not smuggled through synonyms.

### Status

Approved

---

# Decision 10

## Implementation Never Replaces External Project Management Systems

### Decision

Implementation does not absorb external project management, scheduling, messaging or collaboration tool responsibilities.

The platform provides civic execution transparency within the Participation Pipeline.

It does not compete with or embed enterprise PM ecosystems in Version 1.

### Reason

Humanity Union's civic architecture separates:

- pipeline stage accountability;
- aggregate independence;
- calm transparency;

from operational tooling organizations may already use externally.

Replacing external PM systems would:

- expand scope beyond frozen Capability 02 boundaries;
- increase Version 1 complexity without architectural approval;
- blur Implementation's narrow civic purpose.

### Consequences

- No external tool integration in Version 1 scope.
- Evidence Link may reference external material — it does not embed external workflow ownership.
- Workspace copy avoids "project plan" or "backlog" product language for domain objects.
- Engineering decisions defer integration to future Architecture Review.
- Anti-term enforcement: Implementation ≠ Project Management.

### Status

Approved

---

# Decision 11

## Humanity Assistant Explains Implementation Status but Never Approves Achievements

### Decision

The **Humanity Assistant** may explain Implementation meaning, milestone context, derived progress and completion assessment in plain civic language.

The Humanity Assistant must never approve, record or modify Achievements, Milestones or Completion on behalf of participants.

### Reason

Assistants reduce complexity — not responsibility.

Allowing assistant approval or recording would:

- violate Human Leadership;
- bypass canonical operational recording surfaces;
- obscure accountability for civic execution claims.

Achievement recording remains a human command through the Implementation Workspace.

### Consequences

- Assistant presentation is read-only at the domain boundary.
- Workspace includes boundary copy stating assistant limitations.
- No backend assistant mutation endpoints in Version 1.
- Assistant recommendations align with Next Meaningful Action — they do not substitute for it.
- Public Implementation assistant panel remains explain-only.

### Status

Approved

---

# Decision 12

## Public and Operational Views Remain Separated

### Decision

**Implementation Workspace** (operational) and **Public Implementation** (public projection) are distinct surfaces with distinct DTOs, routes and visibility rules.

Public surfaces expose approved aggregate civic meaning.

Operational surfaces support accountable recording and participant orientation.

Neither serializes the other directly as source of truth.

### Reason

Explicit Publicity is a frozen platform principle.

Merging operational and public views would:

- leak private operational detail to society by default;
- or dilute operational clarity with public-safe-only constraints inappropriately applied to recording flows.

Separation preserves dignity, transparency and aggregate independence.

### Consequences

- Dedicated public projection builder — not operational aggregate serialization.
- `ImplementationVisibility` governs field exposure boundaries.
- Separate API routes for operational and public access patterns.
- Web routes maintain operational/public URL separation consistent with prior epics.
- Invariant **IM-021** requires public summaries remain explainable from underlying recorded truth without exposing forbidden detail.

### Status

Approved

---

# Decision 13

## History Is Preserved

### Decision

Implementation preserves auditable history of phases, milestones, achievements and evidence associations.

Closure, completion or archival changes lifecycle state.

It does not erase recorded civic execution history.

### Reason

Civic accountability requires that communities and observers can understand what was recorded and when.

Silent deletion or in-place rewriting of achievements would:

- destroy public trust;
- break explainability of derived progress and completion;
- violate Historical Integrity platform principles.

Withdrawal or correction flows, if ever introduced, must preserve audit trail — not silent erasure.

### Consequences

- Achievements and evidence remain readable after Implementation completion or archival where policy permits.
- Store rejects commands that delete historical achievement records without governed correction semantics.
- Derived snapshots may be retained as historical points — they do not replace underlying records.
- Invariants **IM-007** and **IM-020** enforced at store layer.
- Public historical record remains available after active collection ends.

### Status

Approved

---

# Decision 14

## Future Coordination Space Is Intentionally Excluded from Version 1

### Decision

**Future Coordination Space** and related coordination semantics — task assignment, scheduling, messaging, calendar coordination, volunteer dispatch — are explicitly excluded from Epic 06 Version 1.

Version 1 records collective implementation progress only.

### Reason

Coordination features introduce:

- personal assignment semantics;
- scheduling authority;
- messaging ownership;

that would redefine Implementation's narrow civic purpose prematurely.

Naming deferred concepts prevents silent scope creep through implementation convenience.

### Consequences

- Domain model, store, API and workspace exclude Coordination Space entities.
- Documentation lists Coordination Space as reserved extension point only.
- Product language must not imply hidden task or messaging features.
- Future introduction requires Architecture Review — not incremental synonym drift.
- Decision 15 governs how future additions attach without aggregate redesign.

### Status

Approved

---

# Decision 15

## Future Capability Expansion Must Not Require Aggregate Redesign

### Decision

Future capabilities — Coordination Space, scheduling, messaging, calendar, task assignment, volunteer management, external integrations — must attach as **independent capabilities or bounded extensions** without redesigning the core Implementation Aggregate responsibilities defined in Version 1.

The Implementation Aggregate continues to own collective progress recording, milestone structure, achievements, evidence and derived completion — regardless of future adjacent services.

### Reason

Aggregate stability protects:

- pipeline integrity;
- engineering investment in the vertical slice;
- explainability of civic execution records over time.

If every future feature required aggregate redesign, architectural drift would become inevitable.

Version 1 therefore defines a narrow, durable core with explicit extension boundaries.

### Consequences

- Future services read Implementation state — they do not merge into the aggregate root by default.
- Extension points are documented in `DOMAIN_MODEL.md` Future Evolution — not implemented in Version 1.
- Architecture Review required before any feature redefines aggregate ownership.
- Engineering decisions may add adjacent modules — not silently expand Implementation root responsibilities.
- Bootstrap and production semantics remain valid as adjacent capabilities arrive.

### Status

Approved

---

# Future Evolution

Version 1 deliberately omits the following coordination and execution-adjacent capabilities.

They are **not** absent because they are unimportant.

They are deferred because they would redefine Implementation's civic purpose if introduced prematurely.

## Intentionally omitted from Version 1

| Capability | Why deferred |
|------------|--------------|
| **Coordination** | Structured coordination beyond collective progress recording |
| **Scheduling** | Time-slot and deadline assignment for people or resources |
| **Messaging** | Chat, threads and informal coordination replacing accountable updates |
| **Calendar** | Shared or personal calendar management |
| **Task Assignment** | Personal or role-based work delegation |
| **Volunteer Management** | Roster, dispatch and shift coordination |

These may be introduced later as **independent capabilities** adjacent to Implementation.

They must not require redesign of the Implementation Aggregate core defined in Version 1.

Future introduction must:

- preserve aggregate independence;
- preserve derived progress and completion discipline;
- preserve operational/public separation;
- preserve Human Leadership;
- proceed through Architecture Review.

Extension adds adjacent services.

It does not silently convert Implementation into project management software.

---

# Decision Summary

| # | Decision | Status |
|---|----------|--------|
| 01 | Implementation begins only after approved Implementation Commitment | Approved |
| 02 | Implementation records collective progress, not individual work | Approved |
| 03 | Progress is derived from Achievements | Approved |
| 04 | Completion is derived from completed required Milestones | Approved |
| 05 | Evidence supports transparency but does not establish objective truth | Approved |
| 06 | Every Achievement belongs to exactly one Milestone | Approved |
| 07 | Every Milestone belongs to exactly one Phase | Approved |
| 08 | Frozen Policy remains immutable during Implementation | Approved |
| 09 | Implementation never manages tasks or assignments | Approved |
| 10 | Implementation never replaces external project management systems | Approved |
| 11 | Humanity Assistant explains but never approves achievements | Approved |
| 12 | Public and Operational views remain separated | Approved |
| 13 | History is preserved | Approved |
| 14 | Future Coordination Space excluded from Version 1 | Approved |
| 15 | Future expansion must not require Aggregate redesign | Approved |

---

Implementation Version 1 records collective implementation progress.

It does not coordinate people.
