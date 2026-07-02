# IMPLEMENTATION_GUIDE_03_COLLECTIVE_DECISION_API

## Capability 02 — Participation

### Epic 03 — Community Poll

Guide 03 of 7

Version 2.0

Status: Ready

---

# Purpose

Implement the REST API for the Collective Decision Framework.

The API exposes the CollectiveDecision Aggregate while preserving Thin API principles.

Community Poll is supported as Version 1 through configuration.

---

# Scope

This guide includes:

- REST endpoints;
- request validation;
- response mapping;
- public route registration;
- domain action endpoints.

This guide does not include:

- authentication;
- authorization;
- persistence;
- notifications;
- Workspace.

---

# Files to Create

```
apps/api/src/modules/collective-decision/

collective-decision.routes.ts

collective-decision.controller.ts

collective-decision.mapper.ts

collective-decision.validators.ts

index.ts
```

Update:

```
apps/api/src/app.ts
```

---

# REST Endpoints

## Standard Aggregate

```
GET

/api/v1/collective-decisions
```

Returns all decisions.

---

```
GET

/api/v1/collective-decisions/:decisionId
```

Returns one decision.

---

```
POST

/api/v1/collective-decisions
```

Creates a decision.

Version 1:

Decision Subject

Initiative

Decision Template

Community Poll

---

```
PATCH

/api/v1/collective-decisions/:decisionId
```

Updates editable fields only.

Immutable fields remain protected.

---

# Domain Actions

Participant Decision

```
POST

/api/v1/collective-decisions/:decisionId/participant-decisions
```

Registers one ParticipantDecision.

---

Calculate Result

```
POST

/api/v1/collective-decisions/:decisionId/calculate-result
```

Derives DecisionResult.

---

Determine Outcome

```
POST

/api/v1/collective-decisions/:decisionId/determine-outcome
```

Derives Outcome.

---

Lifecycle

```
POST

/api/v1/collective-decisions/:decisionId/schedule
```

```
POST

/api/v1/collective-decisions/:decisionId/open
```

```
POST

/api/v1/collective-decisions/:decisionId/close
```

```
POST

/api/v1/collective-decisions/:decisionId/complete
```

```
POST

/api/v1/collective-decisions/:decisionId/archive
```

```
POST

/api/v1/collective-decisions/:decisionId/cancel
```

Each endpoint performs one lifecycle transition.

---

# Response Envelope

Every endpoint returns:

```
{
  success,
  data,
  meta,
  links,
  message
}
```

Platform standard.

---

# Validation

Validate:

- identifiers;
- required fields;
- lifecycle transitions;
- immutable fields;
- participant uniqueness.

Validation occurs before Store execution.

---

# Controller

Controller responsibilities:

- receive request;
- validate request;
- invoke Store;
- map response.

Business rules remain outside the controller.

---

# Mapper

Map:

Store

↓

API Response

Never expose internal implementation details.

---

# Thin API Principle

The API:

accepts requests;

validates requests;

invokes Store;

returns responses.

The API never:

calculates DecisionResult;

determines Outcome;

implements business rules.

---

# Version 1 Scope

Decision Subject

```
Initiative
```

Decision Template

```
CommunityPoll
```

Decision Options

```
Approve

Reject
```

---

# Engineering Principles

Preserve:

- Thin API;
- Domain First;
- Explicit Publicity;
- Human Leadership;
- Progressive Bootstrap;
- Historical Integrity.

---

# Verification

Confirm:

- endpoints respond;
- validation works;
- lifecycle endpoints invoke Store;
- response envelope matches platform standard.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Completion Criteria

Guide 03 is complete when:

- routes compile;
- controller compiles;
- mapper compiles;
- validators compile;
- endpoints respond correctly;
- typecheck passes.

Guide 04 must not be started.
