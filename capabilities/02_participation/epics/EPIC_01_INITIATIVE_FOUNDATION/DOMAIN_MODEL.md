# DOMAIN_MODEL

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

Humanity Union Platform

Domain Model

Version 1.0

---

# Purpose

This document defines the conceptual domain model of Initiative.

The model represents the stable business structure of the Participation capability.

No persistence, APIs, UI, or implementation details are described here.

---

# Aggregate Root

## Initiative

Initiative is the Aggregate Root of the Participation capability.

Every Proposal, Discussion, Poll, Petition, and Implementation belongs to exactly one Initiative.

Initiative identity never changes.

---

# Identity

Every Initiative possesses:

- InitiativeId
- StewardId
- CreatedAt
- UpdatedAt

Identity remains constant throughout the Initiative lifecycle.

---

# Child Entities

## InitiativeRevision

Represents one historical revision of the Initiative.

Contains:

- RevisionId
- AuthorId
- RevisionNumber
- Summary
- CreatedAt

Historical revisions are immutable.

---

## InitiativeContribution

Represents one constructive contribution.

Examples:

- created
- revised
- discussed
- reviewed
- voted
- implemented
- revived

Contains:

- ContributionId
- MemberId
- ContributionType
- Timestamp

Contribution history is permanent.

---

## TimelineEvent

Represents one event in Initiative history.

Examples:

- Initiative created
- Revision published
- Poll opened
- Petition submitted
- Implementation started
- Archived
- Revived

Contains:

- EventId
- EventType
- Timestamp
- Metadata

Timeline never loses history.

---

# Value Objects

## InitiativeTitle

Official title.

---

## InitiativeDescription

Current description.

---

## InitiativeStatus

Current lifecycle stage.

---

## InitiativeVisibility

Visibility policy.

---

## InitiativeMetadata

Supporting metadata:

- category
- tags
- region
- language

---

# Relationships

Initiative owns:

- Revisions
- Contributions
- Timeline

Timeline references:

- Revisions
- Polls
- Petitions
- Implementation milestones

---

# Aggregate Rules

Initiative guarantees:

- lifecycle consistency
- identity continuity
- historical preservation
- stewardship
- contribution integrity

---

# Lifecycle

Current lifecycle:

Draft

↓

Proposal

↓

Discussion

↓

Revision

↓

Ready for Poll

↓

Poll

↓

Petition

↓

Implementation

↓

Completed

Future lifecycle extensions:

- Archived
- Revived
- Superseded
- Merged

must preserve Initiative identity.

---

# Domain Boundaries

Initiative owns:

- lifecycle
- revisions
- contributions
- timeline
- stewardship

Initiative references:

- Member
- Organization
- Community

Initiative never owns those domains.

---

# Bootstrap Scope

Bootstrap implementation includes:

- Initiative
- InitiativeRevision
- TimelineEvent

Contribution analytics, branching, merging, and advanced governance are future extensions.

---

# Engineering Principles

This model follows:

- Domain First
- Domain Ownership
- Domain Gravity
- Ubiquitous Language
- Initiative Continuity
- Initiative Stewardship
- Living Initiatives
- Progressive Bootstrap

---

# Final Principle

An Initiative is remembered not because it existed.

An Initiative is remembered because society continued to improve it.
