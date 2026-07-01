# IMPLEMENTATION_PLAN

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

Implementation Plan

Version 1.0

---

# Purpose

This document defines the implementation sequence for Epic 01.

Implementation follows the approved Architecture Freeze.

No guide may violate the approved architecture.

---

# Guide 01

## Initiative Domain

Deliver:

- shared domain types
- Aggregate Root
- Child Entities
- Value Objects

No persistence.

---

# Guide 02

## Initiative Store

Deliver:

- bootstrap data
- in-memory repository
- query functions
- update functions

No database.

---

# Guide 03

## Initiative API

Deliver:

- GET endpoints
- POST endpoints
- PATCH endpoints
- route registration

No authorization extensions beyond bootstrap.

---

# Guide 04

## Initiative Workspace

Deliver:

- Initiative workspace
- Initiative page
- bootstrap navigation

Read-first implementation.

---

# Guide 05

## Initiative Public Projection

Deliver:

- public Initiative projection
- projection builder
- public API
- public page

No private fields.

---

# Guide 06

## Bootstrap Integration

Deliver:

- complete bootstrap flow
- API integration
- workspace integration
- projection integration

---

# Guide 07

## Epic Architecture Review

Verify:

- architecture
- API
- workspace
- projection
- documentation
- repository cleanliness

---

# Success Criteria

Epic 01 is complete when:

- all Guides pass;
- Architecture Review passes;
- documentation is synchronized;
- repository is clean.

---

# Final Principle

Implementation follows architecture.

Architecture does not follow implementation.
