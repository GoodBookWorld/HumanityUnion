# DOMAIN MODEL

## Capability 02 — Participation

### Epic 05 — Implementation Commitment

Version: 1.0

Status: Draft

---

# Purpose

This document defines the domain model for the **Implementation Commitment** Aggregate.

Implementation Commitment is Stage 6 of the Humanity Union Participation Pipeline.

Its responsibility is to collect declared participant preparedness, aggregate community capacity and derive implementation readiness against frozen policy — without managing implementation execution itself.

This document describes architectural structure only.

It does not define implementation.

Terminology must conform to:

- `DOMAIN_LANGUAGE.md`
- `PARTICIPATION_ARCHITECTURE_FREEZE.md`

---

# Aggregate Root

## Implementation Commitment

**Implementation Commitment** is the Aggregate Root.

It represents one civic commitment collection context for turning an approved participation path toward responsible implementation preparedness.

One Implementation Commitment instance:

- references one approved participation path through aggregate identifiers;
- owns commitment lifecycle state;
- owns recorded Contribution Items;
- owns applied Implementation Policy reference;
- derives Community Capacity, Implementation Readiness, Policy Satisfaction and Contribution Summary;
- preserves commitment history.

The Aggregate Root is the only entry point for mutations within this boundary.

External systems interact with Implementation Commitment commands — not with internal entities in isolation.

---

# Aggregate Structure

```
Implementation Commitment

↓

Contribution Profile (per Participant, within aggregate boundary)

↓

Contribution Items

↓

Community Capacity (derived)

↓

Implementation Readiness (derived)
```

Structural rules:

- **Implementation Commitment** is the root container and lifecycle authority.
- **Contribution Profile** summarizes one participant's declared preparedness within this commitment context.
- **Contribution Item** is the atomic recorded declaration.
- **Community Capacity** aggregates all active contribution declarations.
- **Implementation Readiness** evaluates capacity against frozen policy thresholds.

Derived values never replace recorded Contribution Items as source of truth.

---

# Entities

Entities have identity and lifecycle within the aggregate.

## Implementation Commitment

The Aggregate Root entity.

**Identity:** `ImplementationCommitmentId`

**Core properties:**

| Property                     | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| `implementationCommitmentId` | Unique aggregate identifier                    |
| `initiativeId`               | Reference to originating Initiative            |
| `collectiveDecisionId`       | Reference to approved Collective Decision      |
| `petitionId`                 | Reference to related Petition where applicable |
| `status`                     | Commitment lifecycle state                     |
| `subjectTitle`               | Approved subject title snapshot                |
| `subjectSummary`             | Approved subject summary snapshot              |
| `frozenPolicyId`             | Reference to governing Frozen Policy           |
| `createdAt`                  | Aggregate creation timestamp                   |
| `updatedAt`                  | Last mutation timestamp                        |

**Owned collections:**

- contribution profiles keyed by participant;
- contribution items;
- community needs summary references where modeled within aggregate scope.

**Derived snapshots (read-only within aggregate):**

- `communityCapacity`
- `implementationReadiness`
- `policySatisfaction`
- `contributionSummary`

The root enforces invariants and coordinates command application.

## Contribution Item

A **Contribution Item** is one participant's recorded declaration of preparedness toward implementation.

**Identity:** `ContributionItemId`

**Properties:**

| Property                     | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `contributionItemId`         | Unique item identifier                             |
| `implementationCommitmentId` | Owning aggregate                                   |
| `participantId`              | Declaring participant                              |
| `contributionType`           | Volunteer, Professional or Resource classification |
| `contributionCapacity`       | Declared measurable capacity                       |
| `availability`               | Declared availability window                       |
| `commitmentStatus`           | Lifecycle status of this declaration               |
| `declaredAt`                 | Timestamp of original declaration                  |
| `updatedAt`                  | Timestamp of last permitted status change          |
| `withdrawnAt`                | Timestamp when withdrawn, if applicable            |

**Rules:**

- belongs to exactly one Implementation Commitment;
- belongs to exactly one participant's Contribution Profile within that commitment;
- is append-preserving: withdrawal changes status — it does not erase history;
- may be immutable after declaration except where Frozen Policy explicitly permits status revision.

Contribution Item expresses **preparedness to help** — not completed implementation work.

---

# Value Objects

Value objects have no independent lifecycle outside the aggregate context.

## Contribution Profile

Participant-owned summary of declared preparedness within one Implementation Commitment.

**Properties:**

