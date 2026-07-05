# IMPLEMENTATION_GUIDE_04

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

## Guide 04 — Initiative Workspace

Humanity Union Platform

Version 1.0

---

# Purpose

Implement the Initiative Workspace for the Participation Capability.

This guide introduces the first user-facing workspace for viewing and starting Initiatives.

The Workspace consumes the Initiative API and presents the Initiative Domain without containing business logic.

---

# Architecture Reference

This guide implements:

- Guide 01 — Initiative Domain
- Guide 02 — Initiative Store
- Guide 03 — Initiative API

The implementation shall conform to the approved Architecture Freeze.

---

# Scope

Implement:

- Initiative Workspace
- Initiative Explorer
- Initiative Overview
- Start New Initiative action
- Workspace navigation integration

The implementation is read-first.

No editing workflow is introduced.

---

# Deliverables

Create:

apps/web/src/app/initiatives/page.tsx

apps/web/src/features/initiatives/

apps/web/src/features/initiatives/api.ts

apps/web/src/features/initiatives/components/

---

# Workspace Structure

The Workspace shall follow the approved structure:

Initiative Workspace

↓

Explorer

↓

Overview

↓

Actions

---

## Initiative Explorer

Display:

- Initiative title
- Status
- Steward
- Created date

The Explorer loads data from:

GET /api/v1/initiatives

Selecting an Initiative updates the Overview.

---

## Initiative Overview

Display:

- Title
- Description
- Status
- Metadata
- Timeline count
- Revision count
- Contribution count

Load data from:

GET /api/v1/initiatives/:initiativeId

Overview is read-only.

---

## Actions

Provide:

Start New Initiative

Bootstrap behavior is acceptable.

Advanced creation workflow is deferred.

---

# Navigation

Add:

Initiatives

to the shared Workspace navigation.

The navigation integrates with:

- Profile
- Preferences
- Initiatives

---

# API Usage

Consume only:

GET /api/v1/initiatives

GET /api/v1/initiatives/:initiativeId

Workspace shall not access the Store directly.

---

# Constraints

Do NOT implement:

- Editing
- Rich text editor
- Timeline UI
- Revision UI
- Contribution UI
- Discussions
- Polls
- Petitions
- Implementation workflow
- Authentication
- Authorization
- Business Logic

Workspace only.

---

# Verification

Verify:

pnpm typecheck

Workspace renders successfully.

Verify:

- Initiative Workspace
- Initiative Explorer
- Initiative Overview
- Start New Initiative action
- Navigation entry

---

# Success Criteria

Guide 04 is complete when:

- Workspace renders correctly;
- Explorer loads Initiative list;
- Overview loads Initiative details;
- Navigation includes Initiatives;
- Start New Initiative action is visible;
- no business logic exists inside the Workspace.

---

# Out of Scope

Deferred:

Guide 05 — Initiative Public Projection

Guide 06 — Platform Integration

Guide 07 — Epic Architecture Review

---

# Final Principle

The Workspace presents the Domain.

It does not implement the Domain.
