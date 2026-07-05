# IMPLEMENTATION_GUIDE_04_API

## Capability 02 — Participation

### Epic 04 — Petition

Guide 04 of 7

Version: 1.0

Status: Draft

---

# Purpose

Define the REST API implementation for the Petition Aggregate.

This guide explains how the API exposes Petition commands and read models without leaking internal implementation details.

It references:

- `DOMAIN_MODEL.md`
- `IMPLEMENTATION_GUIDE_02_BEHAVIOR.md`
- `IMPLEMENTATION_GUIDE_03_STORE.md`
- `PUBLIC_PROJECTION.md`

Platform standards:

- `project/architecture/core/API_DESIGN_GUIDELINES.md`

This guide does not redefine architecture.

It does not discuss frontend implementation.

---

# Prerequisites

Guide 01 domain types must exist.

Guide 02 behavior must be accepted as command specification.

Guide 03 store must support aggregate persistence and retrieval.

Guide 04 must not begin until Guide 03 is complete.

---

# Scope

This guide includes:

- API philosophy;
- aggregate boundaries;
- command endpoints;
- query endpoints;
- public endpoints;
- workspace endpoint expectations;
- DTO responsibilities;
- validation responsibilities;
- error response philosophy;
- HTTP expectations;
- read model expectations;
- versioning expectations;
- verification checklist.

This guide does not include:

- React workspace UI;
- public web page composition;
- authentication implementation;
- Registration Gateway UI;
- Participation Navigator service;
- database adapter design.

---

# Deliverables

Create module API layer:

```
apps/api/src/modules/petition/
```

Expected files:

```
petition.routes.ts
petition.controller.ts
petition.mapper.ts
petition.validators.ts
public-petition.projection.ts
public-petition.routes.ts
index.ts
```

Update:

```
apps/api/src/app.ts
```

Register:

- operational router under `/api/v1/petitions`
- public router under `/api/v1/public/petitions`

---

# API Philosophy

The Petition API exposes civic domain intent.

It coordinates client requests with aggregate persistence and behavior.

It does not become a second domain model.

## Thin API Principle

Every endpoint performs only:

1. receive the request;
2. validate request structure and identifiers;
3. invoke the application layer backed by Guide 02 behavior and Guide 03 store;
4. map the result to API DTOs;
5. return the platform response envelope.

The API must never:

- embed business policy beyond request validation;
- mutate Initiative, Collaborative Analysis or Collective Decision;
- expose raw store internals;
- merge operational and public representations into one endpoint;
- calculate derived values independently of the aggregate persistence layer;
- leak storage structure, helper names or internal module details.

## Explicit Publicity

Operational API serves participation.

Public API serves transparency.

The two surfaces remain separate by design.

---

# Aggregate Boundaries

The API exposes one Aggregate resource:

```
/petitions
```

The API may expose references to external aggregates only as:

- identifiers;
- approved summary context in DTOs;
- integration lookup routes.

The API must never expose endpoints that modify:

- `/initiatives`
- `/collaborative-analysis`
- `/collective-decisions`

through Petition routes.

Petition API responses may include read-only referenced context required for informed participation or public transparency.

Referenced context is not owned by Petition.

---

# Operational API

Base path:

```
/api/v1/petitions
```

Operational endpoints support registered participation, stewardship and platform integration.

They may include participant-specific read data when caller context permits.

They must not expose other participants' private operational details beyond platform rules.

---

# Command Endpoints

Business actions are explicit POST commands.

Commands map to Guide 02 behavior.

## Lifecycle Commands

```
POST /api/v1/petitions/:petitionId/prepare
POST /api/v1/petitions/:petitionId/publish
POST /api/v1/petitions/:petitionId/open
POST /api/v1/petitions/:petitionId/close
POST /api/v1/petitions/:petitionId/archive
```

| Endpoint  | Behavior Command  | Effect              |
| --------- | ----------------- | ------------------- |
| `prepare` | `PreparePetition` | `Draft → Ready`     |
| `publish` | `PublishPetition` | `Ready → Published` |
| `open`    | `OpenPetition`    | `Published → Open`  |
| `close`   | `ClosePetition`   | `Open → Closed`     |
| `archive` | `ArchivePetition` | `Closed → Archived` |

Each lifecycle endpoint performs one transition only.

## Signature Command

```
POST /api/v1/petitions/:petitionId/signatures
```

Maps to `SignPetition`.

Request identifies authenticated participant context supplied by upper layers.

Response returns operational Signature confirmation and updated aggregate read model fields required by clients.

Duplicate sign attempts must fail deterministically.

## Resource Creation Command

```
POST /api/v1/petitions
```

Maps to `CreatePetition`.

Creates a Petition in `Draft`.

Requires approved Collective Decision reference and Petition subject/policy inputs.

