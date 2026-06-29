# Implementation Guide 14 — Shared API Client

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide creates the first shared API client for the Humanity Union web application.

The goal is to prevent frontend pages from calling raw API URLs directly.

Instead, API communication should be centralized in a small, reusable client layer.

This guide prepares the platform for future authentication, error handling, environment configuration, and shared request logic.

---

# Objective

After completing this guide:

* Web API calls are centralized;
* Member page no longer hardcodes fetch logic directly;
* API base URL is defined in one place;
* future authentication tokens can be added without rewriting pages.

---

# Blueprint Traceability

This guide implements foundations from:

* 10_PLATFORM_CONTRACT.md
* 12_PLATFORM_API_SPECIFICATION.md
* 14_HUMAN_EXPERIENCE_SYSTEM.md
* 15_DEVELOPMENT_STANDARDS.md
* IMPLEMENTATION_GUIDE_13_MEMBER_WEB_PAGE.md

---

# Target Structure

Create:

```text
apps/web/src/lib/
  api-client.ts

apps/web/src/features/member/
  member-api.ts
```

Update:

```text
apps/web/src/app/member/page.tsx
```

---

# API Client

Create:

```text
apps/web/src/lib/api-client.ts
```

Purpose:

Provide one reusable API request function.

Requirements:

* define API base URL;
* default base URL should be `http://localhost:4000`;
* support JSON responses;
* throw readable errors when requests fail.

---

# Member API Layer

Create:

```text
apps/web/src/features/member/member-api.ts
```

Purpose:

Provide Member-specific API access.

Requirements:

* export a function:
  `getCurrentMember()`

* internally call:
  `/api/v1/members/me`

* use the shared API client;

* return Member data.

---

# Member Page Update

Update:

```text
apps/web/src/app/member/page.tsx
```

Requirements:

* remove direct raw fetch logic;
* use `getCurrentMember()`;
* preserve current display behavior;
* preserve API unavailable message.

---

# Rules

Do not create:

* authentication;
* token storage;
* login;
* registration;
* database logic;
* global state management;
* complex error framework.

Do not modify Blueprint documents.

Do not change API endpoint behavior.

---

# Verification

Run:

```bash
pnpm typecheck
```

Run API:

```bash
pnpm dev:api
```

Run Web in another terminal:

```bash
pnpm dev:web
```

Open:

```text
http://localhost:3000/member
```

Expected:

* Member data still appears;
* behavior is unchanged;
* API calls now pass through shared client.

---

# Verification Checklist

Confirm:

* `api-client.ts` exists;
* `member-api.ts` exists;
* Member page imports `getCurrentMember`;
* Member page no longer directly hardcodes API fetch;
* TypeScript passes;
* Member page still works.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Add shared API client for web"
```

---

# Milestone

Successful completion marks:

Implementation Milestone I8 — Shared API Client

Status:

Completed

---

# Next Guide

Implementation Guide 15 — Authentication Foundation

The next guide begins the authentication foundation for the Humanity Union Platform.

---

# Final Principle

Direct API calls inside pages create future duplication.

Shared API clients create consistency.

Consistency protects the platform as it grows.
