# IMPLEMENTATION_GUIDE_29_PUBLIC_PARTICIPATION_PROFILE

## Capability 01 — Human Identity

## Epic 03 — Member Preferences

Humanity Union Platform

Implementation Guide

Version 1.0

---

# Purpose

This guide introduces the Public Participation Profile.

The objective is to provide a safe public projection of a Member's participation interests.

This guide does not expose Member Preferences.

---

# Objective

After completing this guide:

- Public Participation Profile exists.
- Only explicitly public participation information is exposed.
- The profile follows the Principle of Explicit Publicity.

---

# Blueprint Traceability

Implements:

- Capability 01 — Human Identity
- Epic 03 — Member Preferences
- Domain Decisions
- Guide 28

Engineering Principles:

- Domain Ownership
- Domain First
- Stable Domains
- Multiple Projections
- Explicit Publicity

---

# Review Existing Architecture

Review:

- Member Public Projection
- Member Preferences Domain
- Existing projection pattern

Reuse architectural patterns.

Copy architecture, not code.

---

# Files to Create

Create if necessary:

```text
apps/api/src/modules/participation/
```

- participation.projection.ts

```text
apps/web/src/app/participation/[uniqueName]/page.tsx
apps/web/src/app/participation/[uniqueName]/participation-page.css
```

---

# Public Projection

Create:

PublicParticipationProfile

The projection may include only:

- Display Name
- Languages (if public)
- Interested Topics (if public)
- Volunteer Interests (if public)
- Preferred Participation Regions (if public)

No other fields.

---

# Excluded Information

Never expose:

- Communication Preferences
- Accessibility Preferences
- Workspace Preferences
- Time Zone
- Date Format
- Time Format
- Translation Preferences
- Internal identifiers
- Verification
- Roles

---

# Visibility

Every public field must respect explicit visibility rules.

No field is public by default.

---

# Workspace

Create a public page:

```text
/participation/[uniqueName]
```

The page is read-only.

No editing.

---

# Rules

Do NOT implement:

- Search
- Directory
- Matching
- AI recommendations
- Community suggestions
- Organization integration

Bootstrap implementation only.

---

# Verification

Run:

```bash
pnpm typecheck
```

Verify:

Public Participation page renders.

Projection contains only approved fields.

---

# Verification Checklist

Confirm:

✓ Projection created

✓ No private fields exposed

✓ Public page renders

✓ TypeScript passes

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Create Public Participation Profile"
```

---

# Milestone

Capability 01

Epic 03

Guide 29

Status:

Completed after verification

---

# Next Guide

Guide 30

Epic 03 Architecture Review

---

# Final Principle

Public participation exists to encourage collaboration.

Privacy always takes precedence over convenience.
