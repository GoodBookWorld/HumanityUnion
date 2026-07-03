# STATE MACHINE

## Capability 02 — Participation

### Epic 04 — Petition

Version: 1.0

Status: Draft

---

# Purpose

Define the lifecycle of the Petition Aggregate.

The state machine specifies:

- valid states;
- allowed transitions;
- transition rules;
- entry and exit conditions;
- aggregate invariants;
- invalid transitions.

Petition Outcome is not a state.

Support Metrics are not states.

Only lifecycle stages belong to the state machine.

---

# Lifecycle

```
Draft

↓

Ready

↓

Published

↓

Open

↓

Closed

↓

Archived
```

---

# States

## Draft

### Why This State Exists

Draft is the preparation stage.

Before a Petition becomes publicly visible, its subject reference, presentation context and Petition Policy must be defined and reviewed.

Draft protects public transparency from premature or incomplete publication.

### Meaning

The Petition is being prepared.

It is not publicly visible.

Endorsement has not begun.

### Allowed

- associate an approved Collective Decision;
- define Petition Subject presentation;
- configure Petition Policy;
- prepare public presentation context;
- transition to Ready when preparation is complete.

### Not Allowed

- public Share Link activation;
- Signature recording;
- public endorsement statistics publication.

---

## Ready

### Why This State Exists

Ready confirms that the Petition is internally complete and eligible for publication.

It separates preparation from public release.

Ready prevents partially configured Petitions from becoming publicly accessible.

### Meaning

The Petition is validated and approved for publication.

All required references and policies are in place.

Publication has not yet occurred.

### Allowed

- final review of Petition Policy;
- confirm subject reference and decision context;
- transition to Published.

### Not Allowed

- Signature recording;
- public observation through the permanent Share Link;
- modification of core subject reference after transition to Published.

---

## Published

### Why This State Exists

Published introduces public visibility before active endorsement.

Society may observe, understand and share the Petition before signing begins.

This supports transparency and informed participation.

### Meaning

The Petition is publicly visible.

The Share Link is active.

Public Visitors may read and share.

Registration Gateway is available.

Signing has not yet opened unless policy permits immediate opening.

### Allowed

- public observation;
- sharing through Share Link;
- registration before signing;
- transition to Open when the endorsement period begins.

### Not Allowed

- Signature recording unless Petition Policy explicitly permits signing while Published;
- modification of immutable publication context;
- alteration of recorded Signatures.

Version 1 assumes signing begins only after transition to Open.

---

## Open

### Why This State Exists

Open is the active Public Endorsement period.

Both Community Participation and Public Participation occur within this state.

One lifecycle governs all Signature recording.

### Meaning

The Petition accepts Signatures.

Community Participants and Public Participants who complete registration may endorse the Petition.

Support Metrics are derived during this period.

### Allowed

- record Signatures;
- derive Support Metrics;
- Contribution Recognition after signing;
- recommend Next Meaningful Action;
- transition to Closed when the endorsement period ends or policy conditions are met.

### Not Allowed

- modify Petition Policy structure;
- modify immutable Petition Subject;
- remove or edit recorded Signatures;
- reopen decision questions from Collective Decision.

---

## Closed

### Why This State Exists

Closed ends active endorsement.

Public support is no longer accepted.

The platform can finalize derived outcomes and preserve the historical record.

### Meaning

Signature recording has ended.

Support Metrics reflect the final endorsement period.

Petition Outcome is derived.

### Allowed

- derive final Support Metrics;
- determine Petition Outcome;
- preserve immutable participation history;
- transition to Archived.

### Not Allowed

- new Signatures;
- modification of existing Signatures;
- public presentation implying active endorsement.

---

## Archived

### Why This State Exists

Archived preserves the Petition as permanent civic history.

Long-term institutional memory requires read-only historical records.

### Meaning

The Petition is historical.

It remains publicly understandable.

No lifecycle progression continues within the Petition Aggregate.

### Allowed

- read-only public access;
- read-only operational access;
- historical reference for future stages.

### Not Allowed

- Signature recording;
- policy modification;
- lifecycle reactivation without explicit future revival policy.

---

# One Lifecycle for Two Participation Modes

Community Participation and Public Participation do not create separate state machines.

Both modes express support through Signature recording during Open.

The difference is entry path:

Community Participation

A registered Participant reaches the Petition through platform navigation and signs during Open.

Public Participation

A Public Visitor observes during Published or Open, passes through Registration Gateway, becomes a Participant, and signs during Open.

Published enables observation and sharing for both audiences.

Open enables endorsement for both audiences.

Closed and Archived apply equally to all Signatures regardless of entry mode.

One Aggregate.

One lifecycle.

One historical record.

---

# Transition Rules

## Allowed Transitions

