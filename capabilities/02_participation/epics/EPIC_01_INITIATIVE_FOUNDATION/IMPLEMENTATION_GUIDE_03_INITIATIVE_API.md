# IMPLEMENTATION_GUIDE_03

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

## Guide 03 — Initiative API

Humanity Union Platform

Version 1.0

---

# Purpose

Implement the bootstrap REST API for Initiatives.

This guide exposes the Initiative Store through HTTP endpoints.

No database or advanced business rules are introduced.

---

# Architecture Reference

This guide implements:

- Guide 01 — Initiative Domain
- Guide 02 — Initiative Store

The implementation shall conform to the approved Architecture Freeze.

---

# Scope

Implement:

- Initiative routes
- Route registration
- Bootstrap CRUD endpoints

Use the existing Initiative Store.

---

# Deliverables

Create:

apps/api/src/modules/initiatives/initiative.routes.ts

apps/api/src/modules/initiatives/index.ts

Modify:

apps/api/src/app.ts

---

# Endpoints

Implement:

## GET /api/v1/initiatives

Returns all bootstrap Initiatives.

---

## GET /api/v1/initiatives/:initiativeId

Returns one Initiative.

Return 404 when not found.

---

## POST /api/v1/initiatives

Creates a bootstrap Initiative.

Uses the Store only.

---

## PATCH /api/v1/initiatives/:initiativeId

Updates an Initiative.

Partial updates only.

Identity fields remain immutable.

Return 404 when Initiative does not exist.

---

# Response Format

Use the Humanity Union standard response envelope.

Success:

- success
- data
- meta
- links
- message

Failure:

- success
- data
- meta
- links
- message

---

# Constraints

Do NOT implement:

- MongoDB
- Validation engine
- Permissions
- Authentication
- Authorization
- Workspace
- Public Projection
- Business Rules
- Timeline generation

API only.

---

# Verification

Verify:

pnpm typecheck

Manual verification using:

- GET
- POST
- PATCH

All endpoints must respond successfully.

---

# Success Criteria

Guide 03 is complete when:

- routes compile;
- endpoints function correctly;
- app.ts registers the routes;
- no authentication is required during bootstrap;
- no business logic is introduced.

---

# Out of Scope

Deferred:

Guide 04 — Initiative Workspace

Guide 05 — Initiative Public Projection

Guide 06 — Bootstrap Integration

Guide 07 — Epic Architecture Review

---

# Final Principle

The API exposes the Domain.

It does not redefine it.
