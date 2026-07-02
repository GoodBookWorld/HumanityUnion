# STATE_MACHINE

## Capability 02 — Participation

### Epic 03 — Community Poll

## Collective Decision State Machine

Version 2.0

Status: Approved

---

# Purpose

Define the lifecycle of the CollectiveDecision Aggregate.

The state machine specifies:

- valid states;
- allowed transitions;
- transition rules;
- aggregate invariants.

Outcome is not a state.

DecisionResult is not a state.

Only lifecycle stages belong to the state machine.

---

# Lifecycle

```
Draft

↓

Scheduled

↓

Active

↓

Closed

↓

Completed

↓

Archived
```

Alternative path:

```
Draft

↓

Cancelled
```

or

```
Scheduled

↓

Cancelled
```

---

# States

## Draft

The decision is being prepared.

Allowed:

- edit Ballot
- edit Decision Options
- edit Decision Rules
- edit Eligibility
- schedule opening
- cancel

Participant Decisions are prohibited.

---

## Scheduled

The decision is approved for publication.

The opening date is known.

Allowed:

- adjust schedule
- cancel before opening

Participant Decisions are prohibited.

Ballot structure should remain stable.

---

## Active

The decision is open.

Allowed:

- submit ParticipantDecision

Not allowed:

- modify Ballot
- modify Decision Options
- modify Decision Rules
- modify Eligibility
- cancel decision

The decision structure is frozen.

---

## Closed

Decision submission has ended.

Allowed:

- calculate DecisionResult

Participant Decisions are prohibited.

---

## Completed

DecisionResult has been calculated.

Outcome has been determined.

The decision becomes historical.

No further participation is possible.

---

## Archived

Historical storage.

Read-only.

No modifications permitted.

---

## Cancelled

Decision terminated before opening.

No Participant Decisions exist.

Historical record preserved.

---

# Transition Rules

Allowed transitions

```
Draft → Scheduled

Draft → Cancelled

Scheduled → Active

Scheduled → Cancelled

Active → Closed

Closed → Completed

Completed → Archived
```

Forbidden transitions

```
Active → Draft

Closed → Active

Completed → Active

Archived → Active

Cancelled → Active

Archived → Draft
```

---

# Aggregate Invariants

The following invariants must always hold.

---

## AI-001

One Decision Subject.

---

## AI-002

One Decision Mechanism.

---

## AI-003

One active ParticipantDecision per participant per Ballot.

---

## AI-004

DecisionResult may only exist after Closed.

---

## AI-005

Outcome may only exist after DecisionResult.

---

## AI-006

Ballot structure is immutable after Active.

---

## AI-007

Decision Rules are immutable after Active.

---

## AI-008

Eligibility is immutable after Active.

---

## AI-009

Participant Decisions cannot be modified after submission unless an explicit revision policy exists.

---

## AI-010

DecisionResult is always derived.

Never manually entered.

---

## AI-011

Outcome is always derived from DecisionResult.

---

## AI-012

Archived decisions are immutable.

---

# Lifecycle Events

Typical lifecycle events include:

- DecisionCreated
- DecisionScheduled
- DecisionOpened
- ParticipantDecisionSubmitted
- DecisionClosed
- DecisionResultCalculated
- OutcomeDetermined
- DecisionArchived
- DecisionCancelled

Events are historical records.

---

# Relationship to Collaborative Analysis

A Collective Decision based on an Initiative should not transition to Active unless the Initiative has an associated Collaborative Analysis that satisfies the required Progress Policy.

Version 1 verifies readiness before opening the decision.

---

# Relationship to Petition

If the Outcome is Approved, the Initiative becomes eligible for the Petition stage.

CollectiveDecision does not create the Petition.

It only produces the Outcome.

---

# Engineering Principles

This lifecycle preserves:

- Historical Integrity
- Derived State
- Human Leadership
- Mechanism Independence
- Progressive Bootstrap
- Explicit Publicity
- Domain Ownership

---

# Final Principle

The CollectiveDecision lifecycle governs the decision process.

DecisionResult records what was produced.

Outcome determines what happens next.

These concepts remain intentionally independent.
