# API DESIGN GUIDELINES

Version: 1.0

Status: Active

---

# Purpose

This document defines the API design standards used throughout the Humanity Union platform.

Its purpose is to ensure that all platform APIs remain consistent, predictable and aligned with the domain model.

---

# API Philosophy

The API exposes the domain.

The API does not implement the domain.

Business rules belong to Domain Aggregates and Stores.

The API coordinates communication between clients and the platform.

---

# Thin API Principle

Every API endpoint performs only four responsibilities:

- receive the request;
- validate the request;
- invoke the application layer;
- return the response.

Business logic must never be implemented inside controllers.

---

# Aggregate-Centered Design

Every Aggregate owns its own REST resource.

Example:

```
/initiatives

/collaborative-analysis

/collective-decisions
```

Endpoints should represent business concepts rather than technical implementation.

---

# Standard Resource Operations

Every Aggregate should expose a consistent resource interface.

```
GET    /resource

GET    /resource/:id

POST   /resource

PATCH  /resource/:id
```

These endpoints manage the Aggregate itself.

---

# Domain Commands

Business actions are represented as explicit commands.

Examples:

```
POST /collective-decisions/:id/open

POST /collective-decisions/:id/close

POST /collective-decisions/:id/participant-decisions

POST /collective-decisions/:id/calculate-result
```

Commands express business intent.

They are not property updates.

---

# Response Envelope

Every endpoint returns the standard platform envelope.

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "links": {},
  "message": ""
}
```

The response format remains consistent across the platform.

---

# Validation

Validation occurs before application logic.

Validation includes:

- identifiers;
- required fields;
- immutable fields;
- lifecycle constraints;
- input structure.

Validation does not implement business policy.

---

# Mapping

Controllers never expose internal domain models directly.

Dedicated mappers transform:

```
Domain

↓

API Response
```

Public responses remain stable even if internal models evolve.

---

# Public APIs

Operational endpoints and public endpoints are separated.

Examples:

```
/api/v1/collective-decisions

/api/v1/public/collective-decisions
```

Public endpoints expose only approved information.

---

# Versioning

API versioning follows the platform convention.

```
/api/v1/
```

Breaking changes require a new version.

---

# Error Handling

Errors should be:

- explicit;
- deterministic;
- understandable;
- consistent.

Internal implementation details must never be exposed.

---

# API Evolution

New endpoints should extend existing Aggregate boundaries.

New resources should only be introduced when a new Aggregate is created.

---

# Final Principle

The API should communicate the language of the domain.

Clients should understand the business model through the API without needing to understand the internal implementation.
