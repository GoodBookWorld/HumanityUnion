# IMPLEMENTATION_GUIDE_24_PUBLIC_MEMBER_PROJECTION

## Capability 01 — Human Identity

## Epic 02 — Member Profile

Humanity Union Platform

Version 1.0

---

# Purpose

This guide introduces the first Public Member Projection.

The projection represents the public view of a Member while preserving the complete private Member model internally.

No data duplication is introduced.

---

# Objective

After completing this guide:

* Public Member Projection exists.
* Public profile is independent from the private workspace.
* Projection exposes only public fields.
* Projection becomes the foundation for future public member pages.

---

# Blueprint Traceability

Implements:

* Capability 01 — Human Identity
* Epic 02 — Member Profile
* Principle of Multiple Projections
* Principle of Domain Ownership

---

# Files to Review

Review:

```text
packages/types/src/domain/member.ts

apps/api/src/modules/member/

apps/web/src/
```

---

# Files to Create

Create if necessary:

```text
packages/types/src/domain/member-public-projection.ts
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
apps/web/src/app/member/[uniqueName]/page.tsx
```

---

# Required Implementation

Create:

MemberPublicProjection

Expose only:

* displayName
* uniqueName
* country
* region
* languages

Do NOT expose:

* fair
* verificationLevel
* impactProfile
* private preferences
* internal identifiers except uniqueName

API:

```text
GET /api/v1/members/public/:uniqueName
```

returns:

MemberPublicProjection

using the standard Humanity Union response envelope.

Create a bootstrap public profile page:

```text
/member/humanity-member
```

Display:

* Display Name
* Country
* Region
* Languages

Prepare placeholders:

* Public Initiatives
* Public Participation
* Public Organizations

Display:

"Coming soon"

---

# Rules

Do not implement:

* MongoDB
* Search
* Directory
* Followers
* Messaging
* Authentication UI

Use projection only.

---

# Verification

Run:

```bash
pnpm typecheck
```

Run:

```bash
pnpm dev
```

Verify:

```text
GET /api/v1/members/public/humanity-member
```

Open:

```text
/member/humanity-member
```

Expected:

* Public projection returned
* Public page displayed
* Private fields hidden

---

# Verification Checklist

Confirm:

* Projection exists.
* Public API works.
* Public page works.
* Private fields are not exposed.
* TypeScript passes.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Introduce Member Public Projection"
```

---

# Milestone

Capability 01

Epic 02 — Member Profile

Guide 24 — Public Member Projection

Status:

Completed after verification

---

# Next Guide

Guide 25 — Epic 02 Architecture Review

---

# Final Principle

Public information is never produced by hiding private fields.

It is produced by an explicit public projection.
