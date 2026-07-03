# IMPLEMENTATION_GUIDE_02_BEHAVIOR

## Capability 02 — Participation

### Epic 04 — Petition

Version: 1.0

Status: Ready

---

# Purpose

Define the runtime behavior of the Petition Aggregate.

This guide explains how Petition behaves during its lifecycle.

It references:

- DOMAIN_MODEL.md
- STATE_MACHINE.md
- DOMAIN_DECISIONS.md

It does not redefine architecture.

---

# Behavioral Scope

This guide covers:

- lifecycle behavior;
- commands;
- domain events;
- validation flow;
- business rules;
- derived values;
- error scenarios;
- idempotency expectations.

This guide does not cover:

- persistence;
- API;
- UI;
- authentication implementation.

---

# Aggregate Behavior

Petition begins after an approved Collective Decision.

Petition transforms the approved decision into transparent public endorsement.

Petition does not modify:

- Initiative;
- Collaborative Analysis;
- Collective Decision.

---

# Commands

Supported commands:

```text
CreatePetition
PreparePetition
PublishPetition
OpenPetition
SignPetition
ClosePetition
ArchivePetition
```

---

# CreatePetition

Creates a Petition from an approved Collective Decision.

Requires:

- approved CollectiveDecisionId;
- Initiative reference;
- PetitionSubject;
- PetitionPolicy.

Result:

- Petition created in Draft state.

---

# PreparePetition

Marks the Petition as ready for publication.

Requires:

- PetitionSubject complete;
- PetitionPolicy defined;
- ShareLink available.

Result:

- Petition transitions to Ready.

---

# PublishPetition

Makes the Petition publicly visible.

Requires:

- Ready state.

Result:

- Petition transitions to Published.

Public Visitors may now view and share.

---

# OpenPetition

Allows registered Participants to sign.

Requires:

- Published state.

Result:

- Petition transitions to Open.

---

# SignPetition

Records one participant endorsement.

Requires:

- Petition is Open;
- participant is registered;
- participant has not already signed;
- participant satisfies PetitionPolicy.

Result:

- Signature recorded;
- SupportMetrics updated as derived state;
- Contribution Recognition message may be shown.

Signature is immutable after recording.

---

# ClosePetition

Stops new signatures.

Requires:

- Open state.

Result:

- Petition transitions to Closed.

---

# ArchivePetition

Preserves Petition as historical record.

Requires:

- Closed state.

Result:

- Petition transitions to Archived.

Archived Petition is read-only.

---

# Domain Events

Expected events:

```text
PetitionCreated
PetitionPrepared
PetitionPublished
PetitionOpened
PetitionSigned
SupportMetricsUpdated
PetitionClosed
PetitionArchived
```

Events preserve historical meaning.

Events do not replace Aggregate state.

---

# Validation Flow

Every command follows:

```text
Receive Command

↓

Validate State

↓

Validate Policy

↓

Validate Participant Eligibility

↓

Apply Behavior

↓

Record Event

↓

Update Derived Values
```

---

# Business Rules

## BR-001

Petition may only be created from an approved Collective Decision.

## BR-002

Public Visitors may view and share without registration.

## BR-003

Registration is required before signing.

## BR-004

One Participant may sign one Petition only once.

## BR-005

Signature is immutable.

## BR-006

SupportMetrics are derived.

## BR-007

Petition does not own Implementation Commitment.

## BR-008

Participant-facing messages recognize contribution, not personal worth.

---

# Derived Values

Derived values include:

- total signatures;
- participant signatures;
- public registrations;
- daily activity;
- support threshold status;
- PetitionOutcome.

Derived values are never manually edited.

---

# Idempotency Expectations

Repeated signing by the same participant must not create duplicate signatures.

Repeated publication commands must not corrupt state.

Repeated metric calculation must produce the same result from the same source data.

---

# Error Scenarios

Expected errors:

- Collective Decision not approved;
- invalid state transition;
- Petition not open;
- participant not registered;
- participant already signed;
- PetitionPolicy not satisfied;
- archived Petition cannot be modified.

Errors must be explicit and deterministic.

---

# Read Model Expectations

Read models may expose:

- Petition status;
- PetitionSubject;
- ShareLink;
- SupportMetrics;
- PetitionOutcome.

Read models must not expose private participant data.

---

# Behavior Checklist

Before implementation, confirm:

- lifecycle behavior matches STATE_MACHINE.md;
- commands are explicit;
- events are meaningful;
- Signature immutability is preserved;
- SupportMetrics are derived;
- Public Visitor and Participant behavior are separated;
- Petition does not own external Aggregates;
- Contribution Recognition language is respected.

---

# Final Principle

Petition behavior must preserve public transparency, participant accountability and Aggregate independence.
