# STATE MACHINE

## Capability 02 — Participation

### Epic 05 — Implementation Commitment

Version: 1.0

Status: Draft

---

# Purpose

Define the lifecycle of the **Implementation Commitment** Aggregate.

The state machine specifies:

- valid lifecycle states;
- allowed transitions;
- command preconditions;
- forbidden transitions;
- aggregate invariants;
- derived value behavior;
- domain events.

**Community Capacity**, **Implementation Readiness**, **Policy Satisfaction** and **Contribution Summary** are not lifecycle states.

Only aggregate lifecycle stages belong to this state machine.

Terminology must conform to:

- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`

---

# Lifecycle

Primary civic progression:

```
Draft

↓

Submitted

↓

Active

↓

Completed

↓

Archived
```

Alternate terminal branch from **Active**:

```
Active

↓

Withdrawn

↓

Archived
```

**Withdrawn** represents an aggregate-level withdrawal of the commitment collection phase — not individual participant item withdrawal while the aggregate remains Active.

Individual participant withdrawal is handled by the **Withdraw Commitment** command on Contribution Items while the aggregate may remain **Active**.

---

# States

## Draft

### Why This State Exists

Draft is the preparation stage.

Before commitment collection begins, references, Frozen Policy attachment, subject snapshots and commitment configuration must be defined and reviewed.

Draft protects participants from declaring contributions against incomplete or ineligible context.

### Meaning

The Implementation Commitment is being prepared.

It is not yet accepting public or operational commitment collection as an active civic stage.

Contribution declarations are not yet authoritative for readiness derivation in the active sense.

### Allowed

- associate `InitiativeId`, `CollectiveDecisionId`, `PetitionId`;
- attach subject title and summary snapshots;
- reference Frozen Policy;
- configure commitment collection parameters permitted in Draft;
- update internal preparation fields;
- transition to **Submitted** when preparation is complete.

### Not Allowed

- treat Community Capacity or Implementation Readiness as final public claims;
- modify Frozen Policy content in place;
- mutate Petition or Collective Decision aggregates;
- assign implementation tasks.

---

## Submitted

### Why This State Exists

Submitted confirms that the Implementation Commitment is internally complete and eligible for activation.

It separates preparation from active capacity collection.

Submitted prevents partially configured commitments from accepting declarations.

### Meaning

The commitment context is validated and submitted for activation review.

Required references and Frozen Policy attachment are in place.

Active collection has not yet begun.

### Allowed

- final review of commitment context;
- confirm eligibility against prior pipeline stages;
- update Contribution Profile structure where policy permits pre-activation edits;
- transition to **Active** when activation conditions are satisfied.

### Not Allowed

- authoritative readiness claims implying completed collection;
- modification of Frozen Policy content in place;
- transition directly to **Completed** or **Archived** without passing through **Active** unless explicit future policy defines otherwise.

---

## Active

### Why This State Exists

Active is the commitment collection period.

Participants declare preparedness through Contribution Items.

Community Capacity and Implementation Readiness are derived during this state.

### Meaning

The Implementation Commitment accepts accountable contribution declarations.

Contribution Profiles and Contribution Items may be recorded subject to policy.

Capability matching inputs are evaluated from declarations and community needs.

Implementation Readiness may change as capacity accumulates.

### Allowed

- **Add Contribution Item**;
- **Update Contribution Profile** where permitted;
- **Remove Contribution Item** only where Frozen Policy explicitly permits pre-finalization removal in Active — otherwise use withdrawal;
- **Withdraw Commitment** at participant item level;
- derive Community Capacity, Implementation Readiness, Policy Satisfaction and Contribution Summary;
- Contribution Recognition after accountable declarations;
- recommend Next Meaningful Action;
- transition to **Completed** when completion conditions are met;
- transition to **Withdrawn** when aggregate-level withdrawal conditions are met.

### Not Allowed

- modify Frozen Policy in place;
- manually set Implementation Readiness or Community Capacity;
- mutate Petition, Collective Decision, Initiative or Collaborative Analysis;
- assign implementation work or create tasks;
- delete contribution history;
- treat popularity or signature counts as capacity.

---

## Withdrawn

### Why This State Exists

Withdrawn ends the commitment collection phase without successful completion.

It preserves historical record while making clear that the commitment phase was withdrawn at aggregate level.

### Meaning

Active collection has ended through withdrawal.

New contribution declarations are not accepted.

Existing declaration history remains auditable.

Derived values reflect final withdrawn-state evaluation.

### Allowed

- preserve Contribution Item history including withdrawn participant declarations;
- final derivation of Community Capacity and readiness-related summaries for historical record;
- read-only operational and public access as policy permits;
- transition to **Archived**.

### Not Allowed

- new Contribution Items;
- new participant declarations;
- transition to **Completed**;
- erasure of historical declarations;
- in-place Frozen Policy mutation.

---

## Completed

### Why This State Exists

Completed ends successful commitment collection.

The community has declared capacity and Implementation Readiness evaluation has reached completion conditions defined by Frozen Policy.

### Meaning

Commitment collection phase is finished successfully.

Implementation Readiness and Policy Satisfaction reflect final derived evaluation.

The aggregate prepares handoff toward **Implementation** eligibility — without executing implementation itself.

### Allowed

- finalize derived Community Capacity, Implementation Readiness, Policy Satisfaction and Contribution Summary;
- preserve immutable commitment history;
- read-only review of declarations and readiness meaning;
- transition to **Archived**.

### Not Allowed

- new Contribution Items unless explicit future policy defines revision windows;
- manual override of derived readiness;
- implementation task assignment;
- mutation of external aggregates;
- reactivation without explicit future revival policy.

---

## Archived

### Why This State Exists

Archived preserves the Implementation Commitment as permanent civic history.

Long-term institutional memory requires read-only records of who declared preparedness and what readiness was derived.

### Meaning

The Implementation Commitment is historical.

It remains understandable as a record of declared capacity.

No lifecycle progression continues within this aggregate.

### Allowed

- read-only operational access;
- read-only public projection where policy permits;
- historical reference for Implementation and Impact stages.

### Not Allowed

- new contribution declarations;
- policy mutation;
- lifecycle reactivation without explicit Architecture Review;
- deletion of contribution history.

---

# Commands

Each command applies to the Aggregate Root.

Commands validate state, policy and eligibility before mutation.

## Create Commitment

Creates a new Implementation Commitment in **Draft**.

### Preconditions

- referenced Collective Decision Outcome is **Approved**;
- eligible prior pipeline context exists (including Petition stage completion where Version 1 policy requires);
- `InitiativeId`, `CollectiveDecisionId` and applicable `PetitionId` are valid references;
- no duplicate Implementation Commitment exists for the same approved path where Version 1 uniqueness applies;
- initial subject snapshot is provided.

### Effect

- aggregate enters **Draft**;
- emits **CommitmentCreated**.

---

## Submit Commitment

Transitions **Draft → Submitted**.

### Preconditions

- aggregate is in **Draft**;
- subject snapshot is complete;
- `frozenPolicyId` references valid Frozen Policy;
- required references resolve;
- internal preparation validation passes.

### Effect

- aggregate enters **Submitted**;
- emits **CommitmentSubmitted**.

---

## Activate Commitment

Transitions **Submitted → Active**.

### Preconditions

- aggregate is in **Submitted**;
- activation authorization conditions satisfied;
- Frozen Policy is attached and immutable;
- commitment collection window may begin per policy.

### Effect

- aggregate enters **Active**;
- contribution collection becomes authoritative for derivation;
- emits **CommitmentActivated**.

---

## Update Contribution Profile

Updates participant Contribution Profile metadata within policy rules.

### Preconditions

- aggregate is in **Draft**, **Submitted**, or **Active** as policy permits;
- participant is registered and eligible;
- updates do not violate one active commitment invariant;
- updates do not mutate Frozen Policy.

### Effect

- profile fields updated;
- emits **ContributionProfileUpdated**.

---

## Add Contribution Item

Records a new Contribution Item declaration.

### Preconditions

- aggregate is in **Active** (unless policy explicitly permits earlier staging in **Submitted** — Version 1 default: **Active** only);
- participant is eligible under Frozen Policy;
- participant does not already have an active declaration for this commitment context unless supersession policy applies;
- contribution type, capacity and availability are valid;
- participant declares through accountable command — not assistant automation.

### Effect

- Contribution Item appended;
- Community Capacity, Implementation Readiness, Policy Satisfaction and Contribution Summary recomputed;
- emits **ContributionAdded** and **CommunityCapacityUpdated** / **ImplementationReadinessUpdated** as applicable.

---

## Remove Contribution Item

Removes a Contribution Item from active collection only where explicitly permitted — distinct from withdrawal.

### Preconditions

- aggregate is in **Draft** or **Submitted**, OR **Active** only if Frozen Policy explicitly permits removal before finalization;
- item exists and belongs to the aggregate;
- removal is not used to erase history after declaration finalization — use **Withdraw Commitment** instead when history must be preserved.

Version 1 default: removal primarily in preparatory states; Active uses withdrawal, not deletion.

### Effect

- item removed from active set where permitted;
- derived values recomputed;
- emits **ContributionRemoved** and derived update events as applicable.

---

## Withdraw Commitment

Withdraws a participant's contribution declaration or the aggregate commitment phase.

### Participant item withdrawal

### Preconditions

- aggregate is in **Active**;
- Contribution Item exists and is active;
- Frozen Policy permits withdrawal;
- participant owns the declaration or authorized coordinator acts within policy — never assistant automation.

### Effect

- item **Commitment Status** becomes **Withdrawn**;
- history preserved;
- derived values recomputed;
- emits **CommitmentWithdrawn** and derived update events.

### Aggregate withdrawal (Active → Withdrawn)

### Preconditions

- aggregate is in **Active**;
- aggregate-level withdrawal authorization satisfied per policy;
- no transition to **Completed** is appropriate.

### Effect

- aggregate enters **Withdrawn**;
- emits **CommitmentWithdrawn**.

---

## Complete Commitment

Transitions **Active → Completed**.

### Preconditions

- aggregate is in **Active**;
- Implementation Readiness derivation satisfies Frozen Policy completion conditions;
- Policy Satisfaction conditions for completion are met;
- commitment collection period end conditions satisfied if policy defines a window.

### Effect

- aggregate enters **Completed**;
- final derived values stabilized;
- emits **CommitmentCompleted** and final derived update events.

---

## Archive Commitment

Transitions **Completed → Archived** or **Withdrawn → Archived**.

### Preconditions

- aggregate is in **Completed** or **Withdrawn**;
- final derived values are stable;
- historical preservation requirements satisfied.

### Effect

- aggregate enters **Archived**;
- aggregate becomes read-only;
- emits **CommitmentArchived**.

---

# Allowed Transitions

## Valid aggregate transitions

```
Draft → Submitted

