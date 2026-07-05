# Implementation Guide 09 — API Bootstrap

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide creates the first executable API application for Humanity Union Platform.

The API Bootstrap establishes a clean Node.js, Express, and TypeScript server foundation.

This guide does not implement business logic, authentication, MongoDB, Platform Services, or Platform Engines.

---

# Objective

After completing this guide:

- `apps/api` becomes an executable TypeScript application;
- Express server is configured;
- health endpoint exists;
- API structure follows Humanity Union Engineering Architecture;
- the server can run locally;
- future Platform Services can be added without restructuring.

---

# Blueprint Traceability

This guide implements foundations from:

- `10_PLATFORM_CONTRACT.md`
- `11_ENGINEERING_ARCHITECTURE.md`
- `12_PLATFORM_API_SPECIFICATION.md`
- `13_DATA_MODEL.md`
- `15_DEVELOPMENT_STANDARDS.md`
- `IMPLEMENTATION_GUIDE_07_PLATFORM_CORE.md`
- `IMPLEMENTATION_GUIDE_08_DOMAIN_TYPES.md`

---

# Required Dependencies

Install API dependencies from the repository root.

Runtime dependencies:

```bash
pnpm add express cors helmet dotenv
```

Development dependencies:

```bash
pnpm add -D -w @types/node
pnpm add -D --filter ./apps/api typescript tsx @types/express @types/cors
```

If the filter command fails because `apps/api/package.json` does not exist yet, create the package first, then run the filtered install.

---

# Target Structure

Create the following structure:

```text
apps/api/

package.json
tsconfig.json

src/
  index.ts
  app.ts

  config/
    environment.ts

  routes/
    health.routes.ts

  shared/
    http-response.ts

  modules/
    README.md

  services/
    README.md

  engines/
    README.md

  events/
    README.md

  infrastructure/
    README.md
```

---

# apps/api/package.json

Create:

```json
{
  "name": "@hu/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "dependencies": {
    "cors": "latest",
    "dotenv": "latest",
    "express": "latest",
    "helmet": "latest"
  },
  "devDependencies": {
    "@types/cors": "latest",
    "@types/express": "latest",
    "tsx": "latest",
    "typescript": "latest"
  }
}
```

---

# apps/api/tsconfig.json

Create:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"]
  },
  "include": ["src"]
}
```

---

# src/config/environment.ts

Create a simple environment config.

Requirements:

- load `.env`;
- define `apiPort`;
- define `nodeEnv`;
- default port should be `4000`.

---

# src/shared/http-response.ts

Create a standard API response helper.

Response format must follow `12_PLATFORM_API_SPECIFICATION.md`:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "links": {},
  "message": ""
}
```

---

# src/routes/health.routes.ts

Create a health route:

```text
GET /api/v1/health
```

Response should include:

- success true;
- service name;
- version;
- status;
- message.

---

# src/app.ts

Create Express app.

Requirements:

- use helmet;
- use cors;
- use express.json;
- mount health routes at `/api/v1/health`;
- expose a default app export.

---

# src/index.ts

Start server.

Requirements:

- import app;
- import environment config;
- listen on API port;
- log server URL.

---

# Root package.json Update

Update root scripts:

```json
{
  "dev": "pnpm --filter @hu/api dev",
  "dev:api": "pnpm --filter @hu/api dev",
  "build": "pnpm --filter @hu/api build",
  "lint": "eslint .",
  "format": "prettier . --write",
  "format:check": "prettier . --check",
  "typecheck": "pnpm --filter @hu/api typecheck"
}
```

Keep existing metadata unchanged.

---

# Rules

Do not create:

- MongoDB connection;
- authentication;
- member module;
- initiative module;
- services implementation;
- engines implementation;
- frontend app.

Do not delete legacy folders.

Do not modify Blueprint documents.

---

# Verification Commands

From repository root:

```bash
pnpm install
```

Then:

```bash
pnpm typecheck
```

Then:

```bash
pnpm dev:api
```

Open:

```text
http://localhost:4000/api/v1/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "service": "Humanity Union API",
    "version": "0.1.0",
    "status": "healthy"
  },
  "meta": {},
  "links": {},
  "message": "Humanity Union API is running."
}
```

---

# Verification Checklist

Confirm:

- `apps/api/package.json` exists;
- `apps/api/tsconfig.json` exists;
- `apps/api/src/index.ts` exists;
- `apps/api/src/app.ts` exists;
- health route works;
- API runs on port 4000;
- response format follows Platform API Specification;
- no business logic was created;
- no MongoDB code was created;
- no frontend code was created.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Bootstrap API application"
```

---

# Milestone

Successful completion marks:

**Implementation Milestone I3 — API Bootstrap**

Status:

Completed

---

# Next Guide

Implementation Guide 10 — Web Bootstrap

The next guide will create the first Next.js web application for Humanity Union Platform.

---

# Final Principle

The first API endpoint is not a feature.

It is proof that the Blueprint can become a living system.

Build the smallest working foundation first.

Then extend it with discipline.
