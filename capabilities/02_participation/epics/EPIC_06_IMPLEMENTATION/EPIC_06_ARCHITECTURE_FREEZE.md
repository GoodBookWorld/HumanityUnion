# EPIC 06 ARCHITECTURE FREEZE

## Capability 02 — Participation

### Epic 06 — Implementation

Version: 1.0

Status: Frozen

---

# Purpose

Freeze the Version 1 architecture of the **Implementation** Aggregate for Epic 06.

This document establishes the architectural baseline for all Epic 06 engineering work and post-implementation governance.

After this freeze:

- implementation must conform to the decisions recorded here and in referenced Epic 06 architecture documents;
- architectural drift requires explicit Architecture Review or Engineering Decision;
- implementation must not redefine aggregate responsibilities, derived values or experience boundaries.

This document records **architectural intent only**.

It does not define implementation.

It does not authorize features beyond the frozen Version 1 scope.

References:

- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`
- `STATE_MACHINE.md`
- `WORKSPACE_SPECIFICATION.md`
- `PUBLIC_PROJECTION.md`
- `EPIC_06_ARCHITECTURE_REVIEW.md`
- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`

Epic 06 architecture review evaluated domain integrity, aggregate boundaries, derived values, operational/public separation and pipeline integration before and during implementation.

This freeze locks the aggregate design for Version 1 and records intentional deferrals.

---

# Scope

**Implementation** records collective implementation progress.

It answers the Stage 7 civic question:

**"What is being done?"**

Implementation:

- records phases, milestones, achievements and evidence of collective action;
- derives collective progress and completion assessment from recorded truth;
- preserves auditable execution history;
- publishes operational and public transparency during execution.

Implementation does **not** coordinate people.

It does not assign tasks, manage schedules, operate messaging or administer volunteer dispatch.

Implementation follows eligible **Implementation Commitment** on the approved participation path.

It does not precede Commitment or substitute for preparedness collection.

---

# Approved Aggregate

## Implementation

**Implementation** is the sole Aggregate Root approved for Epic 06 Version 1.

One Implementation instance:

- references one approved participation path through aggregate identifiers;
- owns implementation lifecycle state;
- owns Implementation Phases, Milestones, Achievements and Evidence within its boundary;
- references Frozen Policy by identifier — does not own policy content;
- derives Collective Progress, Completion Assessment, Completion and related indicators;
- preserves implementation history including recorded achievements and evidence associations.

External systems interact through Implementation commands only.

Internal entities are not independent mutation entry points.

### Approved Entities

| Entity                   | Identity                | Role                                                                                    |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------- |
| **Implementation**       | `ImplementationId`      | Aggregate Root; lifecycle authority; owns phases, milestones, achievements and evidence |
| **Implementation Phase** | `ImplementationPhaseId` | Major segment of collective execution narrative; groups milestones                      |
| **Milestone**            | `MilestoneId`           | Collective civic checkpoint toward completion; Required or Optional                     |
| **Achievement**          | `AchievementId`         | Recorded collective accomplishment toward one Milestone                                 |
| **Evidence**             | `EvidenceId`            | Factual supporting material associated with one Achievement                             |

### Approved Value Objects

| Value Object                  | Role                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| **Implementation Status**     | Aggregate lifecycle meaning (`Planned`, `Started`, `In Progress`, `Completed`, `Archived`) |
| **Progress Snapshot**         | Point-in-time derived representation of Collective Progress                                |
| **Completion Assessment**     | Derived evaluation of Completion Criteria satisfaction                                     |
| **Progress Indicator**        | Presentation-oriented derived signal of Collective Progress                                |
| **Completion Indicator**      | Presentation-oriented derived signal of Completion Assessment outcomes                     |
| **Evidence Reference**        | Identifier or citation pointing to evidence without embedding external aggregate content   |
| **Evidence Attachment**       | Evidence content stored or linked under platform policy                                    |
| **Evidence Link**             | URL or platform-resolved link to internal or external evidence                             |
| **Implementation Visibility** | Policy-governed operational versus public presentation boundaries                          |
| **Implementation Timeline**   | Ordered presentation model of phases, milestones, achievements and significant updates     |

### Approved Derived Values

The following are derived only — never manually editable source of truth:

- **Collective Progress**
- **Completion Assessment**
- **Completion**
- **Progress Indicator**
- **Completion Indicator**

