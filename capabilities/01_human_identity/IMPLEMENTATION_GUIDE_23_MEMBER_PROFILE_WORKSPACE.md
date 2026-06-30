# IMPLEMENTATION_GUIDE_23_MEMBER_PROFILE_WORKSPACE

## Capability 01 — Human Identity

## Epic 02 — Member Profile

Humanity Union Platform

Version 1.0

---

# Purpose

This guide introduces the first Member Workspace page.

The Profile becomes the first workspace section and demonstrates how future workspace modules will integrate into a unified participant experience.

This guide establishes the UI foundation only.

---

# Objective

After completing this guide:

* A Member Profile Workspace page exists.
* The page loads profile data from the Member Profile API.
* Editable profile fields are displayed.
* The page is prepared for future workspace navigation.

---

# Blueprint Traceability

Implements:

* Capability 01 — Human Identity
* Epic 02 — Member Profile
* Guide 21 — Member Profile API
* Guide 22 — Editable Member Profile
* Principle of Structured Identity

---

# Files to Review

Review:

```text
apps/web/src/
apps/web/src/lib/api-client.ts
```

---

# Files to Create

Create if necessary:

```text
apps/web/src/components/member/
```

Suggested components:

```text
MemberWorkspace.tsx
ProfileSection.tsx
ProfileField.tsx
```

---

# Files to Update

Update:

```text
apps/web/src/app/profile/page.tsx
```

Create the route if it does not exist.

---

# Required Implementation

The page must:

* load Member Profile using:

GET /api/v1/members/me

* display:

Basic Information

* Display Name
* Country
* Region
* City
* Languages

Prepare (placeholder only):

* Skills
* Interests
* Participation
* Visibility
* Preferences

Display placeholders as:

"Coming soon"

Do not implement editing yet.

Guide 23 is a read-only workspace.

---

# UI Principles

Follow:

* clean layout
* responsive design
* accessibility
* minimal visual noise
* future left navigation compatibility

The page should already resemble the future Member Workspace.

---

# Rules

Do not implement:

* profile editing UI
* database
* authentication UI
* verification UI
* preferences UI

Use only the existing Member API.

---

# Verification

Run:

```bash
pnpm typecheck
```

Run:

```bash
pnpm dev:web
```

Verify:

Open:

```text
/profile
```

Expected:

* Profile data loads
* Workspace layout displayed
* Placeholder sections visible
* No editing controls

---

# Verification Checklist

Confirm:

* Workspace page exists.
* API data loads.
* Member information displayed.
* Placeholder sections rendered.
* TypeScript passes.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Create Member Profile Workspace"
```

---

# Milestone

Capability 01

Epic 02 — Member Profile

Guide 23 — Member Profile Workspace

Status:

Completed after verification

---

# Next Guide

Guide 24 — Public Member Profile Foundation

---

# Final Principle

The Member Workspace grows with participation.

The interface should reveal capabilities progressively while remaining calm, clear, and focused.
