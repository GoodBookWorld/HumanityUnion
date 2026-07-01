# IMPLEMENTATION_GUIDE_27_MEMBER_PREFERENCES_API

## Capability 01 — Human Identity

## Epic 03 — Member Preferences

Humanity Union Platform

Implementation Guide

Version 1.0

---

# Purpose

This guide introduces the bootstrap API for the Member Preferences Domain.

The objective is to expose Member Preferences through authenticated API endpoints without introducing persistence, validation, or business logic.

---

# Objective

After completing this guide:

- Member Preferences API exists.
- Preferences can be retrieved.
- Preferences can be updated.
- Authentication Middleware protects all routes.
- Bootstrap in-memory storage is used.

---

# Blueprint Traceability

Implements:

- Capability 01 — Human Identity
- Epic 03 — Member Preferences
- PREFERENCES_DOMAIN_DESIGN.md
- DOMAIN_MODEL.md
- DOMAIN_DECISIONS.md

Engineering Principles:

- Domain First
- Domain Ownership
- Progressive Bootstrap
- Stable Domains

---

# Review Existing Architecture

Review:

- Authentication Middleware
- Member module
- Member Store
- Member Routes

Reuse the established architectural pattern.

Copy architecture, not code.

---

# Files to Create

Create if necessary:

```text
apps/api/src/modules/preferences/
```

- preferences.routes.ts
- preferences.store.ts
- preferences.sample.ts
- index.ts

---

# API

Implement:

GET

```text
/api/v1/preferences/me
```

Returns:

MemberPreferences

PATCH

```text
/api/v1/preferences/me
```

Updates editable preference values.

---

# Bootstrap Store

Use an in-memory bootstrap store.

No MongoDB.

No persistence.

No database abstraction.

---

# Authentication

All endpoints must use:

authenticationMiddleware

Identity source:

request.auth.memberId

---

# Editable Fields

Only editable preference fields.

No Member Profile fields.

No AuthIdentity fields.

No Visibility.

No Verification.

---

# Response

Use the standard Humanity Union API envelope.

---

# Rules

Do NOT implement:

- MongoDB
- Validation Engine
- Translation Engine
- Notification Delivery
- AI Preferences
- Workspace
- Public Projection

Bootstrap implementation only.

---

# Verification

Run:

```bash
pnpm typecheck
```

Verify:

```text
GET /api/v1/preferences/me
PATCH /api/v1/preferences/me
```

---

# Verification Checklist

Confirm:

✓ API routes operational

✓ Middleware used

✓ Bootstrap store operational

✓ Shared types used

✓ TypeScript passes

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Create Member Preferences API"
```

---

# Milestone

Capability 01

Epic 03

Guide 27

Status:

Completed after verification

---

# Next Guide

Guide 28

Member Preferences Workspace

---

# Final Principle

Every API must expose the Domain.

The API must never redefine the Domain.
