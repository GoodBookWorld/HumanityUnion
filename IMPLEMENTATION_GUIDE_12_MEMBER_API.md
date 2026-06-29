# Implementation Guide 12 — Member API

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide creates the first read-only Member API endpoint for Humanity Union Platform.

The purpose is to expose a temporary sample Member through the API using the shared Member domain types.

This guide does not create authentication, database storage, registration, login, or real user management.

---

# Objective

After completing this guide:

* API can return a sample Member;
* Member API uses the shared `@hu/types` domain model;
* API response follows the Platform API Specification;
* the Member domain becomes visible through the running API.

---

# Blueprint Traceability

This guide implements foundations from:

* 10_PLATFORM_CONTRACT.md
* 12_PLATFORM_API_SPECIFICATION.md
* 13_DATA_MODEL.md
* 15_DEVELOPMENT_STANDARDS.md
* IMPLEMENTATION_GUIDE_11_MEMBER_DOMAIN.md

---

# Target Endpoint

Create:

```text
GET /api/v1/members/me
```

Expected purpose:

Return a temporary sample Member representing the current Member.

This is not authentication.

This is a controlled bootstrap endpoint.

---

# Files to Create

Create:

```text
apps/api/src/modules/member/
  member.sample.ts
  member.routes.ts
  index.ts
```

---

# Files to Update

Update:

```text
apps/api/src/app.ts
```

to mount Member routes at:

```text
/api/v1/members
```

---

# Shared Type Usage

The sample Member must use:

```typescript
import type { Member } from "@hu/types";
```

If imports from `@hu/types` fail, fix package exports or workspace linking without changing the domain meaning.

---

# Sample Member Requirements

Create a sample Member with:

* id;
* profile;
* status;
* verificationLevel;
* roles;
* fair;
* impactProfile;
* createdAt;
* updatedAt.

Use neutral bootstrap data.

Example profile:

```text
displayName: "Humanity Union Member"
uniqueName: "humanity-member"
country: "Canada"
region: "British Columbia"
city: "Nelson"
languages: ["en"]
```

---

# Response Format

Endpoint response must follow the standard API format:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "links": {},
  "message": ""
}
```

Message:

```text
Member profile loaded.
```

---

# Rules

Do not create:

* authentication;
* database models;
* MongoDB connection;
* registration;
* login;
* password fields;
* frontend page;
* real user lookup.

Do not modify Blueprint.

Do not delete legacy folders.

---

# Verification Commands

Run:

```bash
pnpm typecheck
```

Run:

```bash
pnpm dev:api
```

Open:

```text
http://localhost:4000/api/v1/members/me
```

Expected:

* success true;
* Member object returned;
* no authentication required yet;
* response format matches Platform API Specification.

---

# Verification Checklist

Confirm:

* member module folder exists;
* `member.sample.ts` exists;
* `member.routes.ts` exists;
* `index.ts` exists;
* endpoint `/api/v1/members/me` works;
* sample Member uses shared `Member` type;
* no database code exists;
* no authentication code exists.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Add read-only Member API endpoint"
```

---

# Milestone

Successful completion marks:

Implementation Milestone I6 — Member API

Status:

Completed

---

# Next Guide

Implementation Guide 13 — Member Web Page

The next guide will display the sample Member in the web application by calling the Member API endpoint.

---

# Final Principle

A Member endpoint is not just data.

It is the first technical expression of the human identity at the center of Humanity Union.
