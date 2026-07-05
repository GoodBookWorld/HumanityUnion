# Implementation Guide 02 — Workspace Setup

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide prepares a consistent development environment for Humanity Union.

Every developer should work with the same tools, conventions, and configuration.

The goal is to eliminate unnecessary setup differences and ensure predictable development.

---

# Objectives

After completing this guide:

- the workspace is ready for development;
- coding standards are enforceable;
- formatting is automatic;
- project configuration is centralized;
- future implementation guides can assume a common environment.

---

# Approved Development Stack

Programming Language

- TypeScript

Runtime

- Node.js (LTS)

Package Manager

- pnpm

Backend

- Express

Frontend

- Next.js

Database

- MongoDB

Version Control

- Git

IDE

- Cursor or Visual Studio Code

---

# Workspace Standards

Every contributor should use:

- UTF-8 encoding
- LF line endings
- EditorConfig
- Prettier
- ESLint
- TypeScript strict mode

These standards prevent unnecessary formatting differences.

---

# Files to Create

The following files will be created during this phase:

```text
.editorconfig
.gitignore
.prettierignore
.prettierrc.json
eslint.config.js
tsconfig.base.json
.env.example
pnpm-workspace.yaml
```

No application code should be added yet.

---

# Package Manager

Humanity Union uses:

pnpm

Requirements:

- install the latest stable version;
- use workspaces;
- do not use npm install inside applications;
- all dependencies are managed from the repository root.

---

# Git Configuration

Repository rules:

- meaningful commits;
- one logical change per commit;
- no generated files committed;
- secrets are never committed;
- .env files remain local.

---

# Environment Variables

Only an example file is stored:

.env.example

Real environment files remain outside version control.

Sensitive information must never appear in the repository.

---

# Code Formatting

Formatting should be automatic.

Prettier is responsible for:

- indentation;
- spacing;
- line width;
- quote consistency.

Formatting should never become a discussion during code reviews.

---

# Static Analysis

ESLint verifies:

- code quality;
- consistency;
- potential mistakes;
- unused variables;
- import organization.

Warnings should be addressed before merging.

---

# TypeScript

TypeScript should operate in strict mode.

Avoid:

- implicit any;
- unchecked null values;
- weak typing.

The compiler should help developers prevent errors.

---

# Repository Health Check

Before implementation begins, verify:

- pnpm installed;
- Git repository clean;
- workspace files exist;
- Blueprint available;
- no legacy folders deleted;
- repository structure matches Guide 01.

---

# Cursor Workspace

Cursor should use:

- project-wide context;
- Blueprint documentation;
- engineering standards;
- implementation guides.

Cursor should generate code that follows the Blueprint rather than inventing architecture.

---

# Zero Manual Configuration

A new contributor should only need to run:

```bash
pnpm install

pnpm dev
```

If additional manual configuration becomes necessary, the setup should be improved.

---

# Completion Criteria

This guide is complete when:

- workspace configuration files exist;
- development tools are standardized;
- project formatting is consistent;
- repository is ready for implementation.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Configure development workspace foundation"
```

---

# Final Principle

A reliable engineering environment is part of the product.

Consistent tools create consistent code.

Consistent code protects architecture.

Protected architecture protects Humanity Union.
