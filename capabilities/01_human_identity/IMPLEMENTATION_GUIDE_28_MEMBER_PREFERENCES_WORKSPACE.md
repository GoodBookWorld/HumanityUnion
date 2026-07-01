# IMPLEMENTATION_GUIDE_28_MEMBER_PREFERENCES_WORKSPACE

## Capability 01 — Human Identity

## Epic 03 — Member Preferences

Humanity Union Platform

Implementation Guide

Version 1.0

---

# Purpose

This guide introduces the Member Preferences Workspace.

The objective is to display the complete Member Preferences Domain in the web application using the existing Preferences API.

No advanced editing, validation, localization, or business logic is introduced.

---

# Objective

After completing this guide:

- A Preferences Workspace exists.
- The workspace loads Member Preferences from the API.
- The workspace reflects the Domain Model.
- Each Preference group is displayed in its own section.

---

# Blueprint Traceability

Implements:

- Capability 01 — Human Identity
- Epic 03 — Member Preferences
- Domain Design
- Domain Model
- Domain Decisions
- Guide 27

Engineering Principles:

- Domain First
- Domain Ownership
- Progressive Bootstrap
- Domain-Driven UI

---

# Review Existing Architecture

Review:

- Profile Workspace
- Member API client
- Existing layout
- Navigation components

Reuse architecture where appropriate.

Copy architecture, not code.

---

# Files to Create

Create if necessary:

```text
apps/web/src/app/preferences/page.tsx
apps/web/src/app/preferences/preferences-page.css
apps/web/src/features/preferences/preferences-api.ts
```

---

# Workspace Structure

The page shall contain the following sections:

- Experience
- Participation
- Communication
- Accessibility
- Workspace

Each section corresponds directly to one Value Object in the Domain Model.

---

# Data Source

Load data from:

```text
GET /api/v1/preferences/me
```

Do not duplicate state.

The API is the source of truth.

---

# Navigation

Provide a left-side navigation panel.

Navigation items:

- Experience
- Participation
- Communication
- Accessibility
- Workspace

Navigation layout should match the existing Profile workspace style.

---

# Display

Initially the workspace is read-oriented.

Simple editable controls may be added where straightforward.

No advanced editing workflow is required.

---

# Rules

Do NOT implement:

- Translation Engine
- Notification Center
- AI recommendations
- Accessibility engine
- Language switching
- Advanced validation

Focus only on displaying the Domain.

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

```text
http://localhost:3000/preferences
```

---

# Verification Checklist

Confirm:

✓ Preferences page renders

✓ API data displayed

✓ Five sections rendered

✓ Left navigation rendered

✓ TypeScript passes

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Create Member Preferences Workspace"
```

---

# Milestone

Capability 01

Epic 03

Guide 28

Status:

Completed after verification

---

# Next Guide

Guide 29

Member Preferences Public Projection

---

# Final Principle

The Workspace presents the Domain.

The Workspace never becomes the Domain.
