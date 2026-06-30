# Implementation Guide 16 — Auth-Aware Member API

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide connects the temporary authentication identity to the Member API.

The purpose is to begin separating technical identity from civic Member identity in real API behavior.

This guide does not implement real authentication, JWT, passwords, sessions, cookies, registration, login, or database storage.

---

# Objective

After completing this guide:

* Member API reads a temporary AuthIdentity;
* Member API uses `memberId` from AuthIdentity;
* Member response remains unchanged;
* architecture clearly separates AuthIdentity and Member.

---

# Blueprint Traceability

This guide implements foundations from:

* 10_PLATFORM_CONTRACT.md
* 11_ENGINEERING_ARCHITECTURE.md
* 12_PLATFORM_API_SPECIFICATION.md
* 13_DATA_MODEL.md
* 15_DEVELOPMENT_STANDARDS.md
* IMPLEMENTATION_GUIDE_15_AUTHENTICATION_FOUNDATION.md

---

# Current State

The platform currently has:

* shared Member domain type;
* shared AuthIdentity domain type;
* sample Member;
* bootstrap AuthIdentity;
* read-only Member endpoint.

Now the Member endpoint should depend on temporary identity instead of directly returning a hardcoded Member.

---

# Target Behavior

Endpoint:

```text
GET /api/v1/members/me
```

Should:

1. Load temporary bootstrap AuthIdentity.
2. Read `memberId` from AuthIdentity.
3. Resolve the sample Member by that `memberId`.
4. Return the same Member response as before.

This prepares the system for real authentication later.

---

# Files to Review

Review existing files:

```text
apps/api/src/modules/auth/auth.identity.ts
apps/api/src/modules/member/member.sample.ts
apps/api/src/modules/member/member.routes.ts
```

---

# Files to Update

Update:

```text
apps/api/src/modules/member/member.sample.ts
apps/api/src/modules/member/member.routes.ts
```

Optional if useful:

```text
apps/api/src/modules/member/index.ts
```

---

# Required Implementation

## Member Sample Lookup

In `member.sample.ts`, export a function:

```typescript
getSampleMemberById(memberId: string)
```

It should return the sample Member when `memberId` matches:

```text
member-bootstrap-001
```

If it does not match, return `null`.

---

## Member Route

In `member.routes.ts`:

* import bootstrap AuthIdentity;
* read `memberId`;
* call `getSampleMemberById(memberId)`;
* return Member if found;
* return a standard error response if not found.

---

# Not Found Response

If Member is not found, return:

```json
{
  "success": false,
  "data": null,
  "meta": {},
  "links": {},
  "message": "Member not found."
}
```

Use HTTP status:

```text
404
```

---

# Success Response

Keep current successful response behavior:

```json
{
  "success": true,
  "data": {
    "id": "member-bootstrap-001"
  },
  "meta": {},
  "links": {},
  "message": "Member profile loaded."
}
```

Full Member data should remain included as before.

---

# Rules

Do not create:

* JWT;
* password logic;
* login;
* logout;
* registration;
* sessions;
* cookies;
* database;
* MongoDB models;
* frontend auth UI.

Do not modify Blueprint documents.

Do not change the public API route.

Do not change the successful response shape.

---

# Verification

Run:

```bash
pnpm typecheck
```

Run API:

```bash
pnpm dev:api
```

Open:

```text
http://localhost:4000/api/v1/members/me
```

Expected:

* same Member response as before;
* route now internally uses AuthIdentity;
* no authentication prompt required yet.

---

# Verification Checklist

Confirm:

* `getSampleMemberById()` exists;
* Member route imports AuthIdentity;
* Member route uses `memberId`;
* successful endpoint still works;
* 404 behavior exists for missing Member;
* TypeScript passes;
* no real authentication was added;
* no database was added.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Connect temporary AuthIdentity to Member API"
```

---

# Milestone

Successful completion marks:

Implementation Milestone I10 — Auth-Aware Member API

Status:

Completed

---

# Next Guide

Implementation Guide 17 — Authentication API Contract

The next guide will define the first temporary authentication API contract without implementing real login yet.

---

# Final Principle

Authentication identifies access.

Member represents participation.

The API must connect them carefully without merging them.
