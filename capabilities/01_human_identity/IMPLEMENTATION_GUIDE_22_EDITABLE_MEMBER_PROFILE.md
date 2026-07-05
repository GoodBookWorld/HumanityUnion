# IMPLEMENTATION_GUIDE_22_EDITABLE_MEMBER_PROFILE

## Capability 01 — Human Identity

## Epic 02 — Member Profile

Humanity Union Platform

Version 1.0

---

# Purpose

This guide introduces the Editable Member Profile model.

The Member becomes responsible for managing its own profile data through the Member domain.

This guide establishes the editing contract without introducing persistent storage.

---

# Objective

After completing this guide:

- Member Profile becomes editable.
- Editing remains inside the Member domain.
- Profile updates follow Domain Ownership.
- Bootstrap profile can be modified during runtime.

---

# Blueprint Traceability

Implements:

- Capability 01 — Human Identity
- Epic 02 — Member Profile
- Principle of Structured Identity
- Principle of Domain Ownership

---

# Files to Review

Review:

```text
apps/api/src/modules/member/
packages/types/src/domain/member.ts
```

---

# Files to Update

Update:

```text
apps/api/src/modules/member/member.routes.ts
apps/api/src/modules/member/index.ts
```

Create if necessary:

```text
apps/api/src/modules/member/member.store.ts
```

---

# Required Implementation

Introduce an editable bootstrap Member Store.

The store owns the Member profile.

The API:

```text
PATCH /api/v1/members/me
```

must:

- require Authentication Middleware;
- identify the Member through `request.auth.memberId`;
- accept editable Member profile fields;
- update only editable fields;
- return the updated Member using the standard Humanity Union response envelope.

Editable bootstrap fields:

- displayName
- country
- region
- city
- languages

Do not allow editing:

- id
- roles
- verificationLevel
- fair
- createdAt
- updatedAt

The route must never modify AuthIdentity.

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

Do not change the shared Member domain structure.

Do not modify Blueprint documents.

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
PATCH http://localhost:4000/api/v1/members/me
```

Example payload:

```json
{
  "displayName": "Vlad",
  "city": "Nelson",
  "languages": ["en", "uk"]
}
```

Expected:

- HTTP 200
- Updated bootstrap Member returned
- Standard response envelope preserved

---

# Verification Checklist

Confirm:

- Authentication Middleware is used.
- request.auth.memberId identifies the Member.
- Editable fields are updated.
- Protected fields remain unchanged.
- TypeScript passes.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Introduce editable Member profile"
```

---

# Milestone

Capability 01

Epic 02 — Member Profile

Guide 22 — Editable Member Profile

Status:

Completed after verification

---

# Next Guide

Guide 23 — Member Profile Web Form

---

# Final Principle

Only the Member domain may modify the Member profile.

All other domains interact with it through stable contracts.
