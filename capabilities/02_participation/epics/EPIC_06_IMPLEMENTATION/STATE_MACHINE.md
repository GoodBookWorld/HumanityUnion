# STATE MACHINE

## Capability 02 — Participation

### Epic 06 — Implementation

Version: 1.0

Status: Draft

---

# Purpose

Define the lifecycle of the **Implementation** Aggregate.

The state machine specifies how an **Implementation** evolves from initiation to completion while preserving transparency and architectural integrity.

It defines:

- valid lifecycle states;
- allowed transitions;
- command preconditions;
- forbidden transitions;
- aggregate invariants;
- derived value behavior;
- domain events.

**Collective Progress**, **Completion Assessment**, **Completion**, **Progress Indicators** and **Completion Indicators** are not lifecycle states.

Only aggregate lifecycle stages belong to this state machine.

Terminology must conform to:

- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`

---

# Lifecycle

Primary civic progression:

```
Planned

↓

Started

↓

In Progress

↓

Completed

↓

Archived
```

**Planned** prepares the execution record.

**Started** opens accountable collective progress recording.

**In Progress** is the active execution recording period.

**Completed** closes the execution record when derived completion criteria are satisfied.

**Archived** preserves permanent civic history.

---

# States

## Planned

### Why This State Exists

Planned is the preparation stage.

Before collective progress recording begins, references, Frozen Policy attachment, subject snapshots, phase structure and milestone definitions must be defined and validated.

Planned protects communities from recording achievements against incomplete or ineligible context.

### Meaning

The Implementation is being prepared.

It is not yet recording authoritative collective execution progress.

Derived progress and completion values are provisional or empty — not final public claims.

### Allowed

- associate `InitiativeId`, `CollectiveDecisionId`, `PetitionId`, `ImplementationCommitmentId`;
- attach subject title and summary snapshots;
- reference Frozen Policy;
- **Add Phase** and **Add Milestone** in preparatory configuration where policy permits;
- **Update Phase** and **Update Milestone** in preparatory fields;
- transition to **Started** when start conditions are satisfied.

### Not Allowed

- treat Collective Progress or Completion as final public claims;
- modify Frozen Policy content in place;
- mutate Implementation Commitment, Petition, Collective Decision or Initiative aggregates;
- assign tasks or personal work;
- record authoritative Achievements unless explicit future policy defines preparatory staging — Version 1 default: achievements after **Started**.

---

## Started

### Why This State Exists

Started confirms that the Implementation is eligible and opened for collective execution recording.

It separates preparation from active progress accumulation.

Started prevents partially configured implementations from accepting authoritative achievements.

### Meaning

Required references and Frozen Policy attachment are validated.

The implementation record is open.

Transition to **In Progress** may occur immediately or after initial structural configuration per policy.

Collective progress recording becomes eligible subject to command preconditions.

### Allowed

- confirm eligibility against Implementation Commitment and prior pipeline stages;
- finalize phase and milestone structure where permitted;
- **Update Phase** and **Update Milestone** in permitted preparatory fields;
- **Record Achievement** where policy permits recording in Started — Version 1 default: primary recording in **In Progress**;
- transition to **In Progress** when active recording begins.

### Not Allowed

- authoritative completion claims;
- modification of Frozen Policy content in place;
- transition directly to **Completed** or **Archived** without passing through **In Progress**;
- task assignment or scheduling semantics.

---

## In Progress

### Why This State Exists

In Progress is the active collective execution recording period.

Achievements, Evidence and milestone satisfaction are recorded during this state.

Collective Progress and Completion Assessment are derived during this state.

### Meaning

The Implementation accepts accountable achievement recording and evidence attachment.

Phases and milestones may be satisfied through recorded collective accomplishments.

Derived indicators update as truth changes.

### Allowed

- **Add Phase** where policy permits mid-execution structural addition;
- **Update Phase** and **Update Milestone** where permitted without erasing history;
- **Record Achievement**;
- **Attach Evidence**;
- **Complete Milestone** when achievement and criteria conditions are met;
- **Complete Phase** when phase milestone conditions are met;
- derive Collective Progress, Completion Assessment, Completion and related indicators;
- transition to **Completed** when derived completion conditions are satisfied.

### Not Allowed

- modify Frozen Policy in place;
- manually set Collective Progress, Completion Assessment or Completion;
- mutate external aggregates;
- assign personal work or create tasks;
- delete achievement or evidence history;
- treat activity volume or engagement metrics as progress.

---

## Completed

### Why This State Exists

Completed ends successful collective execution recording.

Required milestones and Completion Criteria are satisfied through derived Completion Assessment.

### Meaning

The implementation execution record is closed successfully.

Collective Progress and Completion reflect final derived evaluation.

The aggregate prepares handoff toward **Impact** eligibility — without measuring impact itself.

### Allowed

- finalize derived Collective Progress, Completion Assessment, Completion and indicators;
- preserve immutable achievement and evidence history;
- read-only operational and public access as policy permits;
- transition to **Archived**.

### Not Allowed

- new authoritative Achievements unless explicit future policy defines revision windows;
- manual override of derived completion;
- task assignment or coordination semantics;
- mutation of external aggregates;
- reactivation without explicit future revival policy.

---

## Archived

### Why This State Exists

Archived preserves the Implementation as permanent civic history.

Long-term institutional memory requires read-only records of what was accomplished collectively and how completion was derived.

### Meaning

The Implementation is historical.

It remains understandable as a record of collective execution progress.

No lifecycle progression continues within this aggregate.

### Allowed

- read-only operational access;
- read-only public projection where policy permits;
- historical reference for Impact and future Initiatives.

### Not Allowed

- new achievements or evidence;
- policy mutation;
- lifecycle reactivation without explicit Architecture Review;
- deletion of achievement or evidence history.

---

# Commands

Each command applies to the Aggregate Root.

Commands validate state, policy and eligibility before mutation.

Internal entity commands (phases, milestones, achievements, evidence) mutate through the aggregate entry point only.

---

## Create Implementation

Creates a new Implementation in **Planned**.

### Preconditions

- referenced **Implementation Commitment** exists on the approved participation path;
- referenced Collective Decision Outcome is **Approved**;
- eligible prior pipeline context exists including Commitment readiness context where Version 1 policy requires;
- `InitiativeId`, `CollectiveDecisionId`, `PetitionId` and `ImplementationCommitmentId` are valid references;
- no duplicate Implementation exists for the same approved path where Version 1 uniqueness applies;
- initial subject snapshot is provided;
- `frozenPolicyId` references valid Frozen Policy when supplied or default bootstrap policy applies.

### Effect

- aggregate enters **Planned**;
- emits **ImplementationCreated**.

---

## Start Implementation

Transitions **Planned → Started**.

### Preconditions

- aggregate is in **Planned**;
- subject snapshot is complete;
- `frozenPolicyId` references valid Frozen Policy;
- required references resolve including Implementation Commitment;
- phase and milestone structure satisfies minimum policy requirements if defined;
- start authorization conditions satisfied per policy.

### Effect

- aggregate enters **Started**;
- emits **ImplementationStarted**.

---

## Add Phase

Adds an **Implementation Phase** to the aggregate.

### Preconditions

- aggregate is in **Planned**, **Started**, or **In Progress** as policy permits;
- phase identifier is unique within the aggregate;
- phase title and sequence order are valid;
- command does not violate Frozen Policy structure rules.

### Effect

- Implementation Phase appended;
- emits **PhaseAdded**.

---

## Update Phase

Updates permitted preparatory or in-progress phase fields.

### Preconditions

- aggregate is in **Planned**, **Started**, or **In Progress** as policy permits;
- phase exists and belongs to the aggregate;
- updates do not erase historical meaning after milestones are satisfied unless explicit correction policy applies;
- updates do not mutate Frozen Policy.

### Effect

- phase fields updated;
- derived values recomputed if applicable;
- emits **PhaseUpdated** (reserved event name — may align with **PhaseAdded** family in Version 1 event catalog).

---

## Add Milestone

Adds a **Milestone** to an Implementation Phase.

### Preconditions

- aggregate is in **Planned**, **Started**, or **In Progress** as policy permits;
- target phase exists;
- milestone identifier is unique within the aggregate;
- requirement type (Required or Optional) is valid;
- milestone definition conforms to Frozen Policy or approved implementation structure.

### Effect

- Milestone appended to phase;
- emits **MilestoneAdded**.

---

## Update Milestone

Updates permitted milestone fields.

### Preconditions

- aggregate is in **Planned**, **Started**, or **In Progress** as policy permits;
- milestone exists and belongs to a phase within the aggregate;
- updates do not change satisfied historical meaning without governed correction semantics;
- required milestones remain distinguishable from optional milestones.

### Effect

- milestone fields updated;
- derived values recomputed if applicable;
- emits **MilestoneUpdated** (reserved event name — may align with **MilestoneAdded** family in Version 1 event catalog).

---

## Record Achievement

Records a collective **Achievement** toward a Milestone.

### Preconditions

- aggregate is in **Started** or **In Progress** — Version 1 default: **In Progress** only for authoritative recording;
- target milestone exists and is not already satisfied unless policy permits supplemental achievements;
- achievement title and summary are valid civic-language statements;
- recording occurs through accountable participant command — not assistant automation;
- achievement describes collective accomplishment — not personal task completion.

### Effect

- Achievement appended to milestone;
- Collective Progress, Completion Assessment, Completion and indicators recomputed;
- emits **AchievementRecorded** and **ProgressUpdated** as applicable.

---

## Attach Evidence

Attaches **Evidence** to an Achievement.

### Preconditions

- aggregate is in **Started** or **In Progress** — Version 1 default: **In Progress** only for authoritative attachment;
- achievement exists and belongs to the aggregate;
- evidence kind (Reference, Attachment, Link) is valid;
- evidence label and payload conform to visibility policy;
- evidence substantiates achievement — it does not replace achievement recording.

### Effect

- Evidence associated with achievement;
- emits **EvidenceAttached**.

---

## Complete Milestone

Marks a **Milestone** as satisfied when achievement and criteria conditions are met.

### Preconditions

- aggregate is in **In Progress**;
- milestone exists and is not already satisfied;
- recorded achievements and evidence satisfy milestone completion rules per Frozen Policy or approved structure;
- completion is evaluated from recorded truth — not manual checkbox alone without underlying achievements where policy requires them.

### Effect

- milestone satisfaction state updated;
- derived values recomputed;
- emits **MilestoneCompleted** and **ProgressUpdated** as applicable.

---

## Complete Phase

Marks an **Implementation Phase** as complete when its milestone conditions are satisfied.

### Preconditions

- aggregate is in **In Progress**;
- phase exists;
- required milestones within the phase are satisfied per policy;
- optional milestones do not block phase completion unless policy explicitly requires otherwise.

### Effect

- phase completion state updated;
- derived values recomputed;
- emits **PhaseCompleted** and **ProgressUpdated** as applicable.

---

## Complete Implementation

Transitions **In Progress → Completed**.

### Preconditions

- aggregate is in **In Progress**;
- all **Required Milestones** are satisfied;
- **Completion Assessment** derivation satisfies Completion Criteria;
- **Completion** derivation is true;
- required phases complete per policy where applicable;
- completion is derived — command validates derivation; it does not manually force completion against unsatisfied criteria.

### Effect

- aggregate enters **Completed**;
- final derived values stabilized;
- emits **ImplementationCompleted** and **CompletionUpdated**.

---

## Archive Implementation

Transitions **Completed → Archived**.

### Preconditions

- aggregate is in **Completed**;
- final derived values are stable;
- historical preservation requirements satisfied.

Version 1 default: archive from **Completed** only.

Future policy may define alternate archival entry — not in Version 1.

### Effect

- aggregate enters **Archived**;
- aggregate becomes read-only;
- emits **ImplementationArchived**.

---

# Allowed Transitions

## Valid aggregate transitions

```
Planned → Started

