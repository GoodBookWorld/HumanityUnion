# Implementation Guide 10 — Web Bootstrap

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide creates the first executable web application for Humanity Union Platform.

The Web Bootstrap establishes a clean Next.js and TypeScript foundation inside the monorepo.

This guide does not implement authentication, My Impact, API integration, business logic, or final user interface.

---

# Objective

After completing this guide:

* `apps/web` becomes an executable Next.js application;
* the web application runs locally;
* the first Humanity Union page appears in the browser;
* the application is ready for future Human Experience implementation.

---

# Blueprint Traceability

This guide implements foundations from:

* 11_ENGINEERING_ARCHITECTURE.md
* 12_PLATFORM_API_SPECIFICATION.md
* 13_DATA_MODEL.md
* 14_HUMAN_EXPERIENCE_SYSTEM.md
* 15_DEVELOPMENT_STANDARDS.md
* IMPLEMENTATION_GUIDE_07_PLATFORM_CORE.md
* IMPLEMENTATION_GUIDE_08_DOMAIN_TYPES.md
* IMPLEMENTATION_GUIDE_09_API_BOOTSTRAP.md

---

# Required Dependencies

Install web dependencies from the repository root.

Runtime dependencies:

```bash
pnpm add --filter ./apps/web next react react-dom
```

Development dependencies:

```bash
pnpm add -D --filter ./apps/web typescript @types/react @types/react-dom
```

---

# Target Structure

Create:

```text
apps/web/

package.json
tsconfig.json
next.config.ts

src/
  app/
    layout.tsx
    page.tsx
    globals.css

public/
```

---

# apps/web/package.json

Create:

```json
{
  "name": "@hu/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc --noEmit"
  }
}
```

Dependencies will be managed from the workspace root.

---

# apps/web/tsconfig.json

Create:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

---

# next.config.ts

Create:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

---

# src/app/layout.tsx

Create a minimal layout.

Requirements:

* metadata title:
  Humanity Union

* metadata description:
  World Solidarity civic technology platform

* import globals.css

* render children.

---

# src/app/page.tsx

Create the first Humanity Union page.

Display only:

```text
Humanity Union

WORLD SOLIDARITY

Humanity Union Platform is starting.
```

No navigation.

No authentication.

No API integration.

No styling except basic layout.

---

# globals.css

Create minimal global styling.

Requirements:

* remove default margins;
* use a system font;
* vertically and horizontally center content;
* calm minimal appearance.

No design system yet.

---

# Root package.json

Ensure scripts include:

```json
{
  "dev": "pnpm --parallel dev:api dev:web",
  "dev:api": "pnpm --filter @hu/api dev",
  "dev:web": "pnpm --filter @hu/web dev",
  "build": "pnpm --filter @hu/api build && pnpm --filter @hu/web build",
  "typecheck": "pnpm --filter @hu/api typecheck && pnpm --filter @hu/web typecheck"
}
```

Do not modify unrelated scripts.

---

# Rules

Do not create:

* authentication;
* My Impact;
* API client;
* Platform Services;
* Platform Engines;
* MongoDB;
* final design;
* production homepage.

Do not modify Blueprint.

Do not remove legacy folders.

---

# Verification

Run:

```bash
pnpm install
```

Run:

```bash
pnpm dev:web
```

Open:

```text
http://localhost:3000
```

Expected result:

```text
Humanity Union

WORLD SOLIDARITY

Humanity Union Platform is starting.
```

---

# Verification Checklist

Confirm:

* apps/web exists;
* package.json exists;
* tsconfig.json exists;
* next.config.ts exists;
* layout.tsx exists;
* page.tsx exists;
* globals.css exists;
* application runs on port 3000;
* no business logic exists;
* no API integration exists.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Bootstrap web application"
```

---

# Milestone

Successful completion marks:

Implementation Milestone I4 — Web Bootstrap

Status:

Completed

---

# Next Guide

Implementation Guide 11 — Platform Core Integration

The next guide connects:

* Shared Platform Core
* Domain Types
* API
* Web

into one coherent engineering system.

---

# Final Principle

The first web page is not the platform.

It is proof that the platform can grow.

Build a reliable foundation.

Then build meaningful experiences.
