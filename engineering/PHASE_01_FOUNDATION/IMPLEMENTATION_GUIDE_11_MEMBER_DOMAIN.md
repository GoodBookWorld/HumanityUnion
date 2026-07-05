# Implementation Guide 11 — Member Domain

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide creates the first real domain model of Humanity Union: Member.

Member is the human-centered core of the platform.

No Initiative, Community, Reflection, Fair, or Impact can exist meaningfully without a Member.

This guide defines the shared Member domain types inside `packages/types`.

It does not create authentication, database models, API endpoints, or frontend pages.

---

# Objective

After completing this guide:

- Member domain language exists in TypeScript;
- Member-related types are shared across the platform;
- API and Web can later use the same Member model;
- no database-specific implementation is introduced.

---

# Blueprint Traceability

This guide implements foundations from:

- 03_INFORMATION_ARCHITECTURE.md
- 06_HUMAN_JOURNEYS.md
- 09_INTENTION_ARCHITECTURE.md
- 10_PLATFORM_CONTRACT.md
- 13_DATA_MODEL.md
- 15_DEVELOPMENT_STANDARDS.md
- IMPLEMENTATION_GUIDE_08_DOMAIN_TYPES.md

---

# Target File

Update:

```text
packages/types/src/domain/member.ts
```

---

# Required Domain Types

Create the following TypeScript domain types.

---

## MemberId

Purpose:

Represents the unique identifier of a Member.

It should be a string alias.

---

## MemberStatus

Purpose:

Represents the lifecycle status of a Member.

Allowed values:

- active
- inactive
- suspended
- archived

---

## VerificationLevel

Purpose:

Represents the current verification level of a Member.

Allowed values:

- none
- email
- identity
- institution
- trusted

---

## MemberRole

Purpose:

Represents platform-level roles.

Allowed values:

- member
- moderator
- admin
- institution

This is not final authorization architecture.

It is only a shared domain concept.

---

## FairBalance

Purpose:

Represents Member Fair summary.

Fields:

- personal
- community
- regional
- global

All values should be numbers.

Fair measures participation, not human value.

---

## MemberProfile

Purpose:

Represents public-facing Member profile information.

Fields:

- displayName
- uniqueName
- avatarUrl
- country
- region
- city
- bio
- languages

Keep optional fields optional.

---

## ImpactProfileSummary

Purpose:

Represents a short summary of Member intention and participation preferences.

Fields:

- scope
- priorityCategories
- preferredTools
- timeCommitment

Use string arrays for early implementation.

Detailed Impact Profile will be expanded later.

---

## Member

Purpose:

Represents the main Member domain object.

Member should extend BaseEntity.

Fields:

- id
- profile
- status
- verificationLevel
- roles
- fair
- impactProfile
- createdAt
- updatedAt

---

# Export Rules

Update:

```text
packages/types/src/domain/index.ts
```

to export Member domain types.

Update:

```text
packages/types/src/index.ts
```

if needed so Member types are available from `@hu/types`.

---

# Rules

Do not create:

- authentication logic;
- password fields;
- database models;
- Mongoose schemas;
- API controllers;
- frontend components;
- business services.

Do not include sensitive private data.

Do not include implementation-specific storage details.

---

# Verification Checklist

Confirm:

- `packages/types/src/domain/member.ts` exists;
- MemberId exists;
- MemberStatus exists;
- VerificationLevel exists;
- MemberRole exists;
- FairBalance exists;
- MemberProfile exists;
- ImpactProfileSummary exists;
- Member exists;
- Member extends BaseEntity;
- domain exports are updated;
- package exports are updated.

---

# Suggested TypeScript Shape

Use this as implementation guidance:

```typescript
import type { BaseEntity } from "../common/base-entity";

export type MemberId = string;

export type MemberStatus = "active" | "inactive" | "suspended" | "archived";

export type VerificationLevel = "none" | "email" | "identity" | "institution" | "trusted";

export type MemberRole = "member" | "moderator" | "admin" | "institution";

export interface FairBalance {
  personal: number;
  community: number;
  regional: number;
  global: number;
}

export interface MemberProfile {
  displayName: string;
  uniqueName: string;
  avatarUrl?: string;
  country?: string;
  region?: string;
  city?: string;
  bio?: string;
  languages: string[];
}

export interface ImpactProfileSummary {
  scope: string;
  priorityCategories: string[];
  preferredTools: string[];
  timeCommitment?: string;
}

export interface Member extends BaseEntity {
  profile: MemberProfile;
  status: MemberStatus;
  verificationLevel: VerificationLevel;
  roles: MemberRole[];
  fair: FairBalance;
  impactProfile?: ImpactProfileSummary;
}
```

---

# Validation

Run:

```bash
pnpm typecheck
```

If TypeScript import paths fail, fix exports without changing the domain meaning.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Define Member domain types"
```

---

# Milestone

Successful completion marks:

Implementation Milestone I5 — Member Domain

Status:

Completed

---

# Next Guide

Implementation Guide 12 — Member API

The next guide will expose a temporary read-only Member endpoint using the shared Member domain type.

---

# Final Principle

Member is not a database record.

Member is the human identity of Humanity Union.

Technology must protect that meaning.
