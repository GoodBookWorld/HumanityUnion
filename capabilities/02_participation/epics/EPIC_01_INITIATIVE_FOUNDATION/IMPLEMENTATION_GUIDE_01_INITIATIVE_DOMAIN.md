# IMPLEMENTATION_GUIDE_01

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

## Guide 01 — Initiative Domain

Humanity Union Platform

Version 1.0

---

# Purpose

Implement the Initiative domain as defined by the approved architecture.

This guide establishes the shared domain types only.

No runtime behavior is introduced.

---

# Architecture Reference

This guide implements:

- DOMAIN_MODEL.md
- DOMAIN_DECISIONS.md
- STATE_MACHINE.md

The implementation must conform to the approved Architecture Freeze.

---

# Scope

Implement:

## Aggregate Root

- Initiative

## Child Entities

- InitiativeRevision
- InitiativeContribution
- TimelineEvent

## Value Objects

- InitiativeTitle
- InitiativeDescription
- InitiativeStatus
- InitiativeVisibility
- InitiativeMetadata

---

# Deliverables

Create:

packages/types/src/domain/initiative.ts

Update:

packages/types/src/domain/index.ts

---

# Aggregate Root

Implement interface:

Initiative

Fields:

- initiativeId
- stewardId
- createdAt
- updatedAt

- title
- description
- status
- visibility
- metadata

- revisions
- contributions
- timeline

---

# Child Entities

Implement:

## InitiativeRevision

Fields:

- revisionId
- authorId
- revisionNumber
- summary
- createdAt

---

Implement:

## InitiativeContribution

Fields:

- contributionId
- memberId
- contributionType
- timestamp

---

Implement:

## TimelineEvent

Fields:

- eventId
- eventType
- timestamp
- metadata

---

# Value Objects

Implement interfaces for:

- InitiativeTitle
- InitiativeDescription
- InitiativeStatus
- InitiativeVisibility
- InitiativeMetadata

Value Objects contain data only.

No methods.

---

# Constraints

Do NOT implement:

- Store
- Repository
- MongoDB
- API
- Validation
- Authorization
- Workspace
- Projection
- Business Rules
- Services

Domain types only.

---

# Verification

Verify:

- pnpm typecheck
- successful export from @hu/types

---

# Success Criteria

Guide 01 is complete when:

- all domain interfaces compile;
- exports compile;
- no runtime behavior exists;
- implementation matches the approved Domain Model.

---

# Out of Scope

Deferred to future guides:

Guide 02 — Initiative Store

Guide 03 — Initiative API

Guide 04 — Initiative Workspace

Guide 05 — Public Initiative Projection

Guide 06 — Bootstrap Integration

Guide 07 — Architecture Review

---

# Final Principle

The Domain defines the language.

Every implementation must faithfully preserve that language.
