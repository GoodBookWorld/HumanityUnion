# IMPLEMENTATION_GUIDE_20_CURRENT_IDENTITY_ENDPOINT

## Capability 01 — Human Identity

## Epic 01 — Authentication

Humanity Union Platform

Version 1.0

---

# Purpose

This guide finalizes the Current Identity Endpoint.

The endpoint becomes the official public API for obtaining the currently authenticated identity.

Its implementation must remain independent of any specific authentication technology.

---

# Objective

After completing this guide:

- GET /api/v1/auth/me becomes the official Current Identity endpoint.
- The endpoint relies entirely on Authentication Middleware.
- The endpoint exposes only AuthIdentity.
- API behavior is considered stable.

---

# Blueprint Traceability

Implements:

- Human Identity Capability
- Epic 01 Authentication
- Guide 19 Authentication Middleware
- Platform API Specification

---

# Files to Review

Review:

```text
apps/api/src/modules/auth/auth.routes.ts
apps/api/src/modules/auth/auth.middleware.ts
apps/api/src/modules/auth/session.context.ts
```

---

# Required Implementation

Verify that:

- GET /api/v1/auth/me receives AuthIdentity only from request.auth.
- The route performs no authentication logic.
- The route performs no identity resolution.
- The route simply returns the current AuthIdentity using the standard Humanity Union response envelope.

Update the success message to:

```text
Current identity loaded.
```

The response body must continue exposing only AuthIdentity.

---

# Rules

Do not implement:

- JWT
- Cookies
- Sessions
- OAuth
- Login
- Registration
- Database

Do not modify Blueprint documents.

Do not modify public API contracts except for the success message.

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

Expected response:

- HTTP 200
- AuthIdentity returned
- Message:
  "Current identity loaded."

---

# Verification Checklist

Confirm:

- auth/me uses Authentication Middleware.
- auth/me reads request.auth.
- auth/me returns AuthIdentity.
- Success message updated.
- TypeScript passes.
- No authentication technology introduced.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Finalize Current Identity endpoint"
```

---

# Milestone

Capability 01

Epic 01 — Authentication

Guide 20 — Current Identity Endpoint

Status:

Completed after verification

---

# Epic Completion

Successful completion of this guide marks:

Epic 01 — Authentication

Status:

Completed

---

# Next Epic

Epic 02 — Member Profile

---

# Final Principle

The Current Identity endpoint exposes identity.

It never authenticates.

It never authorizes.

It only reports the current authenticated identity.