- `participantId`
- `contributionItemIds` — ordered references to owned items
- optional skill summary text approved for matching
- optional regional or organizational context labels where policy permits

A Contribution Profile groups one participant's Contribution Items.

It does not exist as a separate aggregate.

## Availability

Declared time or window during which a participant may contribute.

**Properties:**

- `startsAt` — optional start boundary
- `endsAt` — optional end boundary
- `description` — human-readable availability note where needed

Availability is declared by the participant.

It is not a schedule assignment.

## Contribution Type

Classification of declared contribution nature.

**Version 1 values:**

- `Volunteer`
- `Professional`
- `Resource`

Contribution Type is immutable on a recorded Contribution Item unless policy defines superseding declaration flow.

## Commitment Status

Lifecycle meaning of a Contribution Item or aggregate collection phase.

**Version 1 semantic examples:**

- `Declared` — recorded and active within policy
- `Withdrawn` — participant withdrew where permitted; history preserved
- `Satisfied` — declaration fulfilled relative to policy meaning for closure of commitment phase

Commitment Status vocabulary belongs to Implementation Commitment.

It must not reuse Petition, Collective Decision or Implementation execution statuses.

## Community Capacity

**Derived** aggregate measure of declared community preparedness.

**Properties:**

- `totalContributions` — count of active declared items
- `contributionsByType` — counts grouped by Contribution Type
- `aggregateAvailabilitySummary` — high-level availability picture
- `skillCoverageSummary` — alignment indicators against community needs
- `derivedAt` — derivation timestamp

Community Capacity is computed from Contribution Items.

It is never manually edited.

## Implementation Readiness

**Derived** evaluation of whether Community Capacity satisfies Frozen Policy.

**Properties:**

- `readinessReached` — boolean summary
- `readinessScore` — optional normalized indicator where policy defines scoring
- `satisfiedThresholds` — list of met Readiness Threshold identifiers
- `unsatisfiedThresholds` — list of unmet threshold identifiers
- `derivedAt` — derivation timestamp
- `explanation` — civic-language summary of readiness meaning

```
Community Capacity + Frozen Policy → Implementation Readiness
```

Readiness is not approval of the collective decision.

It is not authorization to bypass governance.

## Readiness Threshold

Frozen Policy requirement against which capacity is evaluated.

**Properties:**

- `thresholdId`
- `description`
- `contributionType` — optional type scope
- `minimumCount` — optional count requirement
- `minimumCapacity` — optional capacity measure
- `requiredSkillLabel` — optional skill category

Thresholds are defined by Frozen Policy reference — not invented at derivation time.

## Policy Satisfaction

**Derived** indicator that Frozen Policy conditions relevant to readiness or progression are satisfied.

**Properties:**

- `satisfied` — whether applicable policy conditions are met
- `evaluatedAt` — evaluation timestamp
- `explanation` — civic-language statement of satisfaction meaning

Policy Satisfaction may align with Living Policy lifecycle **Satisfied** stage for a superseded policy generation at the governance layer.

Within the aggregate, it expresses evaluative outcome — not manual toggle.

---

# Aggregate References

Implementation Commitment references external aggregates by identifier and approved snapshot only.

| Reference              | Purpose                                |
| ---------------------- | -------------------------------------- |
| `InitiativeId`         | Originating structured proposal        |
| `CollectiveDecisionId` | Approved collective direction          |
| `PetitionId`           | Related public endorsement context     |
| `ParticipantId`        | Declaring participant identity         |
| `FrozenPolicyId`       | Governing frozen implementation policy |

**Reference rules:**

- references are identifiers plus immutable snapshots where required for presentation;
- no embedded external Aggregate roots;
- no operational graphs from Initiative, Collaborative Analysis, Collective Decision or Petition;
- reads from external modules are read-only at the architectural boundary;
- writes to external aggregates are forbidden from Implementation Commitment commands.

---

# Derived Values

The following values are **derived only**.

They must never become manually editable source of truth.

## Community Capacity

Aggregates declared Contribution Items into community-level preparedness indicators.

## Implementation Readiness

Evaluates Community Capacity against Readiness Thresholds from Frozen Policy.

## Policy Satisfaction

Reports whether evaluated policy conditions are met for the current commitment context.

## Contribution Summary

High-level derived summary for workspace and public projection surfaces.

**May include:**

- total active declarations;
- distribution by Contribution Type;
- readiness headline in civic language;
- threshold progress in public-safe terms.

Contribution Summary is presentation-oriented derivation.

It does not replace underlying Contribution Items or capacity objects.

