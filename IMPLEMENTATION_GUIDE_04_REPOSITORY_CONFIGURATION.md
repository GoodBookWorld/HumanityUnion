# Implementation Guide 04 — Repository Configuration

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide creates the root repository configuration files for Humanity Union.

This step prepares the monorepo for consistent TypeScript, formatting, linting, environment configuration, and package management.

No application code should be created during this guide.

---

# Objective

After completing this guide, the repository should contain the basic configuration required for future development.

This guide creates real configuration files with approved content.

---

# Files to Create or Update

Create or update these files in the project root:

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
.editorconfig
.gitignore
.prettierrc.json
.prettierignore
eslint.config.js
.env.example
```

---

# Root package.json

Create:

```json
{
  "name": "humanity-union-platform",
  "version": "0.1.0",
  "private": true,
  "description": "Humanity Union civic technology platform monorepo.",
  "packageManager": "pnpm@latest",
  "scripts": {
    "dev": "echo \"Development workspace not initialized yet\"",
    "build": "echo \"Build pipeline not initialized yet\"",
    "lint": "echo \"Linting not initialized yet\"",
    "format": "prettier . --write",
    "typecheck": "echo \"Type checking not initialized yet\""
  },
  "engines": {
    "node": ">=20"
  }
}
```

---

# pnpm-workspace.yaml

Create:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

# tsconfig.base.json

Create:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

---

# .editorconfig

Create:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

---

# .gitignore

Create or update:

```gitignore
# Dependencies
node_modules/

# Environment
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
.next/
out/
coverage/

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*

# OS files
.DS_Store
Thumbs.db

# Editor
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json

# Temporary
tmp/
temp/

# MongoDB local data
data/
```

---

# .prettierrc.json

Create:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

---

# .prettierignore

Create:

```gitignore
node_modules/
dist/
build/
.next/
out/
coverage/
pnpm-lock.yaml
```

---

# eslint.config.js

Create a placeholder configuration:

```js
export default [
  {
    ignores: ["node_modules/**", "dist/**", "build/**", ".next/**", "coverage/**"],
  },
];
```

Full ESLint rules will be added after dependencies are installed.

---

# .env.example

Create:

```env
# Humanity Union Environment Example

NODE_ENV=development

# API
API_PORT=4000

# Web
WEB_PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/humanity_union

# Authentication
JWT_SECRET=change_this_value
JWT_EXPIRES_IN=7d

# Platform
PLATFORM_NAME=Humanity Union
PLATFORM_URL=http://localhost:3000
```

---

# Rules

Do not install dependencies during this guide.

Do not create application code.

Do not initialize Next.js.

Do not initialize Express.

Do not delete legacy folders.

---

# Verification Checklist

Confirm that:

* package.json exists;
* pnpm-workspace.yaml exists;
* tsconfig.base.json exists;
* .editorconfig exists;
* .gitignore exists;
* .prettierrc.json exists;
* .prettierignore exists;
* eslint.config.js exists;
* .env.example exists;
* no application code was generated;
* legacy folders were not deleted.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Configure repository foundation"
```

---

# Next Guide

Implementation Guide 05 — Dependency Installation

The next guide will install the first development dependencies and prepare the workspace for real TypeScript development.

---

# Final Principle

Repository configuration is not administrative noise.

It protects consistency.

Consistency protects code quality.

Code quality protects Humanity Union.
