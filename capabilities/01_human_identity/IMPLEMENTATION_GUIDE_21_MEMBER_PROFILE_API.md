# IMPLEMENTATION_GUIDE_21_MEMBER_PROFILE_API

## Capability 01 — Human Identity

## Epic 02 — Member Profile

Humanity Union Platform

Version 1.0

---

# Purpose

This guide establishes the official Member Profile API.

It introduces a stable contract for retrieving the current Member profile while preserving the separation between Authentication and Member domains.

No persistence layer is introduced.

---

# Objective

After completing this guide:

- Member Profile API is officially established.
- Profile retrieval uses the authenticated Member identity.
- API returns the shared Member domain model.
- Authentication and Member remain independent.

---

# Blueprint Traceability

Implements:

- Capability 01 — Human Identity
- Epic 02 — Member Profile
- Epic 01 — Authentication
- Platform API Specification

---

# Files to Review

Review:

```text
apps/api/src/modules/member/
apps/api/src/modules/auth/
packages/types/src/domain/member.ts
```

---

# Files to Update

Update if necessary:

```text
apps/api/src/modules/member/member.routes.ts
apps/api/src/modules/member/index.ts
```

---

# Required Implementation

The endpoint:

```text
GET /api/v1/members/me
```

must:

- use Authentication Middleware;
- obtain Member identity from request.auth.memberId;
- return the bootstrap Member corresponding to the authenticated identity;
- use the standard Humanity Union response envelope.

The route must never:

- authenticate the request;
- resolve AuthIdentity;
- access Session Context directly.

---

# Rules

Do not implement:

- MongoDB
- JWT
- Cookies
- Sessions
- OAuth
- Registration
- Login

Do not change the Member shared domain model.

Do not modify Blueprint.

---

# Verification

Run:

```bash
pnpm typecheck
```

Run:

```bash
pnpm dev:api
```

Verify:

```text
GET http://localhost:4000/api/v1/members/me
```

Expected:

- HTTP 200
- Member returned
- Standard response envelope
- Identity resolved through Authentication Middleware

---

# Verification Checklist

Confirm:

- Authentication Middleware is used.
- request.auth.memberId is used.
- Member is returned.
- Session Context is not accessed directly.
- TypeScript passes.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Implement Member Profile API"
```

---

# Milestone

Capability 01

Epic 02 — Member Profile

Guide 21 — Member Profile API

Status:

Completed after verification

---

# Next Guide

Guide 22 — Profile Update API

---

# Final Principle

Authentication identifies the Member.

The Member API represents the Member.

These responsibilities must always remain independent.
