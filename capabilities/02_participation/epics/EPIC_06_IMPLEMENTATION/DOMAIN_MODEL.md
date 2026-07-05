# DOMAIN MODEL

## Capability 02 — Participation

### Epic 06 — Implementation

Version: 1.0

Status: Draft

---

# Purpose

This document defines the domain model for the **Implementation** Aggregate.

**Implementation** records the collective execution progress of an approved initiative.

It does not manage projects or individual work.

Implementation exists to provide transparent, evidence-supported progress toward the agreed public outcome.

Implementation is Stage 7 of the Humanity Union Participation Pipeline.

It follows eligible prior stages — including **Implementation Commitment** — and answers the civic question:

**"What is being done?"**

This document describes architectural structure only.

It does not define implementation.

Terminology must conform to:

- `DOMAIN_LANGUAGE.md`
- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`

---

# Aggregate Root

## Implementation

**Implementation** is the Aggregate Root.

It represents one civic execution record context for turning an approved participation path into accountable collective progress toward completion.

One Implementation instance:

- references one approved participation path through aggregate identifiers;
- owns implementation lifecycle state;
- owns Implementation Phases, Milestones, Achievements and Evidence within its boundary;
- references Frozen Policy by identifier — does not own policy content;
- derives Collective Progress, Completion Assessment, Completion and related indicators;
- preserves implementation history including recorded achievements and evidence references.

The Aggregate Root is the only entry point for mutations within this boundary.

External systems interact with Implementation commands — not with internal entities in isolation.

---

# Aggregate Structure

```
Implementation

↓

Implementation Phase

↓

Milestone

↓

Achievement

↓

Evidence

↓

Progress Snapshot (derived)

↓

