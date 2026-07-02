# IMPLEMENTATION_GUIDE_02_COLLECTIVE_DECISION_STORE

## Capability 02 — Participation

### Epic 03 — Community Poll

Guide 02 of 7

Version 2.0

Status: Ready

---

# Purpose

Implement the in-memory CollectiveDecision Store.

The Store manages the lifecycle of CollectiveDecision aggregates while remaining independent from any specific Decision Template.

Version 1 supports the Community Poll template.

---

# Scope

This guide includes:

- bootstrap data;
- in-memory store;
- CRUD operations;
- lifecycle transitions;
- participant decision submission;
- derived result calculation;
- archive support.

This guide does not include:

- REST API;
- Workspace;
- Public Projection;
- authentication;
- persistence.

---

# Files to Create

```
apps/api/src/modules/collective-decision/
```

Create:

```
collective-decision.store.ts

bootstrap-collective-decision.ts

collective-decision.helpers.ts

index.ts
```

---

# Bootstrap

Create one bootstrap decision.

Decision Subject

```
Initiative
```

Decision Mechanism

```
CommunityPoll
```

Question

```
Should this Initiative proceed to the Petition stage?
```

Decision Options

```
Approve

Reject
```

Status

```
Draft
```

---

# Store Responsibilities

The Store owns:

- bootstrap initialization;
- create;
- read;
- update lifecycle;
- archive;
- participant decision registration;
- derived DecisionResult generation.

The Store does not own business policy beyond aggregate invariants.

---

# CRUD

Implement:

```
createDecision()

getDecision()

listDecisions()

updateDecision()

archiveDecision()
```

Return cloned objects.

Never expose mutable references.

---

# Lifecycle Operations

Implement:

```
scheduleDecision()

openDecision()

closeDecision()

completeDecision()

cancelDecision()
```

Validate transitions according to STATE_MACHINE.md.

Invalid transitions must fail.

---

# Participant Decisions

Implement:

```
submitParticipantDecision()
```

Rules:

- participant must be eligible;
- only one active ParticipantDecision per participant;
- Decision must be Active.

Submitted decisions become immutable.

---

# DecisionResult

Implement:

```
calculateDecisionResult()
```

Result is derived from:

- ParticipantDecision collection;
- DecisionRules.

No manual editing.

---

# Outcome

Implement:

```
determineOutcome()
```

Outcome is derived from:

- DecisionResult.

Never entered manually.

---

# Helper Functions

Implement helpers for:

- validation;
- transition checks;
- statistics calculation;
- cloning.

Helpers contain no persistence logic.

---

# Version 1 Scope

Support:

Decision Subject

```
Initiative
```

Decision Template

```
CommunityPoll
```

Decision Options

```
Approve

Reject
```

One Ballot.

Simple majority.

One ParticipantDecision per participant.

---

# Bootstrap IDs

Suggested identifiers:

```
decision-bootstrap-001

ballot-bootstrap-001
```

Use deterministic IDs.

---

# Engineering Principles

Preserve:

- Domain First;
- Historical Integrity;
- Derived State;
- Human Leadership;
- Mechanism Independence;
- Progressive Bootstrap.

---

# Verification

Confirm:

- bootstrap loads;
- CRUD works;
- lifecycle validation works;
- participant decisions are immutable;
- DecisionResult is derived;
- Outcome is derived.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Completion Criteria

Guide 02 is complete when:

- Store compiles;
- bootstrap loads;
- lifecycle operations work;
- participant decisions can be submitted;
- DecisionResult is derived;
- Outcome is derived;
- typecheck passes.

Guide 03 must not be started.
