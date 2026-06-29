# Implementation Guide 13 — Member Web Page

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide creates the first web page that displays Member data from the Humanity Union API.

It completes the first full vertical slice:

Shared Domain Types

↓

API

↓

Web

This guide does not create authentication, real user accounts, database storage, or final profile design.

---

# Objective

After completing this guide:

* Web app can request Member data from API;
* Member data appears in the browser;
* API and Web begin working together;
* Member identity becomes visible in the Human Experience layer.

---

# Blueprint Traceability

This guide implements foundations from:

* 10_PLATFORM_CONTRACT.md
* 12_PLATFORM_API_SPECIFICATION.md
* 13_DATA_MODEL.md
* 14_HUMAN_EXPERIENCE_SYSTEM.md
* 15_DEVELOPMENT_STANDARDS.md
* IMPLEMENTATION_GUIDE_11_MEMBER_DOMAIN.md
* IMPLEMENTATION_GUIDE_12_MEMBER_API.md

---

# Target Page

Create or update:

```text
apps/web/src/app/member/page.tsx
```

Route:

```text
http://localhost:3000/member
```

---

# API Source

The page should fetch Member data from:

```text
http://localhost:4000/api/v1/members/me
```

---

# Display Requirements

The page should display:

* displayName
* uniqueName
* location
* verificationLevel
* roles
* Fair summary
* Impact Profile summary

Use simple, readable layout.

No final design system yet.

---

# Root Page Update

Update:

```text
apps/web/src/app/page.tsx
```

Add a simple link to:

```text
/member
```

Label:

```text
View Member Profile
```

---

# Rules

Do not create:

* authentication;
* login;
* registration;
* database storage;
* final public profile design;
* My Impact dashboard;
* API client package;
* complex UI components.

Do not modify Blueprint.

Do not delete legacy folders.

---

# Error Handling

If API is not running, the page should show a simple message:

```text
Member API is not available.
```

Do not crash the web application.

---

# Verification

Run API:

```bash
pnpm dev:api
```

In another terminal window, run Web:

```bash
pnpm dev:web
```

Open:

```text
http://localhost:3000/member
```

Expected:

Member data from API appears on the page.

---

# Verification Checklist

Confirm:

* member page exists;
* homepage links to member page;
* page fetches API data;
* page handles API unavailable state;
* no authentication exists;
* no database code exists;
* no final design was created.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Display Member data in web application"
```

---

# Milestone

Successful completion marks:

Implementation Milestone I7 — Member Web Page

Status:

Completed

---

# Next Guide

Implementation Guide 14 — Authentication Foundation

The next guide will begin authentication architecture implementation.

---

# Final Principle

The Member page is not the final profile.

It is the first visible connection between Human Identity, API, and Web.

This is how the platform begins to become real.
