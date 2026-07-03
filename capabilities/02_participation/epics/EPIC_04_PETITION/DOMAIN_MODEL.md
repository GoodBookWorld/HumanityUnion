# DOMAIN MODEL

## Capability 02 — Participation

### Epic 04 — Petition

Version: 1.0

Status: Active

---

# Purpose

This document defines the domain model for the Petition Aggregate.

Petition represents the Public Endorsement stage of the Humanity Union Participation Pipeline.

Its responsibility is to transform an approved Collective Decision into transparent public support while preserving accountability, participation history and future implementation opportunities.

Petition does not replace Collective Decision.

It extends the decision into society.

---

# Aggregate

## Petition

The Petition Aggregate represents one approved Collective Decision presented for public endorsement.

A Petition owns:

- its lifecycle;
- participation records;
- public presentation;
- endorsement statistics;
- petition policies.

A Petition never modifies the originating Collective Decision.

---

# Aggregate Relationship

```
Initiative

↓

Collaborative Analysis

↓

Collective Decision

↓

Petition

↓

Implementation Commitment
```

Petition references one approved Collective Decision.

---

# Aggregate Root

## Petition

Responsibilities:

- maintain Petition lifecycle;
- expose public endorsement;
- manage participation rules;
- publish support statistics;
- preserve transparency.

---

# Entities

## Signature

Represents one participant's endorsement.

Identity:

SignatureId

Properties:

- ParticipantId
- PetitionId
- SignedAt
- Visibility
- Status

A Signature belongs to exactly one Petition.

A Participant may sign a Petition only once.

---

## PetitionSubject

Represents the approved Collective Decision presented by the Petition.

Properties:

- DecisionId
- InitiativeId
- Title
- Summary

PetitionSubject is immutable after publication.

---

# Value Objects

## PetitionPolicy

Defines participation rules.

Includes:

- eligibility;
- visibility;
- signature policy;
- withdrawal policy;
- publication rules.

---

## ShareLink

Represents the permanent public URL.

Properties:

- URL
- CreatedAt

ShareLink never changes.

---

## SupportMetrics

Derived statistics.

Includes:

- total signatures;
- participant signatures;
- public registrations;
- daily activity;
- sharing statistics.

Derived only.

Never manually edited.

---

## PetitionOutcome

Represents the current public endorsement state.

Examples:

- Active
- ThresholdReached
- Closed
- Archived

Outcome is derived.

---

## RegistrationGateway

Represents the transition from Public Visitor to Participant.

The Gateway manages:

- authentication;
- registration;
- redirect to Participant Workspace;
- continuation of the signing process.

The Gateway is part of the participation experience rather than identity management.

---

## ContributionRecognition

Represents participant-facing acknowledgement messages.

Purpose:

Recognize meaningful participation without evaluating the participant.

Examples:

- Signature recorded
- Participation confirmed
- Public support updated

Recognition is informational.

Recognition never evaluates personal worth.

---

# External References

Petition references:

CollectiveDecisionId

InitiativeId

No ownership is transferred.

Petition never modifies external Aggregates.

---

# Invariants

A Petition:

- references one approved Collective Decision;
- owns one lifecycle;
- owns its Signatures;
- owns one PetitionPolicy;
- owns one public ShareLink;
- derives its statistics;
- preserves immutable participation history.

---

# Derived Data

The following values are derived:

- Support Count
- Participation Rate
- Daily Activity
- Signature Statistics
- Petition Outcome

Derived data must never become the source of truth.

---

# Aggregate Boundaries

Petition owns:

✔ Signatures

✔ Policies

✔ Public Presentation

✔ Support Metrics

✔ Participation History

Petition references:

✔ Initiative

✔ Collaborative Analysis

✔ Collective Decision

Petition never owns external Aggregates.

---

# Future Extension

The Aggregate is intentionally designed to support future participation mechanisms.

Examples:

- Organizational Endorsements
- Institutional Support
- Regional Petition Campaigns
- Verified Expert Endorsements

These extensions should reuse the Petition Aggregate rather than introduce a parallel participation model.

---

# Relationship to Implementation Commitment

Petition answers:

"Does society support this decision?"

Implementation Commitment answers:

"Who is prepared to participate in implementation?"

These Aggregates represent different stages of the Participation Pipeline.

---

# Collective Participation Journey

Petition forms one stage of the Humanity Union Collective Participation Journey.

```
Initiative

↓

Analysis

↓

Decision

↓

Petition

↓

Implementation Commitment

↓

Implementation

↓

Impact
```

Participant interfaces should communicate both:

- the current stage;
- possible next stages.

The platform should continuously help participants understand where they are within the overall civic participation process.

---

# Final Principle

Petition transforms approved collective decisions into transparent public participation.

It preserves accountability, strengthens civic legitimacy and creates the bridge between collective agreement and future implementation.
