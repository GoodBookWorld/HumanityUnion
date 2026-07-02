# IMPLEMENTATION_GUIDE_01_COLLECTIVE_DECISION_DOMAIN

## Capability 02 — Participation

### Epic 03 — Community Poll

Guide 01 of 7

Version 2.0

Status: Ready

---

# Purpose

Implement the CollectiveDecision domain.

This guide creates the domain foundation of the Collective Decision Framework.

Community Poll is implemented as Version 1 through configuration rather than domain specialization.

---

# Scope

This guide includes:

- domain types;
- aggregate definition;
- entities;
- value objects;
- exports.

This guide does not include:

- Store;
- API;
- Workspace;
- Public Projection;
- Platform Integration.

---

# Files to Create

## Types

```
packages/types/src/domain/collective-decision/
```

Create:

```
collective-decision.ts

ballot.ts

decision-option.ts

participant-decision.ts

decision-result.ts

outcome.ts

decision-rules.ts

eligibility-rules.ts

decision-statistics.ts

decision-timeline.ts

index.ts
```

---

# Exports

Update:

```
packages/types/src/domain/index.ts
```

Export every new type.

---

# Aggregate Root

Implement:

```
CollectiveDecision
```

Responsibilities:

- lifecycle;
- ballot;
- participant decisions;
- decision result;
- outcome;
- references to Decision Subject.

The Aggregate never owns the Decision Subject.

---

# Child Entities

Implement:

- Ballot
- DecisionOption
- ParticipantDecision
- DecisionResult
- Outcome

Entities remain immutable where appropriate.

---

# Value Objects

Implement:

- DecisionRules
- EligibilityRules
- DecisionStatistics
- DecisionTimeline

Value Objects contain no identity.

---

# Version 1 Configuration

Version 1 supports:

Decision Subject

```
Initiative
```

Decision Mechanism

```
CommunityPoll
```

Decision Options

```
Approve

Reject
```

One Ballot.

One ParticipantDecision per participant.

---

# Domain Constraints

Implement support for:

- one Decision Subject;
- one Decision Mechanism;
- one Ballot;
- one active ParticipantDecision per participant;
- derived DecisionResult;
- derived Outcome.

No business logic beyond aggregate invariants.

---

# Naming Rules

Use:

- CollectiveDecision
- Ballot
- ParticipantDecision
- DecisionResult
- Outcome
- DecisionRules
- EligibilityRules

Do not introduce:

- Vote
- Voting
- PollResult

Community Poll remains a template.

CollectiveDecision remains the domain.

---

# Engineering Principles

Preserve:

- Domain First
- Human Leadership
- Mechanism Independence
- Historical Integrity
- Explicit Publicity
- Progressive Bootstrap

---

# Verification

Confirm:

- all types compile;
- exports resolve;
- Aggregate structure matches DOMAIN_MODEL;
- no implementation logic beyond domain definitions.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Completion Criteria

Guide 01 is complete when:

- CollectiveDecision Aggregate exists;
- entities compile;
- value objects compile;
- exports succeed;
- typecheck passes.

Guide 02 must not be started.