Started → In Progress

In Progress → Completed

Completed → Archived
```

## Transition conditions summary

| Transition | Entry requirement |
|------------|-------------------|
| Planned → Started | References complete; Frozen Policy attached; start conditions satisfied |
| Started → In Progress | Active collective recording authorized; structure validated |
| In Progress → Completed | Required milestones satisfied; Completion Assessment and Completion derived true |
| Completed → Archived | Final derivation stable; historical retention satisfied |

## Valid supporting entity transitions (within aggregate)

| Entity | Transition | Entry requirement |
|--------|------------|-------------------|
| Milestone | Open → Satisfied | Achievement and criteria conditions met via **Complete Milestone** |
| Phase | Open → Complete | Phase milestone conditions met via **Complete Phase** |
| Achievement | — | Recorded once; history preserved |
| Evidence | — | Attached to existing achievement; history preserved |

---

# Forbidden Transitions

The following aggregate transitions are **not allowed**:

```
Planned → In Progress
Planned → Completed
Planned → Archived

Started → Completed
Started → Archived

In Progress → Archived
In Progress → Planned
In Progress → Started

Completed → In Progress
Completed → Started
Completed → Planned

Archived → Planned
Archived → Started
Archived → In Progress
Archived → Completed
```

## Forbidden command patterns

| Pattern | Reason |
|---------|--------|
| Manual set of Collective Progress | Derived only — Decision 03 |
| Manual set of Completion | Derived only — Decision 04 |
| Achievement without Milestone | Invariant **IM-004** |
| Milestone without Phase | Invariant **IM-003** |
| Evidence without Achievement | Invariant **IM-005** |
| Create Implementation without Commitment reference | Decision 01 |
| In-place Frozen Policy mutation | Decision 08 |
| Cross-aggregate mutation | Invariant **IM-016** |
| Task assignment commands | Decision 09 |
| Assistant-recorded achievements | Decision 11 |

---

# Derived Values

The following values are **computed**.

They are **never manually modified**.

## Collective Progress

Aggregates recorded Achievements and Milestone satisfaction into community-level advancement indicators.

Recalculates when:

- achievements are recorded;
- milestones are completed;
- milestone or phase structure changes where permitted;
- governed policy reference context affects progress semantics.

## Completion Assessment

Evaluates whether Completion Criteria — including required milestone satisfaction — are met.

Recalculates when Collective Progress inputs or milestone satisfaction state changes.

## Completion

Reports whether Implementation has reached derived closed execution state.

```
Achievements + Milestone State + Completion Criteria + Frozen Policy