```
Draft → Ready

Ready → Published

Published → Open

Open → Closed

Closed → Archived
```

## Transition Conditions

### Draft → Ready

Entry requirements satisfied:

- referenced Collective Decision Outcome is Approved;
- Petition Subject is defined;
- Petition Policy is complete;
- preparation review is complete.

Exit from Draft:

- internal preparation is finished;
- publication prerequisites are satisfied.

### Ready → Published

Entry to Published:

- Petition Policy is fixed for publication;
- public presentation context is approved;
- Share Link may be activated.

Exit from Ready:

- the Petition is authorized for public visibility.

### Published → Open

Entry to Open:

- endorsement period start conditions are satisfied;
- Petition Policy permits signing;
- public context remains available.

Exit from Published:

- observation-only phase ends;
- active Public Endorsement begins.

### Open → Closed

Entry to Closed:

- endorsement period end conditions are met;
- policy threshold may be evaluated;
- no further Signatures are accepted.

Exit from Open:

- active endorsement ends;
- final support record is preserved.

### Closed → Archived

Entry to Archived:

- Petition Outcome is derived;
- final Support Metrics are stable;
- historical preservation is required.

Exit from Closed:

- the Petition leaves active civic use;
- permanent record retention begins.

---

# Invalid Transitions

The following transitions are not allowed:

```
Draft → Published

Draft → Open

Draft → Closed

Draft → Archived

Ready → Open

Ready → Closed

Ready → Archived

Published → Closed

Published → Archived

Open → Draft

Open → Ready

Open → Published

Closed → Open

Closed → Published

Closed → Ready

Closed → Draft

Archived → Draft

Archived → Ready

Archived → Published

Archived → Open

Archived → Closed
```

Invalid transitions preserve:

- preparation before publication;
- visibility before or during endorsement discipline;
- immutable historical records;
- clear separation between observation and signing where required by policy.

---

# Entry Conditions

A Petition may enter Draft only when:

- a Collective Decision Outcome exists;
- the Outcome is Approved;
- the referenced subject is eligible for Public Endorsement.

A Petition may not exist for a rejected decision.

A Petition may not bypass Draft by entering directly into public endorsement.

---

# Exit Conditions

A Petition exits active civic participation when it reaches Closed.

A Petition exits the Petition Aggregate lifecycle when it reaches Archived.

Reaching Closed does not create Implementation Commitment.

Eligibility for a future Implementation Commitment stage is a pipeline consequence, not a Petition state transition.

Petition ends at endorsement finalization.

Implementation Commitment begins in a separate future domain stage.

---

# Aggregate Invariants

The following invariants must always hold.

---

## PI-001

One approved Collective Decision reference per Petition.

---

## PI-002

One Petition lifecycle per approved decision subject path in Version 1.

---

## PI-003

One Signature per Participant per Petition.

---

## PI-004

Signatures may be recorded only during Open unless an explicit future policy introduces a controlled exception.

---

## PI-005

Recorded Signatures are immutable.

---

## PI-006

Petition Policy structure is immutable after Published.

---

## PI-007

Petition Subject presentation is immutable after Published.

---

## PI-008

Support Metrics are always derived.

Never manually entered.

---

## PI-009

Petition Outcome is always derived.

Never manually entered as a lifecycle substitute.

---

## PI-010

Archived Petitions are immutable.

---

## PI-011

Petition never modifies Initiative, Collaborative Analysis or Collective Decision state.

---

## PI-012

Community Participation and Public Participation share the same Signature rules and lifecycle states.

---

# Derived Concepts Outside the State Machine

The following concepts belong to the domain but are not lifecycle states:

- Support Count
- Support Metrics
- Petition Outcome
- Contribution Recognition
- Next Meaningful Action recommendation

They are derived from lifecycle activity, especially during Open and Closed.

---

# Relationship to Collective Decision

Petition lifecycle begins only after Collective Decision produces an Approved Outcome.

Collective Decision lifecycle and Petition lifecycle remain independent.

Approval creates eligibility.

Petition creation and progression remain Petition responsibilities.

---

# Relationship to Implementation Commitment

Closed and Archived describe endorsement completion.

Implementation Commitment belongs to a later Participation stage.

Petition lifecycle intentionally ends before implementation readiness is expressed.

---

# Engineering Principles

This lifecycle preserves:

- Historical Integrity
- Derived State
- Human Leadership
- Explicit Publicity
- Domain Ownership
- Aggregate Independence
- Understanding Before Action

---

# Final Principle

The Petition lifecycle governs public endorsement.

Published enables transparency.

Open enables support.

Closed preserves results.

Archived preserves history.

Community and Public Participation share this lifecycle because they share one civic meaning: transparent support for an approved collective decision.
