# IMPLEMENTATION_GUIDE_18_SESSION_CONTEXT

## Capability 01 — Human Identity

Humanity Union Platform

Version 1.0

---

# Purpose

This guide introduces Session Context for the Humanity Union API.

Session Context provides a single abstraction for accessing the current AuthIdentity.

This guide does not implement real sessions, JWT, cookies, OAuth, or database-backed authentication.

---

# Objective

After completing this guide:

* API has a Session Context abstraction;
* current AuthIdentity is accessed through Session Context;
* GET /api/v1/auth/me no longer reads bootstrap identity directly;
* future authentication mechanisms can replace bootstrap identity without changing route logic.

---

# Blueprint Traceability

Implements:

* Platform Contract
* Platform API Specification
* Human Identity Capability
* Epic 01 Authentication
* Guide 17 Authentication API Contract

---

# Files to Create

Create:

```text
apps/api/src/modules/auth/session.context.ts
```

---

# Files to Update

Update:

```text
apps/api/src/modules/auth/auth.routes.ts
apps/api/src/modules/auth/index.ts
```

---

# Required Implementation

Create a `SessionContext` interface.

It should expose:

```typescript
getCurrentIdentity()
```

Create a bootstrap implementation that returns the existing bootstrap AuthIdentity.

Update `GET /api/v1/auth/me` so it receives AuthIdentity through Session Context.

---

# Rules

Do not implement:

* JWT
* cookies
* sessions
* OAuth
* database storage
* login
* registration
* password logic

Do not modify Blueprint documents.

Do not change the public API response shape.

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
GET http://localhost:4000/api/v1/auth/me
```

Expected:

* returns AuthIdentity;
* response envelope remains unchanged;
* no real authentication required.

---

# Verification Checklist

Confirm:

* session.context.ts exists;
* SessionContext interface exists;
* bootstrap Session Context exists;
* auth/me uses Session Context;
* TypeScript passes;
* no real authentication was added.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Add Session Context for authentication"
```

---

# Milestone

Capability 01

Epic 01 Authentication

Guide 18 — Session Context

Status:

Completed after verification

---

# Next Guide

Guide 19 — Authentication Middleware

---

# Final Principle

Routes should not know how identity is resolved.

They should only request the current identity from a stable context.
