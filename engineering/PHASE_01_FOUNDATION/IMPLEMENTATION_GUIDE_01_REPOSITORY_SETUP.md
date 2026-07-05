# Implementation Guide 01 — Repository Setup

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide defines the first implementation step for Humanity Union.

Its purpose is to transform the current project folder into a professional monorepo structure without losing existing files or architectural documentation.

This guide must be followed carefully.

No code implementation should begin before the repository foundation is organized.

---

# Current Situation

The project currently contains early folders created during initial setup.

Examples:

- assets
- components
- database
- pages
- public
- api
- backend
- frontend

These folders must not be deleted immediately.

They may contain useful files or early structure.

They should be treated as legacy setup folders until reviewed and migrated.

---

# Target Repository Structure

Humanity Union will use a monorepo structure.

Target root structure:

```text
HumanityUnion/

apps/
packages/
blueprint/
docs/
scripts/
tests/
infrastructure/
public-archive/

PROJECT_ROADMAP.md
README.md
package.json
pnpm-workspace.yaml
.gitignore
.env.example
```

---

# Main Monorepo Areas

## apps

Application projects.

Planned apps:

```text
apps/
  web/
  admin/
  api/
```

- web — public platform, My Impact, Member experience.
- admin — administrative platform.
- api — Node.js / Express API server.

---

## packages

Shared reusable packages.

Planned packages:

```text
packages/
  types/
  ui/
  config/
  shared/
  sdk/
```

- types — shared TypeScript types.
- ui — shared UI components.
- config — shared configuration.
- shared — shared utilities.
- sdk — future client SDK for API communication.

---

## infrastructure

Infrastructure-related configuration.

Planned structure:

```text
infrastructure/
  docker/
  nginx/
  deployment/
  monitoring/
```

---

## blueprint

Architectural documentation.

Already contains:

```text
blueprint/
  README.md
  BLUEPRINT_CHANGELOG.md
  ARCHITECTURE_AUDIT.md
  Book_01_Foundation/
  Book_02_Engineering/
```

This folder must not be modified during repository setup except when explicitly instructed.

---

## docs

General technical and user documentation.

This is separate from blueprint.

Blueprint defines architecture.

Docs explain usage and support.

---

## scripts

Automation scripts.

Examples:

- setup scripts;
- migration scripts;
- development helpers.

---

## tests

Cross-application tests.

Examples:

- integration tests;
- end-to-end tests;
- system tests.

---

## public-archive

Temporary storage for legacy public files before migration.

This folder may be used only if old public assets need to be preserved before being moved to the correct app.

---

# Legacy Folder Policy

Existing early folders must be reviewed before migration.

Legacy folders include:

- assets
- components
- database
- pages
- public
- api
- backend
- frontend

Rules:

1. Do not delete legacy folders immediately.
2. Do not move files without review.
3. If empty, folders may later be removed after confirmation.
4. If useful, files should be migrated to the correct monorepo location.
5. All moves should be committed with clear Git messages.

---

# Migration Direction

Expected future migration:

```text
assets      → apps/web/public/assets or packages/ui/assets
components  → packages/ui
database    → apps/api/src/infrastructure/database or packages/database
pages       → apps/web/app or apps/web/pages
public      → apps/web/public
api         → apps/api
backend     → apps/api or archived
frontend    → apps/web
```

No migration should occur until explicitly requested.

---

# Package Manager

Humanity Union will use:

```text
pnpm
```

Reason:

- efficient dependency management;
- strong monorepo support;
- fast installation;
- workspace support.

npm may remain installed on the machine, but project dependency management should use pnpm.

---

# Technology Direction

Current approved stack:

- TypeScript
- Node.js
- Express
- MongoDB
- React
- Next.js
- PWA
- pnpm monorepo

Future decisions should follow the Blueprint.

---

# Repository Setup Tasks

## Step 1 — Create monorepo folders

Create:

```text
apps/
packages/
infrastructure/
public-archive/
```

Do not delete existing folders.

---

## Step 2 — Create application placeholders

Create:

```text
apps/web/
apps/admin/
apps/api/
```

---

## Step 3 — Create package placeholders

Create:

```text
packages/types/
packages/ui/
packages/config/
packages/shared/
packages/sdk/
```

---

## Step 4 — Create infrastructure placeholders

Create:

```text
infrastructure/docker/
infrastructure/nginx/
infrastructure/deployment/
infrastructure/monitoring/
```

---

## Step 5 — Create pnpm workspace file

Create:

```text
pnpm-workspace.yaml
```

with:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## Step 6 — Do not initialize apps yet

Do not create Next.js app yet.

Do not create Express server yet.

Do not install dependencies yet.

This guide only creates the repository foundation.

---

# Git Commit Recommendation

After completing this guide, commit with:

```bash
git add .
git commit -m "Set up monorepo repository foundation"
```

---

# Completion Criteria

This guide is complete when:

- monorepo folders exist;
- pnpm-workspace.yaml exists;
- no legacy folders are deleted;
- blueprint remains intact;
- no application code is generated yet.

---

# Final Rule

This step prepares the construction site.

It does not build the house.

Do not write application code during Repository Setup.

The next guide will define workspace tooling and package configuration.