Derived values must never appear as lifecycle states interchangeable with **Implementation Status**.

### Aggregate References (Identifier Only)

| Reference                    | Purpose                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `InitiativeId`               | Originating structured proposal                                           |
| `CollectiveDecisionId`       | Approved collective direction                                             |
| `PetitionId`                 | Related public endorsement context                                        |
| `ImplementationCommitmentId` | Preceding preparedness and readiness context                              |
| `FrozenPolicyId`             | Governing frozen policy for milestones, evidence and completion semantics |

---

# Architectural Decisions

The following decisions from `DOMAIN_DECISIONS.md` are **approved and frozen** for Version 1.

| #   | Decision                                                              | Status   |
| --- | --------------------------------------------------------------------- | -------- |
| 01  | Implementation begins only after approved Implementation Commitment   | Approved |
| 02  | Implementation records collective progress, not individual work       | Approved |
| 03  | Progress is derived from Achievements                                 | Approved |
| 04  | Completion is derived from completed required Milestones              | Approved |
| 05  | Evidence supports transparency but does not establish objective truth | Approved |
| 06  | Every Achievement belongs to exactly one Milestone                    | Approved |
| 07  | Every Milestone belongs to exactly one Phase                          | Approved |
| 08  | Frozen Policy remains immutable during Implementation                 | Approved |
| 09  | Implementation never manages tasks or assignments                     | Approved |
| 10  | Implementation never replaces external project management systems     | Approved |
| 11  | Humanity Assistant explains but never approves achievements           | Approved |
| 12  | Public and Operational views remain separated                         | Approved |
| 13  | History is preserved                                                  | Approved |
| 14  | Future Coordination Space excluded from Version 1                     | Approved |
| 15  | Future capability expansion must not require Aggregate redesign       | Approved |

## Derived Progress and Completion (Frozen)

The following derivation rules are binding for Version 1.

### Progress is derived

**Collective Progress** and **Progress Indicators** are computed exclusively from recorded Achievements, Milestone satisfaction state and applicable Completion Criteria.

Progress is never manually entered or edited as source of truth.

Achievement recording triggers progress recalculation.

### Completion is derived

**Completion** and **Completion Assessment** are computed when recorded collective progress satisfies Completion Criteria, including satisfaction of all **Required Milestones**.

Optional Milestones inform context but do not block Completion when required criteria are met.

Completion is never manually toggled as authority.

Completion is not Collective Decision re-approval.

### Milestone completion is derived

Milestone satisfaction is evaluated through recorded Achievements and Evidence — not manual checkbox authority alone.

Required Milestones gate Completion Assessment.

Optional Milestones do not block Completion when required criteria are satisfied.

### Phase completion is derived

Phase status follows milestone satisfaction and implementation narrative progression within the aggregate.

Phases organize collective execution record — they do not assign personal work.

Phase completion is derived from milestone state within the phase — not from separate manual closure commands.

## Evidence and Honesty (Frozen)

### Evidence supports transparency but does not establish objective truth

Evidence substantiates recorded Achievements and supports civic transparency.

Evidence increases confidence in what was recorded.

Evidence does not, by itself, establish objective truth, legal proof or platform adjudication of external facts.

The platform records collective civic narrative with supporting material — it is not a court, auditor or forensic authority.

### Explainable Honesty

Public and operational surfaces must explain derived state honestly:

- derived values are labeled as derived;
- completion is not presented as discretionary administrator sign-off;
- evidence language uses substantiation — not proof, certification or omniscient validation;
- Implementation completion is distinct from Impact measurement;
- assistant guidance is transparent about automation boundaries.

Public progress summaries must remain explainable from underlying achievements, milestone state and completion criteria evaluation (Invariant **IM-021**).

### Transparent Progress

Collective progress is visible through recorded phases, milestones, achievements and derived indicators.

Progress reflects recorded collective accomplishment — not engagement metrics, activity counts or Petition signature proxies.

Share increases visibility without mutating progress.

Required and optional milestone distinction supports honest reporting of what remains for completion.

### Trust Through Verification

Trust is earned through verifiable recorded truth — not platform overclaim:

- achievements are recorded through accountable operational commands;
- progress and completion trace back to achievements, milestone state and Frozen Policy criteria;
- evidence associations remain auditable;
- operational and public projections are built from aggregate truth through dedicated builders — not uncontrolled serialization;
- the platform supports civic audit and transparency without claiming to verify external facts as absolute truth.