## Preparatory Update

```
PATCH /api/v1/petitions/:petitionId
```

Updates editable preparatory fields only.

Permitted only while lifecycle is `Draft` or `Ready`.

Reject mutation of:

- Signatures;
- derived SupportMetrics;
- derived PetitionOutcome;
- immutable subject or policy fields after publication;
- archived aggregates.

PATCH is not a substitute for lifecycle commands.

---

# Query Endpoints

## Standard Queries

```
GET /api/v1/petitions
GET /api/v1/petitions/:petitionId
```

Return operational Petition DTOs.

List endpoint returns summary-capable operational representations.

Detail endpoint returns full operational read model for one Petition.

## Integration Queries

```
GET /api/v1/petitions/by-collective-decision/:collectiveDecisionId
GET /api/v1/petitions/by-initiative/:initiativeId
```

Support platform integration and cross-stage navigation.

Return one operational Petition DTO or not found.

Do not expose multiple ambiguous matches without explicit policy.

## Participant Query Expectations

Operational detail responses may include:

- whether the current participant has signed;
- participant-specific eligibility summary;
- current lifecycle state;
- derived SupportMetrics;
- derived PetitionOutcome;
- ShareLink when active.

Operational detail responses must not expose Version 1 public anonymity rules incorrectly across audiences.

Participant-specific fields belong to operational API only.

---

# Public Endpoints

Base path:

```
/api/v1/public/petitions
```

## Public Query

```
GET /api/v1/public/petitions/:petitionId
```

Returns Public Petition Projection DTO only.

Public endpoint rules:

- no authentication required for read;
- read-only;
- aggregate public statistics only;
- no individual signer identity in Version 1;
- no participant workspace state;
- no internal policy mechanics beyond public eligibility summary;
- no operational mutation endpoints under `/public/`.

Public route uses projection builder aligned with `PUBLIC_PROJECTION.md`.

It must not serialize the operational aggregate directly.

## Public Visibility by Lifecycle

Public route behavior follows lifecycle visibility rules from `PUBLIC_PROJECTION.md`:

- available from `Published` onward;
- share reference active when public visibility applies;
- signing guidance appears according to lifecycle state;
- closed and archived petitions remain publicly understandable;
- draft and ready petitions are not public unless explicit future policy says otherwise.

Version 1 default:

- `Draft` and `Ready` return not found or not public on public route.

---

# Workspace Endpoints

The Petition Workspace consumes the Operational API.

Guide 04 does not define frontend components.

It defines the API surface the workspace relies on.

## Primary Workspace Reads

Workspace depends on:

```
GET /api/v1/petitions/:petitionId
```

Optional integration reads:

```
GET /api/v1/petitions/by-collective-decision/:collectiveDecisionId
GET /api/v1/petitions/by-initiative/:initiativeId
```

Workspace may also consume read-only referenced context from other aggregates through their existing APIs.

Petition API must not embed full external aggregate graphs.

## Primary Workspace Commands

Workspace depends on:

```
POST /api/v1/petitions/:petitionId/signatures
```

Stewardship or platform operations may additionally use lifecycle command endpoints where authorized.

## Workspace DTO Expectations

Operational detail DTO should expose enough data for workspace sections defined in `WORKSPACE_SPECIFICATION.md`:

- lifecycle state;
- Petition Subject;
- decision context references or approved summaries;
- SupportMetrics;
- PetitionOutcome;
- ShareLink when active;
- participant signed status for current caller;
- eligibility summary for signing.

Workspace DTO must not expose:

- raw Signature collections of other participants in ways that violate privacy defaults;
- internal store metadata;
- Registration Gateway implementation details;
- Participation Navigator internals.

No separate `/workspace/petitions` route is required in Version 1 if operational DTO satisfies workspace needs.

If a future dedicated workspace read endpoint is introduced, it must remain operational, not public, and must not bypass aggregate boundaries.

---

# DTO Responsibilities

DTOs stabilize API contracts.

They are not aggregate roots.

## Operational Petition DTO

Used by:

- list and detail queries;
- command responses;
- workspace consumers;
- integration consumers.

May include:

- petition id;
- collective decision reference;
- initiative reference;
- lifecycle state;
- subject snapshot;
- policy public summary where operationally required;
- share link when active;
- support metrics;
- petition outcome;
- participant signed flag for current caller;
- timestamps.

Must exclude:

- internal persistence details;
- store helper artifacts;
- unnecessary private policy internals;
- other participants' identity details beyond approved operational rules.

## Public Petition Projection DTO

Used only by public endpoint.

Built from aggregate state through projection builder.

Must conform to `PUBLIC_PROJECTION.md`.

Includes:

