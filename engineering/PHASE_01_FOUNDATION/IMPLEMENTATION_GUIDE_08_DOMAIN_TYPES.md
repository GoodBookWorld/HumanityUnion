# Implementation Guide 08 — Domain Types

## Humanity Union Platform

Version 1.0

---

# Purpose

This guide creates the first shared domain types for Humanity Union.

These types define the common language of the platform and are shared across all applications and services.

They are independent of databases, APIs, and frameworks.

The domain model comes first.

Implementation follows the domain.

---

# Objective

After completing this guide:

* common domain foundation exists;
* shared base types exist;
* domain folders are prepared;
* every future platform module uses the same language.

---

# Directory Structure

Create the following structure:

```text
packages/types/

src/

common/
  identifier.ts
  timestamps.ts
  base-entity.ts
  metadata.ts
  audit.ts
  index.ts

domain/
  member.ts
  initiative.ts
  community.ts
  knowledge.ts
  impact.ts
  reflection.ts
  fair.ts
  opportunity.ts
  institution.ts
  region.ts
  index.ts

index.ts
```

---

# Phase A — Common Types

## identifier.ts

Create the shared Identifier type.

Purpose:

Provide a common identifier for all domain objects.

---

## timestamps.ts

Create shared timestamps.

Purpose:

Every major domain object should expose:

* createdAt
* updatedAt

---

## base-entity.ts

Create the shared BaseEntity interface.

Purpose:

Every major domain object extends BaseEntity.

Typical shared properties include:

* id
* timestamps

No business fields belong here.

---

## metadata.ts

Create a Metadata type.

Purpose:

Store optional platform metadata without changing domain objects.

---

## audit.ts

Create audit information.

Purpose:

Prepare future audit logging without coupling it to database implementation.

---

# Phase B — Domain Types

Create placeholder interfaces only.

No properties beyond minimal placeholders.

Files:

* member.ts
* initiative.ts
* community.ts
* knowledge.ts
* impact.ts
* reflection.ts
* fair.ts
* opportunity.ts
* institution.ts
* region.ts

Each interface should extend BaseEntity.

Business properties will be added in future guides.

---

# Barrel Files

Create:

```text
common/index.ts
domain/index.ts
src/index.ts
```

Purpose:

Provide clean package exports.

---

# Rules

Do not create:

* MongoDB schemas
* Mongoose models
* API DTOs
* Validation
* Business logic
* Services
* Controllers

Only shared domain definitions.

---

# Blueprint Traceability

This guide implements:

* 07_DATABASE_BLUEPRINT.md
* 09_INTENTION_ARCHITECTURE.md
* 10_PLATFORM_CONTRACT.md
* 13_DATA_MODEL.md
* 15_DEVELOPMENT_STANDARDS.md

---

# Verification Checklist

Confirm:

* common folder exists;
* domain folder exists;
* all planned files exist;
* BaseEntity exists;
* Identifier exists;
* Timestamp types exist;
* every domain type extends BaseEntity;
* barrel exports exist.

No application logic exists.

---

# Git Commit Recommendation

```bash
git add .
git commit -m "Create shared domain types foundation"
```

---

# Milestone

This guide completes the first implementation of the Humanity Union Domain Language.

The platform now has a shared vocabulary independent of implementation technologies.

---

# Next Guide

Implementation Guide 09 — API Bootstrap

The next guide will create the first executable Node.js / Express application using the shared domain language defined here.

---

# Final Principle

Code follows Domain.

Domain follows Humanity.

Technology serves both.