Completion Assessment (derived)
```

Structural rules:

- **Implementation** is the root container and lifecycle authority.
- **Implementation Phase** groups related milestones within one execution narrative.
- **Milestone** defines a collective civic checkpoint toward completion.
- **Achievement** records one collective accomplishment toward a milestone.
- **Evidence** substantiates an achievement through reference, attachment or link.
- **Progress Snapshot** captures derived collective progress at a point in time.
- **Completion Assessment** evaluates whether completion criteria are satisfied.

Derived values never replace recorded Achievements or Milestone state as source of truth.

---

# Entities

Entities have identity and lifecycle within the aggregate.

## Implementation

The Aggregate Root entity.

**Identity:** `ImplementationId`

**Core properties:**

| Property                     | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| `implementationId`           | Unique aggregate identifier                      |
| `initiativeId`               | Reference to originating Initiative              |
| `collectiveDecisionId`       | Reference to approved Collective Decision        |
| `petitionId`                 | Reference to related Petition                    |
| `implementationCommitmentId` | Reference to preceding Implementation Commitment |
| `frozenPolicyId`             | Reference to governing Frozen Policy             |
| `status`                     | Implementation lifecycle state                   |
| `subjectTitle`               | Approved subject title snapshot                  |
| `subjectSummary`             | Approved subject summary snapshot                |
| `createdAt`                  | Aggregate creation timestamp                     |
| `updatedAt`                  | Last mutation timestamp                          |

**Owned collections:**

- implementation phases;
- milestones (may be nested under phases or indexed by phase reference);
- achievements;
- evidence records associated with achievements;
- implementation updates where modeled within aggregate scope.

**Derived snapshots (read-only within aggregate):**

- `collectiveProgress`
- `completionAssessment`
- `completion`
- `progressIndicator`
- `completionIndicator`
- `progressSnapshots` — historical derived snapshots where retained

The root enforces invariants and coordinates command application.

## Implementation Phase

An **Implementation Phase** is a major segment of collective execution within one Implementation.

**Identity:** `ImplementationPhaseId`

**Properties:**

| Property                | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `implementationPhaseId` | Unique phase identifier                          |
| `implementationId`      | Owning aggregate                                 |
| `title`                 | Phase title in civic language                    |
| `summary`               | Phase purpose summary                            |
| `sequenceOrder`         | Ordered position within implementation narrative |
| `status`                | Phase lifecycle meaning within implementation    |
| `createdAt`             | Phase creation timestamp                         |
| `updatedAt`             | Last permitted mutation timestamp                |

**Rules:**

- belongs to exactly one Implementation;
- groups one or more Milestones;
- organizes narrative — it does not assign personal work;
- remains part of historical record once completed or archived under policy.

## Milestone

A **Milestone** is a defined collective checkpoint toward Implementation completion.

**Identity:** `MilestoneId`

**Properties:**

| Property                | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `milestoneId`           | Unique milestone identifier                                   |
| `implementationId`      | Owning aggregate                                              |
| `implementationPhaseId` | Owning phase                                                  |
| `title`                 | Milestone title in civic language                             |
| `description`           | Milestone meaning and expected collective outcome             |
| `requirementType`       | Required or Optional classification                           |
| `status`                | Milestone satisfaction state within implementation            |
| `sequenceOrder`         | Ordered position within phase                                 |
| `createdAt`             | Milestone creation timestamp                                  |
| `updatedAt`             | Last permitted mutation timestamp                             |
| `satisfiedAt`           | Timestamp when milestone satisfaction recorded, if applicable |

**Rules:**

- belongs to exactly one Implementation Phase;
- may be **Required** or **Optional** under Completion Criteria;
- is evaluated through recorded Achievements and Evidence — not manual checkbox alone;
- remains auditable after satisfaction or closure.

Milestones express collective civic checkpoints.

They are not personal assignments.

## Achievement

An **Achievement** is a recorded collective accomplishment advancing or satisfying a Milestone.

**Identity:** `AchievementId`

**Properties:**

| Property                  | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| `achievementId`           | Unique achievement identifier                                  |
| `implementationId`        | Owning aggregate                                               |
| `milestoneId`             | Related milestone                                              |
| `title`                   | Achievement title in civic language                            |
| `summary`                 | Factual description of collective accomplishment               |
| `recordedAt`              | Timestamp of accountable recording                             |
| `recordedByParticipantId` | Participant who recorded under policy — not ownership of labor |
| `createdAt`               | Entity creation timestamp                                      |
| `updatedAt`               | Last permitted mutation timestamp                              |

**Rules:**

- belongs to exactly one Milestone within one Implementation;
- may reference one or more Evidence records;
- contributes to derived Collective Progress when recorded;
- preserves historical integrity once recorded under policy;
- describes collective accomplishment — not individual task completion logs.

## Evidence

**Evidence** is factual supporting material associated with an Achievement.

**Identity:** `EvidenceId`

**Properties:**

| Property           | Description                                  |
| ------------------ | -------------------------------------------- |
| `evidenceId`       | Unique evidence identifier                   |
| `achievementId`    | Owning achievement                           |
| `implementationId` | Owning aggregate                             |
| `evidenceKind`     | Reference, Attachment or Link classification |
| `label`            | Public-safe evidence label                   |
| `recordedAt`       | Timestamp of evidence association            |
| `createdAt`        | Entity creation timestamp                    |

**Rules:**

- belongs to exactly one Achievement;
- may be expressed as Evidence Reference, Evidence Attachment or Evidence Link value objects;
- substantiates accomplishment — it does not replace Achievement recording;
- follows visibility rules for operational and public surfaces;
- remains auditable once recorded under policy.

Evidence supports truth.

It is not opinion or commentary stored as proof.

---

# Value Objects

Value objects have no independent lifecycle outside the aggregate context.

## Implementation Status

Lifecycle meaning of the Implementation aggregate.

**Version 1 semantic examples:**

- `Draft` — preparation before active collective progress recording
- `Active` — collective execution progress is being recorded authoritatively
- `Completed` — derived completion criteria satisfied; execution record closed
- `Archived` — historical record retained; no further mutation

Implementation Status vocabulary belongs to Implementation.

It must not reuse Petition, Collective Decision or Implementation Commitment statuses as synonyms.

## Progress Snapshot

Point-in-time derived representation of Collective Progress.

**Properties:**

- `snapshotAt` — derivation timestamp
- `collectiveProgressSummary` — civic-language progress headline
- `milestonesSatisfiedCount` — count of satisfied milestones
- `milestonesTotalCount` — count of tracked milestones in scope
- `requiredMilestonesSatisfiedCount` — required milestone satisfaction count
- `derivedAt` — derivation timestamp

Progress Snapshots are computed.

They are never manually authored as source of truth.

## Completion Assessment

Derived evaluation of Completion Criteria satisfaction.

**Properties:**

- `assessmentReached` — whether completion criteria are satisfied
- `satisfiedCriteria` — identifiers or labels of satisfied criteria
- `unsatisfiedCriteria` — identifiers or labels of unsatisfied required criteria
- `evaluatedAt` — evaluation timestamp
- `explanation` — civic-language assessment summary

Completion Assessment is computed from Achievements, Milestone state and policy.

It is never manually toggled.

## Progress Indicator

Presentation-oriented derived signal of Collective Progress.

**Properties:**

- `headline` — calm civic-language progress summary
- `requiredMilestoneProgressLabel` — public-safe required milestone progress text
- `derivedAt` — derivation timestamp

Progress Indicators summarize derived state.

They must not use gamification, ranking or urgency framing.

## Completion Indicator

Presentation-oriented derived signal of progress toward or attainment of Completion.

**Properties:**

- `completionReached` — whether Completion is derived true
- `headline` — calm civic-language completion summary
- `requiredCriteriaProgressLabel` — public-safe criteria progress text
- `derivedAt` — derivation timestamp

Completion Indicators reflect Completion Assessment.

They do not imply manual approval authority.

## Evidence Reference

Identifier or approved citation pointing to evidence without embedding external aggregate content.

**Properties:**

- `referenceId` — stable reference identifier
- `referenceType` — approved reference classification
- `displayLabel` — public-safe label

References maintain aggregate independence.

## Evidence Attachment

Evidence content stored or linked under platform policy within aggregate scope.

**Properties:**

- `attachmentId` — attachment identifier
- `mediaType` — approved media classification
- `displayLabel` — public-safe label
- `storageReference` — platform storage pointer where applicable

Attachments substantiate achievements.

They are not general-purpose file repositories.

## Evidence Link

URL or platform-resolved link to internal or external evidence.

**Properties:**

- `url` — resolved link target
- `displayLabel` — public-safe link label
- `linkKind` — approved link classification

Links increase transparency.

External tool integration is not Version 1 scope.

## Implementation Visibility

Policy-governed rules for operational versus public presentation.

**Properties:**

- `operationalDetailLevel` — approved operational visibility classification
- `publicDetailLevel` — approved public visibility classification
- `evidencePublicExposure` — whether evidence appears on public surfaces and in what form

Visibility is policy-defined.

It must not be bypassed for convenience.

## Implementation Timeline

Ordered presentation model of phases, milestones, achievements and significant updates.

**Properties:**

- `entries` — ordered timeline entries with timestamps and civic labels
- `generatedAt` — timeline generation timestamp

The timeline narrates collective execution history.

It is informational — not a scheduling system in Version 1.

---

# Aggregate References

Implementation references external aggregates by identifier and approved snapshot only.

| Reference                    | Purpose                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `InitiativeId`               | Originating structured proposal                                           |
| `CollectiveDecisionId`       | Approved collective direction                                             |
| `PetitionId`                 | Related public endorsement context                                        |
| `ImplementationCommitmentId` | Preceding preparedness and readiness context                              |
| `FrozenPolicyId`             | Governing frozen policy for milestones, evidence and completion semantics |

**Reference rules:**

- references are identifiers plus immutable snapshots where required for presentation;
- no embedded external Aggregate roots;
- no duplicated Initiative, Petition or Collective Decision operational data;
- no operational graphs from Initiative, Collaborative Analysis, Collective Decision, Petition or Implementation Commitment;
- reads from external modules are read-only at the architectural boundary;
- writes to external aggregates are forbidden from Implementation commands.

Implementation Commitment readiness and contribution detail remain owned by Stage 6.

Implementation reads eligibility context — it does not re-own commitment records.

---

# Aggregate Responsibilities

## Implementation is responsible for

- implementation phases;
- milestones;
- achievements;
- evidence references, attachments and links within aggregate scope;
- collective implementation progress derivation;
- completion assessment derivation;
- implementation history preservation;
- progress snapshots and indicators suitable for workspace and public projection;
- implementation timeline presentation inputs derived from recorded truth.

## Implementation is NOT responsible for

- task management;
- project management;
- scheduling;
- messaging;
- volunteer assignment;
- resource allocation;
- petition management;
- commitment management;
- impact measurement;
- modifying Initiative, Collaborative Analysis, Collective Decision, Petition or Implementation Commitment aggregates;
- employment relationship administration;
- identity administration beyond participant reference for accountable recording roles.

Implementation records **what is being done** collectively.

Impact (Stage 8) owns **what changed**.

---

# Derived Values

The following values are **derived only**.

They must never become manually editable source of truth.

They must never appear as lifecycle states interchangeable with **Implementation Status**.

## Collective Progress

Aggregates recorded Achievements and Milestone satisfaction into community-level advancement indicators.

Computed from:

- satisfied and unsatisfied milestone state;
- recorded achievements;
- applicable Completion Criteria context;
- referenced Frozen Policy rules where they affect progress semantics.

## Completion Assessment

Evaluates whether recorded collective progress satisfies Completion Criteria.

Computed from:

- required milestone satisfaction;
- evidence requirements where policy defines them;
- applicable Frozen Policy completion rules.

## Completion

Reports whether Implementation has reached a derived closed execution state.

```
Achievements + Milestone State + Completion Criteria + Frozen Policy