- petition identity;
- petition summary;
- public lifecycle meaning;
- subject snapshot;
- approved decision context in public terms;
- aggregate support statistics;
- petition outcome when available;
- share reference;
- participation entry guidance.

Must exclude:

- participant-specific signed state for anonymous visitors;
- operational controls;
- internal aggregate serialization.

## Command Request DTOs

Command requests carry only required input.

Examples:

- create petition request;
- preparatory patch request;
- sign petition request metadata allowed by Version 1.

Requests must not include derived fields such as SupportMetrics or PetitionOutcome as writable input.

## Command Response DTOs

Command responses return:

- updated operational Petition DTO or focused command result;
- stable success message;
- no internal exception traces.

Signature command response confirms recorded endorsement without moral evaluation language in API messages.

---

# Validation Responsibilities

Validation occurs before store invocation.

## API Validates

- route identifiers;
- JSON structure;
- required fields;
- field types;
- immutable field protection on PATCH;
- unsupported fields on command requests;
- obvious lifecycle misuse at request-shape level when detectable.

## API Does Not Redefine

- aggregate business rules from Guide 02;
- persistence rules from Guide 03;
- external aggregate ownership;
- public privacy policy from `PUBLIC_PROJECTION.md`.

Store or aggregate rejection still occurs after API validation passes.

API maps those failures to HTTP errors without leaking internals.

## Command-Specific Validation

| Command | API validation focus                         |
| ------- | -------------------------------------------- |
| Create  | required references and subject/policy shape |
| Patch   | editable fields only in preparatory states   |
| Prepare | petition id and request shape                |
| Publish | petition id                                  |
| Open    | petition id                                  |
| Sign    | petition id and participant context presence |
| Close   | petition id                                  |
| Archive | petition id                                  |

Business eligibility such as Approved Collective Decision Outcome is enforced by aggregate behavior and persistence layer, not duplicated as API policy logic.

---

# Error Response Philosophy

Errors must be:

- explicit;
- deterministic;
- consistent with platform envelope;
- safe for clients;
- free of internal implementation detail.

Use standard response envelope for success and failure.

Failure envelope:

```
success: false
data: null
message: human-readable summary
```

Do not expose:

- stack traces in normal responses;
- storage keys;
- internal helper names;
- raw store error objects.

## Expected Client-Visible Failures

| Condition                       | HTTP expectation                        |
| ------------------------------- | --------------------------------------- |
| resource not found              | 404                                     |
| invalid request shape           | 400                                     |
| invalid lifecycle command       | 400 or 409 based on platform convention |
| duplicate signature             | 409                                     |
| archived mutation attempt       | 409                                     |
| not public yet on public route  | 404                                     |
| unauthorized operational action | 401 or 403 when auth exists later       |

Message examples should use civic domain language:

- "Petition not found."
- "Petition is not open for signing."
- "Participant has already signed this Petition."
- "Public Petition not available."

Avoid vote, ballot or poll terminology.

---

# HTTP Expectations

Follow platform REST conventions.

## Methods

- `GET` for queries;
- `POST` for create and commands;
- `PATCH` for preparatory editable updates only;
- no public write methods in Version 1;
- no delete endpoint.

## Status Codes

- `200 OK` for successful reads and commands;
- `201 Created` for create petition if platform convention uses created status;
- `400 Bad Request` for invalid input;
- `404 Not Found` for missing resources or non-public resources on public route;
- `409 Conflict` for duplicate sign or invalid state conflicts;
- `500` only for unexpected server failure without internal detail exposure.

## Response Envelope

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

## Links

`links` may include stable resource references such as:

- self;
- public projection;
- related initiative public record;
- related collective decision public record.

Links support navigation.

They do not mutate external aggregates.

---

# Read Model Expectations

The API exposes read models, not raw aggregate storage graphs.

## Operational Read Model

Source:

- store load result;
- mapper transformation.

Purpose:

- support participation;
- support workspace;
- support integration.

Includes derived SupportMetrics and PetitionOutcome already computed by persistence layer.

## Public Read Model

Source:

- projection builder over aggregate state;
- approved referenced context summaries where required.

Purpose:

- support public observation, sharing and informed registration entry.

Never becomes source of truth.

If aggregate and projection differ, aggregate persistence remains authoritative.

Projection builder refresh follows aggregate changes.

---

# Versioning Expectations

All routes use:

```
/api/v1/
```

Version 1 assumptions:

- Initiative subject type;
- one Signature model;
- public anonymity default for individual signer identity;
- lifecycle command set from Guide 02;
- separate operational and public surfaces.

Breaking changes require `/api/v2/`.

Non-breaking additions may extend DTOs carefully without changing existing semantics.

Do not version individual Petition resources independently of platform API version.

---

# Mapping Responsibilities

Mapper transforms:

```
Store Aggregate Snapshot
↓
Operational DTO
```

