# IMPLEMENTATION_GUIDE_03_COLLABORATIVE_ANALYSIS_API

## Capability 02 — Participation

### Epic 02 — Collaborative Analysis

Guide 03 of 7

Version 1.0

Status: Ready

---

# Purpose

Implement the internal REST API for Collaborative Analysis.

The API exposes the CollaborativeAnalysis aggregate through standard platform endpoints.

No UI, authentication, persistence, or intelligence integration is included.

---

# Scope

This guide includes:

- internal REST endpoints;
- request validation;
- standard response envelopes;
- routing;
- store integration.

This guide does not include:

- public projections;
- React components;
- authentication;
- authorization;
- Humanity Intelligence;
- Community Memory integration.

---

# Files to Create

## API

```
apps/api/src/modules/collaborative-analysis/
    collaborative-analysis.routes.ts
```

---

## API helpers

```
apps/web/src/features/collaborative-analysis/api.ts
```

---

## Exports

Update:

```
apps/api/src/modules/collaborative-analysis/index.ts
```

Register the routes in:

```
apps/api/src/app.ts
```

---

# REST Endpoints

Implement:

```
GET /api/v1/collaborative-analysis
```

Returns:

List of Collaborative Analysis aggregates.

---

```
GET /api/v1/collaborative-analysis/:analysisId
```

Returns:

Single Collaborative Analysis.

404 if not found.

---

```
GET /api/v1/initiatives/:initiativeId/analysis
```

Returns:

The analysis associated with an Initiative.

404 if no analysis exists.

---

```
POST /api/v1/collaborative-analysis
```

Creates a new Collaborative Analysis.

Bootstrap implementation only.

---

```
POST /api/v1/collaborative-analysis/:analysisId/contributions
```

Adds a new Contribution.

Existing Contributions are never modified.

---

```
POST /api/v1/collaborative-analysis/:analysisId/signals
```

Adds a new Signal.

Signals supplement analysis.

They do not represent votes.

---

```
PATCH /api/v1/collaborative-analysis/:analysisId
```

Allows updates only to mutable aggregate properties.

Immutable fields must be rejected.

---

# Standard Response Envelope

Every endpoint returns:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "links": {},
  "message": ""
}
```

Use the standard Humanity Union API envelope.

---

# Validation Rules

Reject updates to:

- analysisId
- initiativeId
- createdAt

Reject Contribution updates.

Reject Signal modifications.

Contribution history is immutable.

---

# Readiness

Readiness is returned by the API.

Readiness is never calculated by the API.

The API retrieves the value from the Store.

---

# Progress Policy

ProgressPolicy is returned as part of the aggregate.

The API does not evaluate policy.

---

# Analysis Summary

Return current Analysis Summary.

Do not generate summaries.

---

# Thin API Principle

The API:

- validates requests;
- calls Store operations;
- returns responses.

The API does not:

- implement business rules;
- calculate readiness;
- evaluate Progress Policy;
- invoke intelligence services.

---

# Error Handling

Return:

- 200
- 201
- 400
- 404

Use the standard platform error format.

---

# Engineering Principles

Implementation preserves:

- Domain First
- Thin API
- Domain Ownership
- Historical Integrity
- Progressive Bootstrap
- Human Leadership

---

# Verification

Confirm:

- routes compile;
- endpoints respond;
- response envelopes match platform standard;
- immutable Contribution rules remain enforced.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Completion Criteria

Guide 03 is complete when:

- all REST endpoints exist;
- routes are registered;
- API helpers compile;
- response envelopes are correct;
- typecheck passes.

Guide 04 must not be started.
