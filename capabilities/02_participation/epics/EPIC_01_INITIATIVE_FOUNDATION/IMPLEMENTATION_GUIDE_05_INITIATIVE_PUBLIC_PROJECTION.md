# IMPLEMENTATION_GUIDE_05

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

## Guide 05 — Initiative Public Projection

Humanity Union Platform

Version 1.0

---

# Purpose

Implement the Public Initiative Projection.

This guide introduces the public representation of an Initiative.

The Public Projection is independent from the internal Initiative Aggregate and follows the Principle of Explicit Publicity.

---

# Architecture Reference

This guide implements:

- Guide 01 — Initiative Domain
- Guide 02 — Initiative Store
- Guide 03 — Initiative API
- Guide 04 — Initiative Workspace

The implementation shall conform to the approved Architecture Freeze.

---

# Scope

Implement:

- PublicInitiativeProjection
- Projection Builder
- Public REST API
- Public Initiative page

The projection is read-only.

---

# Deliverables

Create:

packages/types/src/domain/public-initiative.ts

apps/api/src/modules/initiatives/public-initiative.projection.ts

apps/api/src/modules/initiatives/public-initiative.routes.ts

apps/web/src/app/initiatives/public/[initiativeId]/page.tsx

---

# Public Projection

Implement:

PublicInitiativeProjection

Expose only:

- initiativeId
- title
- description
- status
- metadata
- stewardDisplayName
- createdAt

Exclude:

- stewardId
- visibility
- updatedAt
- timeline
- revisions
- contributions
- internal metadata

---

# Projection Builder

Implement:

toPublicInitiativeProjection()

The Projection Builder is the single source responsible for transforming:

Initiative

↓

PublicInitiativeProjection

No projection logic shall exist elsewhere.

---

# Public API

Implement:

GET /api/v1/public/initiatives/:initiativeId

Return:

- Standard Humanity Union response envelope
- HTTP 404 when Initiative is not found

---

# Public Page

Display:

- Title
- Description
- Status
- Metadata
- Steward display name
- Created date

Read-only.

---

# Constraints

Do NOT implement:

- Editing
- Authentication
- Authorization
- Discussions
- Polls
- Petitions
- Timeline UI
- Revision UI
- Contribution UI
- Business Logic

Projection only.

---

# Verification

Verify:

pnpm typecheck

Manual verification:

- GET /api/v1/public/initiatives/:initiativeId
- Public page renders
- Projection excludes private fields

---

# Success Criteria

Guide 05 is complete when:

- Projection compiles;
- Projection Builder compiles;
- Public API functions correctly;
- Public page renders successfully;
- No private fields are exposed.

---

# Out of Scope

Deferred:

Guide 06 — Platform Integration

Guide 07 — Epic Architecture Review

---

# Final Principle

A Projection presents information.

It never exposes the Domain.