Public mapper transforms:

```
Store Aggregate Snapshot
↓
Public Petition Projection DTO
```

Mapping rules:

- never return store object references directly;
- hide fields not approved for the target audience;
- translate lifecycle state to audience-appropriate labels when needed;
- preserve derived values as read-only fields;
- do not compute business outcomes independently unless projection builder explicitly defines presentation-only derivation.

Controllers call mappers.

Routes call controllers.

No mapping logic in routes.

---

# Controller Responsibilities

Controller performs orchestration only:

- parse request;
- call validators;
- invoke store or behavior-backed application operations;
- map result;
- set HTTP status;
- return envelope.

Controller must not:

- implement business rules;
- mutate external modules;
- compose public and operational DTOs into one response;
- bypass validators;
- expose raw errors.

---

# Separation Summary

| Surface         | Path                       | Audience                            | Writable |
| --------------- | -------------------------- | ----------------------------------- | -------- |
| Operational API | `/api/v1/petitions`        | participants, stewards, integration | yes      |
| Public API      | `/api/v1/public/petitions` | observers, society                  | no       |

Operational API exposes participation.

Public API exposes transparency.

Workspace consumes operational API.

Public pages consume public API.

---

# Engineering Principles

Preserve:

- Thin API;
- Domain First;
- Explicit Publicity;
- Human Leadership;
- Historical Integrity;
- Derived State;
- Aggregate Independence.

Petition API must preserve:

- decision before support;
- registration before signing at experience boundary;
- immutable Signature semantics;
- aggregate-only public statistics in Version 1.

---

# Verification

Confirm:

- routes register in `app.ts`;
- operational and public routers are separate;
- command endpoints map to Guide 02 behavior;
- queries return mapped DTOs, not raw store objects;
- PATCH rejects immutable and archived mutations;
- sign endpoint rejects duplicate signatures;
- public endpoint hides participant-private data;
- draft and ready petitions are not publicly exposed in Version 1 default;
- response envelope matches platform standard;
- no external aggregate mutation occurs through Petition routes.

Run:

```
pnpm typecheck
```

Expected:

PASS

Manual endpoint checks may be added during implementation but are not required in this guide.

---

# Verification Checklist

Guide 04 is complete when all items below are satisfied.

## Prerequisites

- [ ] Guide 03 store complete
- [ ] API module files created
- [ ] routes registered under `/api/v1/petitions` and `/api/v1/public/petitions`

## Philosophy and Boundaries

- [ ] Thin API principle applied
- [ ] operational and public APIs separated
- [ ] no external aggregate mutation through Petition routes
- [ ] no internal store details exposed

## Command Endpoints

- [ ] `POST /petitions` creates Draft petition
- [ ] `PATCH /petitions/:id` limited to preparatory states
- [ ] lifecycle command endpoints implemented
- [ ] `POST /petitions/:id/signatures` implemented
- [ ] one command equals one business action

## Query Endpoints

- [ ] list and detail operational queries implemented
- [ ] integration lookup by collective decision implemented
- [ ] integration lookup by initiative implemented

## Public Endpoints

- [ ] public GET endpoint implemented
- [ ] public DTO conforms to `PUBLIC_PROJECTION.md`
- [ ] public route is read-only
- [ ] Version 1 signer identity privacy preserved

## DTOs and Mapping

- [ ] operational DTO defined
- [ ] public projection DTO defined
- [ ] mapper separates audiences correctly
- [ ] derived fields are read-only in API contracts

## Validation and Errors

- [ ] request validation occurs before store invocation
- [ ] deterministic error messages used
- [ ] expected HTTP statuses applied
- [ ] platform response envelope used

## Workspace Support

- [ ] operational detail DTO supports workspace read needs
- [ ] signature command supports workspace action needs
- [ ] no frontend implementation included in this guide

## Quality Gate

- [ ] `pnpm typecheck` passes
- [ ] Guide 05 not started until checklist complete

---

# Out of Scope

Deferred to later guides:

| Guide                                 | Responsibility                                          |
| ------------------------------------- | ------------------------------------------------------- |
| Guide 05 — Petition Workspace         | operational UI consuming API                            |
| Guide 06 — Public Petition Projection | public page and projection refinement if split from API |
| Guide 07 — Platform Integration       | cross-aggregate bootstrap and eligibility wiring        |
| Epic architecture review              | final verification                                      |

Adjust numbering if `IMPLEMENTATION_PLAN.md` is updated separately.

---

# Final Principle

The Petition API exists to expose civic endorsement clearly and safely.

Operational endpoints support accountable participation.

Public endpoints support societal transparency.

Neither surface should reveal how the aggregate is stored.

Both surfaces should reveal what the civic process means.

API implementation succeeds when clients can participate and observe responsibly without depending on internal platform structure.