↓

Completion Assessment

↓

Completion
```

Completion is not Collective Decision re-approval.

It is not manual administrator sign-off.

## Progress Indicator

Presentation-oriented summary of Collective Progress for operational and public surfaces.

## Completion Indicator

Presentation-oriented summary of Completion Assessment outcomes.

---

**Derivation rules:**

- derived values recalculate when Achievements are recorded, Milestones change satisfaction state, or governed policy reference context affects evaluation;
- derived values are read-only at API, store, workspace and public projection layers;
- Achievements, Milestones and Evidence remain authoritative source of truth over summaries;
- Progress Snapshots capture derived state at a moment — they do not replace live derivation authority.

---

# Aggregate Invariants

The following invariants must always hold within Version 1.

## Identity and ownership

**IM-001** — Every Implementation belongs to exactly one approved Initiative through explicit `initiativeId` reference.

**IM-002** — Every Implementation references exactly one Collective Decision, one Petition and one Implementation Commitment on its approved participation path unless Architecture Review approves an alternate reference pattern.

**IM-003** — Every Milestone belongs to exactly one Implementation Phase within one Implementation.

**IM-004** — Every Achievement belongs to exactly one Milestone within one Implementation.

**IM-005** — Every Evidence record belongs to exactly one Achievement within one Implementation.

## Recording integrity

**IM-006** — Achievements are recorded only through accountable operational commands — never inferred or platform-assigned in violation of Human Leadership.

**IM-007** — Implementation history is preserved. Recorded achievements and evidence associations remain auditable after closure.

**IM-008** — Evidence substantiates achievements factually. Opinion, commentary or persuasive narrative must not be stored as Evidence.

## Derived value rules

**IM-009** — Collective Progress is always derived from recorded Achievements and Milestone state.

**IM-010** — Completion Assessment is always derived from Completion Criteria satisfaction — never manually set.

**IM-011** — Completion is always derived from Completion Assessment — never manually toggled as authority.

**IM-012** — Progress Indicators and Completion Indicators are always derived — never manually edited as source of truth.

**IM-013** — Derived values are recalculated when achievements, milestone state or applicable governed policy context changes.

## Policy rules

**IM-014** — Frozen Policy referenced by `frozenPolicyId` is immutable within the aggregate. Policy change requires reference update through governed policy lifecycle — not in-place mutation.

**IM-015** — Completion Criteria and milestone requirement semantics evaluated during derivation originate from Frozen Policy or approved implementation structure — not ad hoc runtime invention.

## Boundary rules

**IM-016** — Implementation never mutates Initiative, Collaborative Analysis, Collective Decision, Petition or Implementation Commitment state.

**IM-017** — Implementation never embeds external aggregate operational structures.

**IM-018** — Implementation records collective achievements — not personal work logs, task boards or individual productivity metrics.

**IM-019** — Required Milestones gate Completion Assessment. Optional Milestones do not block Completion when required criteria are satisfied.

## Historical integrity

**IM-020** — Completed or archived Implementation records remain readable as historical civic execution records.

**IM-021** — Public progress summaries must remain explainable from underlying achievements, milestone state and completion criteria evaluation.

---

# Aggregate Boundaries

Implementation records public implementation progress.

Implementation never manages people's work.

Implementation records collective achievements.

Implementation never records personal work logs.

## Implementation owns

- implementation lifecycle;
- implementation phases;
- milestones;
- achievements;
- evidence within aggregate scope;
- derived Collective Progress;
- derived Completion Assessment;
- derived Completion;
- derived Progress Indicators and Completion Indicators;
- progress snapshots where retained;
- implementation history.

## Implementation references

- Initiative;
- Collective Decision;
- Petition;
- Implementation Commitment;
- Frozen Policy;
- Participant identity for accountable recording roles only.

## Implementation never owns

- external Aggregates;
- commitment declarations or readiness derivation;
- petition support metrics;
- collective decision results;
- impact outcomes;
- task assignments;
- calendars or schedules;
- messaging threads;
- external project management systems.

---

# Future Evolution

The following concepts are **reserved extension points** intentionally excluded from Version 1.

They must not silently enter Epic 06 scope through store convenience or experience drift.

| Reserved concept                            | Future intent                                                       |
| ------------------------------------------- | ------------------------------------------------------------------- |
| **Coordination Space**                      | Richer structured coordination beyond collective progress recording |
| **Task Assignment**                         | Personal or role-based work delegation                              |
| **Calendar**                                | Shared or personal time coordination                                |
| **Scheduling**                              | Shift, slot or deadline assignment                                  |
| **Messaging**                               | Chat or thread-based coordination replacing accountable updates     |
| **Volunteer Coordination**                  | Roster management and dispatch                                      |
| **External Project Management Integration** | Embedded third-party execution tools                                |

Version 1 records **implementation progress only**.

Future capabilities must preserve:

- aggregate independence;
- derived progress and completion discipline;
- operational/public separation;
- Human Leadership;
- calm civic language.

Extension must occur through Architecture Review — not incremental synonym drift.

---

# Relationship to Adjacent Stages

```
Initiative

