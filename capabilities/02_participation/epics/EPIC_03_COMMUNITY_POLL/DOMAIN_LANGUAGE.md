# DOMAIN_LANGUAGE

## Capability 02 — Participation

### Epic 03 — Community Poll

## Collective Decision Domain Language

Version 2.0

Status: Approved

---

# Purpose

This document defines the ubiquitous language of the Collective Decision domain.

Every implementation, document, API, aggregate and user interface must use these terms consistently.

The purpose is to establish a shared vocabulary for all present and future collective decision mechanisms within Humanity Union.

---

# Core Philosophy

Collaborative Analysis creates shared understanding.

Collective Decision enables the community to transform that understanding into an official decision.

Community Poll is the first implementation of the Collective Decision Framework.

---

# Core Concepts

---

## Decision Subject

The object upon which a collective decision is made.

Version 1 supports:

- Initiative

Future versions may support:

- Candidate
- Policy
- Project
- Organization
- Institution
- Proposal
- Program

The Decision Subject is never owned by the Collective Decision aggregate.

---

## Collective Decision

The Aggregate responsible for coordinating a structured community decision.

Responsibilities include:

- decision lifecycle
- participant eligibility
- ballots
- participant decisions
- decision result
- outcome

Collective Decision never owns the Decision Subject.

---

## Community Poll

The first implementation of the Collective Decision Framework.

Community Poll enables the community to decide whether an Initiative should proceed to the next lifecycle stage.

Future implementations may introduce additional decision mechanisms without changing the architecture.

---

## Ballot

The structured definition of a decision.

A Ballot specifies:

- question
- available options
- participation rules
- decision rules
- timeline

A Ballot never stores the final outcome.

---

## Participant

A verified member eligible to participate in a Collective Decision.

A Participant may:

- review information
- submit one decision
- review public results

Participation rules are defined by Eligibility.

---

## Participant Decision

The official decision submitted by a Participant.

Version 1:

- Approve
- Reject

Future mechanisms may support:

- candidate selection
- option selection
- ranking
- priority ordering
- trust evaluation

The architecture remains unchanged.

---

## Eligibility

The rules determining whether a Participant may participate.

Examples:

- membership status
- regional requirements
- verification level
- organizational membership

Eligibility never determines how a Participant decides.

---

## Decision Option

A valid selectable option defined by the Ballot.

Version 1:

- Approve
- Reject

Future implementations may define multiple options.

---

## Decision Lifecycle

The sequence of states through which a Collective Decision progresses.

Typical stages include:

- Draft
- Scheduled
- Active
- Closed
- Completed
- Archived

State transitions are defined separately.

---

## Decision Result

The calculated outcome of participant decisions.

Decision Result includes:

- totals
- percentages
- participation statistics
- winning option

The Decision Result is generated after the decision closes.

---

## Outcome

The official consequence produced by a Decision Result.

Examples:

- Approved
- Rejected
- Selected
- Ranked
- Prioritized

Outcome determines the next lifecycle stage.

---

## Participation Statistics

Aggregated participation information.

Examples:

- eligible participants
- participants who decided
- participation rate
- completion rate

Participation Statistics describe participation rather than opinion.

---

## Public Decision Projection

The publicly visible representation of a Collective Decision.

It communicates:

- current status
- participation statistics
- decision result
- outcome

It never exposes private participant information.

---

# Relationships

```
Decision Subject

↓

Collaborative Analysis

↓

Collective Decision

↓

Decision Result

↓

Outcome

↓

Next Lifecycle Stage
```

---

# Domain Principles

The Collective Decision domain follows:

- Human Leadership
- Informed Decision
- Decision Independence
- Explicit Publicity
- Historical Integrity
- Progressive Bootstrap
- Derived State
- Thin API

---

# Naming Rules

Use:

- Collective Decision
- Decision Subject
- Participant Decision
- Decision Result
- Decision Outcome
- Decision Lifecycle
- Decision Statistics

Avoid using implementation-specific terminology when referring to the domain itself.

Community Poll is a mechanism.

Collective Decision is the domain.

---

# Ubiquitous Language Rule

All documentation, APIs, source code and user interfaces must use the terminology defined in this document consistently.

Alternative terminology should not be introduced without architectural review.

---

# Final Principle

Collective Decision provides a reusable domain for transparent, human-centered community decision-making.

Community Poll is its first implementation, not its architectural boundary.
