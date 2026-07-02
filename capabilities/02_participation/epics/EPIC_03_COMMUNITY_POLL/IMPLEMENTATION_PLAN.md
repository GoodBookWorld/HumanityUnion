# IMPLEMENTATION_PLAN

## Capability 02 — Participation

### Epic 03 — Community Poll

## Collective Decision Framework Implementation Plan

Version 2.0

Status: Approved

---

# Purpose

Define the implementation strategy for the Collective Decision Framework.

Community Poll is implemented as Version 1 of the framework.

The implementation follows the standard Humanity Union Epic Delivery Lifecycle.

---

# Architectural Position

The Collective Decision Framework is organized into three independent architectural layers.

```
Collective Decision
        │
        ▼
Decision Engine
        │
        ▼
Decision Templates
```

## Collective Decision

The domain defines:

- decision lifecycle;
- participant decisions;
- ballots;
- decision rules;
- outcomes;
- aggregate invariants.

The domain remains independent from any specific decision mechanism.

---

## Decision Engine

The Decision Engine implements the execution model of the Collective Decision Framework.

It provides reusable platform capabilities including:

- lifecycle management;
- participant registration;
- decision validation;
- result calculation;
- public projections;
- auditing;
- historical integrity.

The engine is generic and reusable.

It contains no mechanism-specific business logic.

---

## Decision Templates

Decision Templates configure the behavior of the Decision Engine for specific participation scenarios.

Version 1 implements:

- Community Poll

Future templates may include:

- Candidate Selection
- Priority Decision
- Trust Evaluation
- Budget Allocation
- Constitutional Decision
- Organizational Governance
- Institutional Election

Templates define behavior without modifying the CollectiveDecision Aggregate.

---

# Platform Rule

The Collective Decision Aggregate is implemented once.

The Decision Engine is implemented once.

Future participation mechanisms should be introduced as Decision Templates whenever possible.

New Aggregates should only be introduced when the business domain fundamentally differs from Collective Decision.

---

# Engineering Principle

Build one Decision Engine.

Extend it through templates.

Do not duplicate collective decision logic.

---

# Implementation Philosophy

Implementation proceeds from the domain outward.

Each layer depends only on the previous layer.

```
Architecture

↓

Domain

↓

Store

↓

API

↓

Workspace

↓

Public Projection

↓

Platform Integration

↓

Architecture Review
```

---

# Phase 1

## Domain

Purpose

Implement the CollectiveDecision Aggregate.

Includes

- Aggregate
- Entities
- Value Objects
- Types
- Domain exports

Deliverables

- CollectiveDecision
- Ballot
- DecisionOption
- ParticipantDecision
- DecisionResult
- Outcome
- DecisionRules
- EligibilityRules
- DecisionStatistics
- DecisionTimeline

---

# Phase 2

## Store

Purpose

Implement the in-memory CollectiveDecision Store.

Responsibilities

- bootstrap data
- CRUD
- lifecycle transitions
- participant decision storage
- result calculation
- archive support

Store remains framework-independent.

---

# Phase 3

## API

Purpose

Expose CollectiveDecision through REST.

Endpoints

GET

POST

PATCH

Public Projection endpoint

All endpoints follow the Humanity Union API standard.

---

# Phase 4

## Workspace

Purpose

Provide the operational workspace for CollectiveDecision.

Workspace includes

- Decision Overview
- Ballot
- Decision Options
- Participation
- Results
- Outcome
- Timeline
- Actions

Version 1 is read-first.

---

# Phase 5

## Public Projection

Purpose

Provide a public representation.

Displays

- decision status
- participation statistics
- decision result
- outcome

Internal calculations remain hidden.

---

# Phase 6

## Platform Integration

Verify

Initiative

↓

Collaborative Analysis

↓

Collective Decision

↓

Petition

Navigation

Routing

API integration

Aggregate independence

Platform principles

---

# Phase 7

## Epic Architecture Review

Perform the complete engineering review.

Verify

- Domain
- Store
- API
- Workspace
- Public Projection
- Platform Integration
- Documentation
- Repository

Epic closes only after successful review.

---

# Bootstrap Scope

Version 1 implements

Decision Subject

- Initiative

Decision Mechanism

- Community Poll

Decision Options

- Approve
- Reject

One Ballot

One ParticipantDecision

Transparent DecisionResult

Derived Outcome

No advanced governance.

---

# Deferred

Future releases may introduce

- Candidate Selection
- Trust Evaluation
- Ranked Decisions
- Multiple Ballots
- Priority Decisions
- Governance Decisions
- Constitutional Decisions
- Organizational Elections
- Delegated Voting
- Weighted Voting

These features extend the framework without redesigning the Aggregate.

---

# Standard Guide Sequence

Guide 01

Domain

↓

Guide 02

Store

↓

Guide 03

API

↓

Guide 04

Workspace

↓

Guide 05

Public Projection

↓

Guide 06

Platform Integration

↓

Guide 07

Epic Architecture Review

---

# Success Criteria

Implementation is successful when

- CollectiveDecision Aggregate is complete;
- Community Poll functions as Version 1;
- all architecture documents are implemented;
- engineering principles remain intact;
- implementation passes review.

---

# Engineering Principles

Implementation preserves

- Domain First
- Human Leadership
- Mechanism Independence
- Explicit Publicity
- Progressive Bootstrap
- Historical Integrity
- Derived State
- Independent Aggregates
- Thin API

---

# Final Principle

The Collective Decision Framework is implemented once.

Future decision mechanisms extend the framework rather than replacing it.

Community Poll is Version 1 of a reusable Decision Engine.
