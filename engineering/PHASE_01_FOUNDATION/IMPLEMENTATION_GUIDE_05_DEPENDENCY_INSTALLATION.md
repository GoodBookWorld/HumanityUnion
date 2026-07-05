# Implementation Guide 05 — Dependency Installation

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide installs the first development dependencies for the Humanity Union monorepo.

The goal is to prepare the repository for TypeScript development, formatting, linting, and future application setup.

This guide does not create application code.

---

# Objective

After completing this guide:

- pnpm is available;
- dependencies are installed from the repository root;
- formatting tools are ready;
- linting tools are ready;
- TypeScript tools are ready;
- pnpm-lock.yaml is created.

---

# Prerequisite

Repository Foundation must be complete.

Required files:

- package.json
- pnpm-workspace.yaml
- tsconfig.base.json
- .editorconfig
- .gitignore
- .prettierrc.json
- .prettierignore
- eslint.config.js
- .env.example

---

# Step 1 — Check pnpm

Run:

```bash
pnpm -v
```

If pnpm is not installed, install it with:

```bash
npm install -g pnpm
```

Then check again:

```bash
pnpm -v
```

---

# Step 2 — Install development dependencies

From the repository root, run:

```bash
pnpm add -D typescript prettier eslint @eslint/js typescript-eslint
```

---

# Step 3 — Install workspace dependencies

Run:

```bash
pnpm install
```

This should create:

```text
pnpm-lock.yaml
```

---

# Step 4 — Update package.json scripts

Update root package.json scripts to:

```json
{
  "dev": "echo \"Development workspace not initialized yet\"",
  "build": "echo \"Build pipeline not initialized yet\"",
  "lint": "eslint .",
  "format": "prettier . --write",
  "format:check": "prettier . --check",
  "typecheck": "tsc --noEmit -p tsconfig.base.json"
}
```

Do not change the project name, version, private flag, description, packageManager, or engines unless necessary.

---

# Step 5 — Update eslint.config.js

Replace the placeholder with:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "build/**", ".next/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
```

---

# Step 6 — Verification commands

Run:

```bash
pnpm format:check
```

Then run:

```bash
pnpm lint
```

Then run:

```bash
pnpm typecheck
```

At this stage, warnings may appear because no application code exists yet. Critical configuration errors should be fixed.

---

# Rules

Do not create application code.

Do not initialize Next.js.

Do not initialize Express.

Do not create MongoDB models.

Do not move legacy folders.

Do not modify Blueprint documents.

---

# Expected Result

The repository should now contain:

- node_modules/
- pnpm-lock.yaml
- updated package.json
- updated eslint.config.js

---

# Verification Checklist

Confirm:

- pnpm works;
- dependencies are installed;
- pnpm-lock.yaml exists;
- package.json scripts are updated;
- eslint.config.js uses ESLint and TypeScript ESLint;
- no application code was created;
- legacy folders remain untouched.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Install development dependencies"
```

---

# Next Guide

Implementation Guide 06 — First Running Workspace

The next guide will create the first minimal executable workspace scripts and confirm that the repository can run clean development checks.

---

# Final Principle

Dependencies are not just tools.

They define the working discipline of the project.

Install only what supports the architecture.