## Operational / Public Separation (Frozen)

**Implementation Workspace** (operational) and **Public Implementation** (public projection) are distinct surfaces with distinct DTOs, routes and visibility rules.

- operational surfaces support accountable recording and participant orientation;
- public surfaces expose approved aggregate civic meaning;
- neither serializes the other directly as source of truth;
- `ImplementationVisibility` governs field exposure boundaries;
- participant identity and operational internals remain excluded from public projection by default.

---

# Version 1 Deferrals

Version 1 intentionally excludes the following capabilities.

They are deferred — not absent because they are unimportant — because they would redefine Implementation's civic purpose if introduced prematurely.

| Deferred Capability                         | Reason                                                                |
| ------------------------------------------- | --------------------------------------------------------------------- |
| **Coordination Space**                      | Structured coordination beyond collective progress recording          |
| **Task Assignment**                         | Personal or role-based work delegation                                |
| **Scheduling**                              | Time-slot and deadline assignment for people or resources             |
| **Messaging**                               | Chat, threads and informal coordination replacing accountable updates |
| **Calendar**                                | Shared or personal calendar management                                |
| **Volunteer Management**                    | Roster, dispatch and shift coordination                               |
| **External Project Management Integration** | Embedded third-party execution tools                                  |

These may be introduced later as **independent capabilities** adjacent to Implementation.

They must not require redesign of the Implementation Aggregate core defined in Version 1.

## No Explicit Complete API Endpoints

Version 1 does **not** expose explicit Complete API endpoints such as:

- Complete Implementation
- Complete Milestone
- Complete Phase

**Completion**, **milestone satisfaction** and **phase completion** are **derived by design** from recorded Achievements, Milestone state and Completion Criteria evaluation.

This is intentional.

It is not a missing feature.

Manual completion commands would contradict Decisions 03 and 04 and would introduce discretionary closure authority inconsistent with frozen architecture.

The store recalculates derived state when achievements are recorded and when governed structure or policy context affects evaluation.

Lifecycle transitions (`Planned` → `Started` → `In Progress` → `Completed` → `Archived`) follow `STATE_MACHINE.md` — aggregate **Completed** is reached when derived completion criteria are satisfied, not through a separate manual complete command.

---

# Bootstrap

Version 1 bootstrap identifiers are frozen for vertical slice verification:

| Entity                    | Bootstrap ID                   |
| ------------------------- | ------------------------------ |
| Initiative                | `initiative-bootstrap-001`     |
| Collective Decision       | `decision-bootstrap-001`       |
| Petition                  | `petition-bootstrap-001`       |
| Implementation Commitment | `commitment-bootstrap-001`     |
| Implementation            | `implementation-bootstrap-001` |

Bootstrap links prior pipeline stages through Stage 7 for end-to-end participation verification.

Bootstrap demonstrates:

- phase → milestone hierarchy;
- required and optional milestone semantics;
- achievement recording with evidence;
- derived progress and completion movement;
- operational workspace and public projection separation.

Bootstrap must not weaken aggregate independence or eligibility rules in production semantics.

---

# Future Evolution

Future capabilities — Coordination Space, scheduling, messaging, calendar, task assignment, volunteer management, external integrations — must attach as **independent capabilities or bounded extensions** without redesigning the core Implementation Aggregate responsibilities defined in Version 1.

The Implementation Aggregate continues to own:

- collective progress recording;
- milestone structure;
- achievements;
- evidence;
- derived completion.

Future services may read Implementation state.

They must not merge into the aggregate root by default.

Future introduction must:

- preserve aggregate independence;
- preserve derived progress and completion discipline;
- preserve operational/public separation;
- preserve Human Leadership;
- proceed through Architecture Review.

Extension adds adjacent services.

It does not silently convert Implementation into project management software.

---

# Final Statement

**Epic 06 Version 1 Architecture is frozen.**

The **Implementation** Aggregate records collective implementation progress toward approved civic direction.

It does not coordinate people.

Changes require a formal architecture review before implementation.

Implementation must conform to this freeze and referenced Epic 06 architecture documents.

Architecture never follows implementation convenience.

---

# Architecture Status

**FROZEN**

Version 1 architecture of the **Implementation** Aggregate is approved and locked.

All engineering work must conform to this freeze and referenced Epic 06 architecture documents.

Change requires governance — not implementation convenience.
