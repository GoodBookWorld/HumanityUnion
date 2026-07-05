# Implementation Guide 15 — Authentication Foundation

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide creates the authentication foundation for Humanity Union Platform.

The purpose is not to build full registration or login yet.

This guide prepares the architecture for authentication by creating shared authentication domain types and a temporary API identity structure.

No database storage, password handling, sessions, or real JWT implementation is created in this guide.

---

# Objective

After completing this guide:

- shared authentication domain types exist;
- API has an authentication module folder;
- API has a temporary current identity helper;
- future login and registration can be added without restructuring.

---

# Blueprint Traceability

This guide implements foundations from:

- 10_PLATFORM_CONTRACT.md
- 11_ENGINEERING_ARCHITECTURE.md
- 12_PLATFORM_API_SPECIFICATION.md
- 13_DATA_MODEL.md
- 15_DEVELOPMENT_STANDARDS.md
- IMPLEMENTATION_GUIDE_11_MEMBER_DOMAIN.md
- IMPLEMENTATION_GUIDE_12_MEMBER_API.md

---

# Shared Types

Create:

```text
packages/types/src/domain/auth.ts
```

Create the following domain types:

- AuthUserId
- AuthProvider
- AuthAccountStatus
- AuthRole
- AuthIdentity

---

# AuthProvider

Allowed values:

- email
- google
- apple
- github

---

# AuthAccountStatus

Allowed values:

- active
- pending
- disabled
- archived

---

# AuthRole

Allowed values:

- member
- moderator
- admin
- institution

---

# AuthIdentity

Purpose:

Represents the authenticated technical identity.

Fields:

- id
- email
- provider
- status
- roles
- memberId
- createdAt
- updatedAt

Important:

AuthIdentity is technical identity.

Member is civic identity.

Do not merge them.

---

# Export Rules

Update:

```text
packages/types/src/domain/index.ts
```

to export Auth domain types.

Ensure auth types are available through:

```typescript
import type { AuthIdentity } from "@hu/types";
```

---

# API Auth Module

Create:

```text
apps/api/src/modules/auth/
  auth.identity.ts
  index.ts
```

---

# Temporary Identity

Create a temporary bootstrap identity.

Requirements:

- use AuthIdentity type from `@hu/types`;
- connect to existing bootstrap Member id:
  `member-bootstrap-001`;
- use email:
  `bootstrap@humanityunion.local`;
- provider:
  `email`;
- status:
  `active`;
- roles:
  `["member"]`.

This is not real authentication.

This is bootstrap identity scaffolding.

---

# Rules

Do not create:

- password handling;
- JWT;
- sessions;
- cookies;
- registration;
- login;
- logout;
- database users;
- MongoDB models;
- OAuth logic;
- frontend auth UI.

Do not modify Blueprint documents.

Do not change Member endpoint behavior yet.

---

# Verification

Run:

```bash
pnpm typecheck
```

Expected:

- TypeScript passes;
- AuthIdentity is importable from `@hu/types`;
- API compiles.

---

# Verification Checklist

Confirm:

- `packages/types/src/domain/auth.ts` exists;
- AuthIdentity exists;
- auth exports are available;
- `apps/api/src/modules/auth/auth.identity.ts` exists;
- temporary identity uses shared AuthIdentity type;
- no real authentication logic exists;
- no password or token logic exists.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Add authentication foundation types"
```

---

# Milestone

Successful completion marks:

Implementation Milestone I9 — Authentication Foundation

Status:

Completed

---

# Next Guide

Implementation Guide 16 — Auth-Aware Member API

The next guide will connect the temporary AuthIdentity to the Member API so the system begins distinguishing technical identity from civic Member identity.

---

# Final Principle

Authentication protects access.

Member identity represents human participation.

Humanity Union must keep these concepts connected but never confused.
