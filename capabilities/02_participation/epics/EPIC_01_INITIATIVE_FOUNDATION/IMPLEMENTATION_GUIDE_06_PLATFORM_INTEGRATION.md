# IMPLEMENTATION_GUIDE_06

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

## Guide 06 — Platform Integration

Humanity Union Platform

Version 1.0

---

# Purpose

Verify that all components implemented in Epic 01 operate together as a single integrated Capability.

This guide introduces no new functionality.

Its purpose is to confirm that the complete Initiative vertical slice functions correctly.

---

# Architecture Reference

Verify integration of:

- Guide 01 — Initiative Domain
- Guide 02 — Initiative Store
- Guide 03 — Initiative API
- Guide 04 — Initiative Workspace
- Guide 05 — Initiative Public Projection

The implementation shall conform to the approved Architecture Freeze.

---

# Scope

Verify the complete Initiative flow:

Domain

↓

Store

↓

REST API

↓

Workspace

↓

Public Projection

No new architectural elements are introduced.

---

# Deliverables

Verify successful integration of:

- Domain exports
- Store
- REST API
- Workspace
- Public Projection

The complete Capability shall operate as one coherent vertical slice.

---

# Integration Checklist

## Domain

Verify:

- Initiative exported from @hu/types
- PublicInitiativeProjection exported from @hu/types

---

## Store

Verify:

- bootstrap Initiative exists
- getInitiativeById()
- listInitiatives()
- createInitiative()
- updateInitiative()

---

## API

Verify:

GET /api/v1/initiatives

GET /api/v1/initiatives/:initiativeId

POST /api/v1/initiatives

PATCH /api/v1/initiatives/:initiativeId

GET /api/v1/public/initiatives/:initiativeId

Verify:

- standard response envelope
- HTTP status codes
- immutable identity fields

---

## Workspace

Verify:

- Initiative Workspace renders
- Initiative Explorer loads data
- Initiative Overview loads data
- Start New Initiative action is visible

---

## Public Projection

Verify:

Projection Builder

↓

Public API

↓

Public Page

Confirm that no private fields are exposed.

---

# Constraints

Do NOT implement:

- new features
- new endpoints
- new UI
- new business logic

Integration verification only.

---

# Verification

Verify:

pnpm typecheck

next build

Manual verification:

- API endpoints
- Workspace
- Public page

Repository compiles successfully.

---

# Success Criteria

Guide 06 is complete when:

- all previous Guides integrate successfully;
- no architectural inconsistencies remain;
- the complete Capability functions as one vertical slice.

---

# Out of Scope

Guide 07 — Epic Architecture Review

---

# Final Principle

A Capability is complete only when all architectural layers operate together as one coherent system.
