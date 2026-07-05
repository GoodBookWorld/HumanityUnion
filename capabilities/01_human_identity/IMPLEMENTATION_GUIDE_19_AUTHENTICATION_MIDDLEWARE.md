# IMPLEMENTATION_GUIDE_19_AUTHENTICATION_MIDDLEWARE

## Capability 01 — Human Identity

## Epic 01 — Authentication

Humanity Union Platform

Version 1.0

---

# Purpose

This guide introduces the Authentication Middleware.

The middleware becomes the single entry point for authentication inside the API.

It resolves the current AuthIdentity through Session Context and attaches it to the request.

This guide still does not implement real authentication.

---

# Objective

After completing this guide:

- Authentication Middleware exists.
- Protected routes can use the middleware.
- Middleware resolves AuthIdentity through Session Context.
- Route handlers no longer need to resolve identity manually.

---

# Blueprint Traceability

Implements:

- Human Identity Capability
- Epic 01 Authentication
- Guide 18 Session Context
- Platform API Specification

---

# Files to Create

Create:

```text
apps/api/src/modules/auth/auth.middleware.ts
```

---

# Files to Update

Update if necessary:

```text
apps/api/src/modules/auth/index.ts
apps/api/src/modules/auth/auth.routes.ts
```

---

# Required Implementation

Create middleware:

AuthenticationMiddleware

Responsibilities:

- Obtain current AuthIdentity using Session Context.
- Attach AuthIdentity to the request.
- Call next().

The middleware must never:

- validate passwords;
- inspect JWT;
- inspect cookies;
- inspect OAuth tokens.

Identity resolution belongs exclusively to Session Context.

---

# Request Extension

Extend the Express Request type to expose:

```typescript
request.auth;
```

Type:

```typescript
AuthIdentity;
```

The extension should remain reusable for future authentication implementations.

---

# Route Update

Update:

```text
GET /api/v1/auth/me
```

The route must:

- receive AuthIdentity from request.auth;
- never call Session Context directly.

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

Do not change public API contracts.

Do not modify Blueprint.

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

- returns AuthIdentity;
- route receives identity from middleware;
- Session Context remains internal.

---

# Verification Checklist

Confirm:

- auth.middleware.ts exists;
- request.auth exists;
- middleware uses Session Context;
- routes no longer use Session Context directly;
- TypeScript passes.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Introduce Authentication Middleware"
```

---

# Milestone

Capability 01

Epic 01 Authentication

Guide 19 — Authentication Middleware

Status:

Completed after verification

---

# Next Guide

Guide 20 — Current Identity Endpoint

---

# Final Principle

Authentication Middleware owns identity resolution.

Routes consume identity.

They never resolve it themselves.