---

# Aggregate Responsibilities

## Implementation Commitment is responsible for

- participant commitments;
- contribution profiles;
- contribution items;
- commitment lifecycle within its boundary;
- policy satisfaction evaluation against referenced Frozen Policy;
- contribution aggregation into Community Capacity;
- derivation of Implementation Readiness;
- preservation of commitment history including withdrawals;
- capability matching inputs derived from declarations and community needs within aggregate scope.

## Implementation Commitment is NOT responsible for

- project management;
- task assignment;
- scheduling of implementation work;
- implementation execution;
- funding management or payment processing;
- petition support or signature collection;
- collective decision-making or ballot replay;
- modifying Initiative, Collaborative Analysis, Collective Decision or Petition aggregates;
- employment relationship creation;
- identity administration beyond participant reference.

Implementation Commitment prepares **who is prepared to help**.

Implementation (Stage 7) owns **what is being done**.

---

# Aggregate Invariants

The following invariants must always hold within Version 1.

## Identity and ownership

**IC-001** — One Implementation Commitment references one approved participation path through explicit aggregate references.

**IC-002** — One active commitment declaration per participant per Implementation Commitment context unless Frozen Policy explicitly defines supersession rules.

**IC-003** — Every Contribution Item belongs to exactly one Implementation Commitment and one participant Contribution Profile.

## Declaration integrity

**IC-004** — Contribution Items are recorded only through accountable participant declaration commands — never inferred or platform-assigned without human leadership violation.

**IC-005** — Contribution history is preserved. Withdrawal changes status; it does not delete historical records.

**IC-006** — Declared Availability and Contribution Capacity on a recorded item remain auditable after withdrawal.

## Derived value rules

**IC-007** — Community Capacity is always derived from recorded Contribution Items.

**IC-008** — Implementation Readiness is always derived from Community Capacity and Frozen Policy thresholds.

**IC-009** — Policy Satisfaction is always derived — never manually set.

**IC-010** — Derived values are recalculated when declarations or applicable policy reference state changes.

## Policy rules

**IC-011** — Frozen Policy referenced by `frozenPolicyId` is immutable within the aggregate. Policy change requires reference update through governed policy lifecycle — not in-place mutation.

**IC-012** — Readiness Thresholds evaluated during derivation originate from Frozen Policy — not ad hoc runtime invention.

## Boundary rules

**IC-013** — Implementation Commitment never mutates Initiative, Collaborative Analysis, Collective Decision or Petition state.

**IC-014** — Implementation Commitment never embeds external aggregate operational structures.

**IC-015** — Commitment declarations express preparedness — not task completion, employment status or implementation progress.

## Historical integrity

**IC-016** — Archived or satisfied commitment phases remain readable as historical civic record.

**IC-017** — Aggregate public summaries must remain explainable from underlying declarations and frozen policy evaluation.

---

# Aggregate Boundaries

Implementation Commitment owns:

- commitment lifecycle;
- Contribution Profiles within context;
- Contribution Items;
- derived Community Capacity;
- derived Implementation Readiness;
- derived Policy Satisfaction;
- derived Contribution Summary;
- commitment history.

Implementation Commitment references:

- Initiative;
- Collective Decision;
- Petition;
- Participant;
- Frozen Policy.

Implementation Commitment never owns external Aggregates.

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

Implementation Commitment   ← this aggregate

↓

Implementation

↓

Impact
```

| Stage                         | Question                            |
| ----------------------------- | ----------------------------------- |
| Petition                      | Does society support this decision? |
| **Implementation Commitment** | **Who is prepared to help?**        |
| Implementation                | What is being done?                 |

Each stage preserves aggregate independence.

Journey continuity is presentational.

Ownership is not shared.

---

# Experience Boundaries (Non-Domain)

The following concepts appear in workspaces and public surfaces but are **not** part of this aggregate domain model:

- Humanity Assistant
- Policy Assistant
- Participation Navigator
- Next Meaningful Action presentation
- Contribution Recognition messaging
- Registration Gateway
- Workspace layout
- Public Projection composition

These belong to Experience Architecture.

They read aggregate state.

They do not redefine aggregate structure.

---

# Final Principle

Implementation Commitment represents the community's **declared capacity** to implement an approved initiative.

It collects preparedness, evaluates readiness and preserves civic accountability at the boundary between endorsement and execution.

It does not manage implementation itself.

That responsibility belongs to the Implementation stage — a separate Aggregate with a separate lifecycle, Workspace and Public Projection.