Submitted → Active

Active → Completed

Active → Withdrawn

Completed → Archived

Withdrawn → Archived
```

## Transition conditions summary

| Transition           | Entry requirement                                           |
| -------------------- | ----------------------------------------------------------- |
| Draft → Submitted    | Preparation complete; references and Frozen Policy attached |
| Submitted → Active   | Activation authorized; policy immutable                     |
| Active → Completed   | Readiness and policy completion conditions satisfied        |
| Active → Withdrawn   | Aggregate-level withdrawal authorized                       |
| Completed → Archived | Final derivation stable; historical retention               |
| Withdrawn → Archived | Withdrawn record stable; historical retention               |

---

# Forbidden Transitions

The following aggregate transitions are **not allowed**:

```
Draft → Active
Draft → Completed
Draft → Withdrawn
Draft → Archived

Submitted → Completed
Submitted → Withdrawn
Submitted → Archived

Active → Archived

Completed → Active
Completed → Withdrawn
Completed → Draft
Completed → Submitted

Withdrawn → Active
Withdrawn → Completed
Withdrawn → Draft
Withdrawn → Submitted

Archived → Draft
Archived → Submitted
Archived → Active
Archived → Completed
Archived → Withdrawn
```

Additional forbidden behaviors (not state jumps but invariant violations):

- any transition that mutates Frozen Policy in place;
- any transition that deletes Contribution Item history after accountable declaration;
- any transition that modifies Petition or Collective Decision;
- any command that assigns implementation tasks;
- any command that sets Implementation Readiness manually.

---

# Derived Values

The following values are **derived only**.

They never appear as lifecycle states.

## Community Capacity

Aggregates active Contribution Items into community-level preparedness indicators.

**Derived because:** capacity must reflect recorded human declarations — not manual administrator entry or popularity proxies.

**Recalculated when:** Contribution Items are added, removed where permitted, or withdrawn; aggregate activation or completion changes active set.

## Implementation Readiness

Evaluates Community Capacity against Readiness Thresholds from Frozen Policy.

**Derived because:** readiness must be explainable from capacity + policy — not a second approval vote or manual go-live flag.

**Recalculated when:** Community Capacity changes or Frozen Policy reference changes through governed lifecycle only.

## Policy Satisfaction

Reports whether evaluated Frozen Policy conditions are met.

**Derived because:** satisfaction is an evaluative outcome — not a toggle.

**Recalculated when:** readiness evaluation inputs change.

## Contribution Summary

High-level summary for workspace and public projection surfaces.

**Derived because:** summaries present derived truth for orientation — they must not become alternate source of truth over Contribution Items.

**Recalculated when:** any underlying derived value or active declaration set changes.

---

# Events

Domain events record meaningful state changes.

Events preserve historical meaning.

Events do not replace aggregate state.

## Lifecycle events

| Event                   | Meaning                                           |
| ----------------------- | ------------------------------------------------- |
| **CommitmentCreated**   | Aggregate created in Draft                        |
| **CommitmentSubmitted** | Draft preparation submitted                       |
| **CommitmentActivated** | Active collection begins                          |
| **CommitmentWithdrawn** | Participant item or aggregate withdrawal recorded |
| **CommitmentCompleted** | Successful completion of collection phase         |
| **CommitmentArchived**  | Historical read-only preservation                 |

## Contribution events

| Event                          | Meaning                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| **ContributionProfileUpdated** | Participant profile metadata changed within policy                 |
| **ContributionAdded**          | New Contribution Item recorded                                     |
| **ContributionRemoved**        | Item removed where policy permits removal — not historical erasure |

## Derivation events

| Event                              | Meaning                        |
| ---------------------------------- | ------------------------------ |
| **CommunityCapacityUpdated**       | Derived capacity recalculated  |
| **ImplementationReadinessUpdated** | Derived readiness recalculated |

Events may be consumed by projections, audit logs and future navigator services.

They must not mutate external aggregates.

---

# Invariants

The state machine enforces the following invariants at all times.

## Participation integrity

**SM-001 — One active commitment per participant per initiative**

A participant may have at most one active Contribution Item declaration per Implementation Commitment context in Version 1 unless Frozen Policy defines supersession.

**SM-002 — Contribution history preserved**

Withdrawal changes status.

History is never silently deleted after accountable declaration.

## Policy integrity

**SM-003 — Frozen Policy immutable**

Frozen Policy referenced during Active, Completed, Withdrawn and Archived evaluation cannot be modified in place.

Policy change requires governed reference update.

## Derivation integrity

**SM-004 — Community Capacity derived only**

Community Capacity is computed from declarations.

Never manually edited.

**SM-005 — Implementation Readiness derived only**

Implementation Readiness is computed from Community Capacity and Frozen Policy.

Never manually edited.

Never treated as Collective Decision approval.

## Boundary integrity

**SM-006 — No external aggregate mutation**

No command or transition may modify Petition, Collective Decision, Initiative or Collaborative Analysis state.

**SM-007 — Commitment is not execution**

No state or command assigns implementation work, tasks or schedules.

## Historical integrity

**SM-008 — Archived is terminal**

Archived aggregates are read-only except where explicit future revival policy is approved through Architecture Review.

**SM-009 — Readiness is not approval**

Completed state reflects preparedness collection and policy satisfaction — not re-authorization of the collective decision.

---

# Relationship to Contribution Item Status

Aggregate lifecycle states govern the **Implementation Commitment** collection phase.

Individual **Contribution Items** carry their own **Commitment Status** (for example Declared, Withdrawn, Satisfied).

Item status changes occur within aggregate states — primarily **Active**.

Item withdrawal does not automatically move the aggregate to **Withdrawn** unless aggregate-level withdrawal is commanded.

---

# Final Principle

Implementation Commitment records **voluntary capacity**.

It never assigns work.

The state machine exists to make that boundary explicit:

- declarations are human and accountable;
- capacity and readiness are derived truth;
- withdrawal preserves history;
- completion prepares for Implementation — it does not execute it.

Changes to this state machine require Architecture Review.
