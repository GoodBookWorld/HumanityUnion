# IMPLEMENTATION_GUIDE_02

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

## Guide 02 — Initiative Store

Humanity Union Platform

Version 1.0

---

# Purpose

Implement the bootstrap Initiative Store.

This guide introduces in-memory persistence for Initiative during the Progressive Bootstrap phase.

No database is introduced.

---

# Architecture Reference

This guide implements the approved Domain Model.

It follows:

- Guide 01 — Initiative Domain
- Progressive Bootstrap
- Architecture Freeze

---

# Scope

Implement:

- bootstrap Initiative dataset
- in-memory Initiative Store
- query functions
- update functions

---

# Deliverables

Create:

apps/api/src/modules/initiatives/initiative.sample.ts

apps/api/src/modules/initiatives/initiative.store.ts

---

# Bootstrap Dataset

Create one bootstrap Initiative.

Suggested values:

- initiativeId
- stewardId
- title
- description
- status
- visibility
- metadata
- revisions
- contributions
- timeline

The dataset is intended for development only.

---

# Store

Implement an in-memory Map keyed by:

initiativeId

---

# Query Functions

Implement:

- getInitiativeById()
- listInitiatives()

Both functions return structured clones.

---

# Update Functions

Implement:

- createInitiative()
- updateInitiative()

Updates shall replace only supplied fields.

Identity fields remain immutable.

---

# Constraints

Do NOT implement:

- MongoDB
- Repository abstraction
- API routes
- Validation
- Authorization
- Workspace
- Projection
- Business Rules

Store only.

---

# Verification

Verify:

pnpm typecheck

Store imports Initiative from @hu/types.

No runtime dependencies outside the Store.

---

# Success Criteria

Guide 02 is complete when:

- bootstrap Initiative exists;
- store compiles;
- query functions work;
- update functions work;
- no API exists.

---

# Out of Scope

Deferred:

Guide 03 — Initiative API

Guide 04 — Initiative Workspace

Guide 05 — Initiative Public Projection

Guide 06 — Bootstrap Integration

Guide 07 — Architecture Review

---

# Final Principle

A bootstrap store proves the architecture before introducing permanent persistence.