↓

Completion Assessment

↓

Completion
```

**Complete Implementation** command validates derived Completion — it does not bypass derivation.

## Progress Indicator

Presentation-oriented summary of Collective Progress.

Read-only derived output for workspace and public surfaces.

## Completion Indicator

Presentation-oriented summary of Completion Assessment outcomes.

Read-only derived output for workspace and public surfaces.

---

# Events

Domain events describe meaningful aggregate and derivation changes.

Version 1 may record events in documentation and future event bus integration.

Events do not mutate state by themselves.

## Lifecycle events

| Event | Emitted when |
|-------|--------------|
| **ImplementationCreated** | **Create Implementation** succeeds |
| **ImplementationStarted** | **Start Implementation** succeeds |
| **ImplementationCompleted** | **Complete Implementation** succeeds |
| **ImplementationArchived** | **Archive Implementation** succeeds |

## Structure events

| Event | Emitted when |
|-------|--------------|
| **PhaseAdded** | **Add Phase** succeeds |
| **MilestoneAdded** | **Add Milestone** succeeds |
| **MilestoneCompleted** | **Complete Milestone** succeeds |
| **PhaseCompleted** | **Complete Phase** succeeds |

## Recording events

| Event | Emitted when |
|-------|--------------|
| **AchievementRecorded** | **Record Achievement** succeeds |
| **EvidenceAttached** | **Attach Evidence** succeeds |

## Derivation events

| Event | Emitted when |
|-------|--------------|
| **ProgressUpdated** | Collective Progress or Progress Indicator derivation changes |
| **CompletionUpdated** | Completion Assessment, Completion or Completion Indicator derivation changes |

---

# Aggregate Invariants

The following invariants must always hold within Version 1.

State machine enforcement references domain invariants **IM-001** through **IM-021** where applicable.

## Eligibility and ownership

**SM-001** — Implementation begins only after eligible **Implementation Commitment** reference exists on the approved participation path.

**SM-002** — Every Implementation belongs to exactly one approved Initiative through explicit reference.

**SM-003** — Every Phase belongs to exactly one Implementation.

**SM-004** — Every Milestone belongs to exactly one Phase.

**SM-005** — Every Achievement belongs to exactly one Milestone.

**SM-006** — Every Evidence record belongs to exactly one Achievement.

## Derivation rules

**SM-007** — Collective Progress is always derived from recorded Achievements and Milestone state.

**SM-008** — Completion Assessment is always derived from Completion Criteria satisfaction.

**SM-009** — Completion is always derived from Completion Assessment — never manually set as authority.

**SM-010** — Progress Indicators and Completion Indicators are always derived — never manually edited as source of truth.

## Integrity rules

**SM-011** — Achievement and evidence history is preserved. Closure changes lifecycle state — it does not erase records.

**SM-012** — Frozen Policy referenced by `frozenPolicyId` is immutable in place during Implementation.

**SM-013** — Implementation never mutates Initiative, Collaborative Analysis, Collective Decision, Petition or Implementation Commitment aggregates.

**SM-014** — Required Milestones gate Completion Assessment. Optional Milestones do not block Completion when required criteria are satisfied.

## Boundary rules

**SM-015** — Implementation records collective achievements — not personal work logs or task assignments.

**SM-016** — Public summaries must remain explainable from underlying achievements, milestone state and completion criteria evaluation.

---

# Future Evolution

The following lifecycle extensions are **reserved for future versions**.

They are **not part of Version 1**.

| Reserved event / concept | Future intent |
|--------------------------|---------------|
| **CoordinationStarted** | Adjacent coordination capability begins — not aggregate lifecycle state in V1 |
| **TaskLinked** | External or future task reference attached without task ownership in Implementation |
| **CalendarSynchronized** | External calendar alignment — not scheduling ownership in V1 |

Additional reserved extensions may include:

- **MessagingThreadLinked**
- **VolunteerRosterSynced**
- **ExternalProjectLinked**

Future introduction must:

- preserve Version 1 aggregate lifecycle semantics;
- attach as independent capabilities or bounded extensions;
- proceed through Architecture Review;
- not require redesign of core Implementation responsibilities defined in Decision 15.

Version 1 lifecycle remains:

```
Planned → Started → In Progress → Completed → Archived
```

---

# Final Principle

Implementation records verified collective progress.

It never manages individual work.

Completion is derived from achieved collective outcomes.

The state machine exists so engineering preserves the distinction between **preparedness**, **collective accomplishment** and **closure** throughout Version 1 implementation.

Lifecycle follows architecture.

Architecture never follows lifecycle convenience.