↓

Collaborative Analysis

↓

Collective Decision

↓

Petition

↓

Implementation Commitment

↓

Implementation   ← this aggregate

↓

Impact
```

| Stage                     | Question                 |
| ------------------------- | ------------------------ |
| Implementation Commitment | Who is prepared to help? |
| **Implementation**        | **What is being done?**  |
| Impact                    | What changed?            |

Each stage preserves aggregate independence.

Journey continuity is presentational.

Ownership is not shared.

---

# Experience Boundaries (Non-Domain)

The following concepts appear in workspaces and public surfaces but are **not** part of this aggregate domain model:

- Humanity Assistant
- Participation Navigator
- Next Meaningful Action presentation
- Contribution Recognition messaging adapted for achievement recording acknowledgment
- Registration Gateway
- Implementation Workspace layout
- Public Implementation projection composition
- Community Observer audience modeling

These belong to Experience Architecture.

They read aggregate state.

They do not redefine aggregate structure.

---

# Final Principle

Implementation transforms approved collective intent into transparent collective progress.

The platform records collective achievements, not individual work logs.

Progress is derived.

Completion is derived.

Implementation follows Commitment.

Implementation does not replace project management software.

Implementation represents the community's **execution record** toward an approved initiative.

It preserves civic accountability at the boundary between preparedness and impact.

It does not measure societal outcomes.

That responsibility belongs to the Impact stage — a separate Aggregate with a separate lifecycle, Workspace and Public Projection.
