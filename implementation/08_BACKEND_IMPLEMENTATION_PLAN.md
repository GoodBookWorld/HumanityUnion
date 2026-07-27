# Humanity Union Backend Implementation Plan
## Version 2.0
### Blueprint v2.0 Aligned

---

# Document Status

| Property | Value |
|----------|-------|
| Document | Backend Implementation Plan |
| Version | 2.0 |
| Status | Normative Implementation Plan |
| Scope | Backend implementation of the Humanity Union MVP Civic Platform |
| Audience | Backend developers, software architects, technical leads, contributors, reviewers, AI-assisted development tools (Cursor) |
| Authority | Implementation execution only |
| Depends on | Humanity Union Constitution v2.0, Blueprint v2.0, Engineering Standards v2.0, Member Journey Specification v2.0, Module Specifications 01–07, Architecture Decision Records (ADR) |
| Supersedes | Backend Implementation Plan v1.0 |

---

# Architectural Authority

This document governs **backend implementation execution**.

Its purpose is to translate the approved Humanity Union architecture into an executable development roadmap for the existing repository.

This document SHALL:

- assess the current repository,
- identify implementation gaps,
- define implementation order,
- define backend module delivery,
- define infrastructure requirements,
- define implementation milestones,
- define testing requirements,
- define migration strategy,
- define implementation governance.

This document SHALL NOT:

- redefine platform architecture;
- redefine bounded contexts;
- redefine aggregates;
- redefine Member Journey;
- redefine domain terminology;
- introduce new Catalogue Events;
- replace Module Specifications;
- replace Engineering Standards;
- replace Architecture Decision Records (ADR).

Architectural authority remains with:

1. Humanity Union Constitution
2. Humanity Union Blueprint
3. Engineering Standards
4. Architecture Decision Records
5. Module Specifications

This document implements those authorities.

---

# Document Position

```text
Humanity Union Constitution
            │
            ▼
Humanity Union Blueprint
            │
            ▼
Engineering Standards
            │
            ▼
Architecture Decision Records (ADR)
            │
            ▼
Module Specifications (01–07)
            │
            ▼
Member Journey Specification
            │
            ▼
Backend Implementation Plan
            │
            ▼
Repository
            │
            ▼
Source Code
```

The Backend Implementation Plan defines **how** the approved architecture is implemented inside the existing backend repository.

---

# Purpose

The Humanity Union backend already provides a functional operational foundation, including Express, MongoDB authentication, Docker deployment, configuration management, and health monitoring.

However, repository inspection confirms that the current implementation does **not** yet implement the normative MVP Civic Chain defined by Blueprint v2.0.

This implementation plan provides the authoritative roadmap for transforming the existing repository into a fully compliant backend without unnecessary architectural redesign.

The implementation strategy follows five principles:

1. **Architecture-first**
   - Implementation follows approved architecture without modification.

2. **Repository evolution**
   - Existing infrastructure is extended rather than replaced whenever practical.

3. **Activity-first implementation**
   - The normative civic lifecycle is anchored on the Activity aggregate.

4. **Incremental migration**
   - Legacy Initiative-based functionality remains operational until equivalent Activity-first implementation is complete.

5. **Vertical Slice Delivery**
   - Every implementation increment delivers a complete, testable feature spanning API, domain, persistence, events, projections, authorization, and testing.

---

# Objectives

This implementation plan defines:

- repository assessment;
- implementation priorities;
- backend module delivery;
- source structure;
- bounded-context implementation;
- database architecture;
- event infrastructure;
- API implementation;
- authorization model;
- projection implementation;
- testing strategy;
- deployment pipeline;
- migration strategy;
- implementation governance;
- execution roadmap.

---

# Implementation Principles

The implementation strategy is governed by the following principles:

- Blueprint-first implementation.
- Engineering Standards compliance.
- Module Specification compliance.
- Activity-first civic lifecycle.
- Event-driven integration.
- Modular monolith architecture.
- CQRS separation.
- Transactional Outbox.
- Projection-driven user experience.
- Incremental repository modernization.
- Specification-first development.
- Automated validation.
- Continuous architectural traceability.

---

# Repository Assessment Methodology

Repository assessment follows four classifications.

| Classification | Meaning |
|---------------|---------|
| **PRESENT** | Repository implementation fully satisfies the current specification. |
| **PARTIAL** | Repository contains reusable implementation requiring alignment with Version 2.0 architecture. |
| **MISSING** | Required implementation does not yet exist. |
| **DEPRECATED** | Legacy implementation remains temporarily supported but is no longer authoritative for the MVP Civic Chain. |

These classifications determine implementation priorities throughout this document.

---

# Section 1 — Purpose and Implementation Target

## Primary Goal

Transform the existing Humanity Union backend repository into a Blueprint v2.0 compliant implementation while preserving operational stability and minimizing unnecessary rewrites.

Implementation shall prioritize:

- reuse over replacement;
- migration over deletion;
- incremental modernization over large-scale refactoring.

The backend implementation target is the complete execution of the normative MVP Civic Lifecycle:

```text
MemberRegistered
        │
        ▼
ActivityCreated
        │
        ▼
DiscussionOpened
        │
        ▼
EvidenceContributed
        │
        ▼
ProposalSubmitted
        │
        ▼
DecisionApproved
        │
        ▼
ImplementationStarted
        │
        ▼
ImplementationCompleted
        │
        ▼
ImpactRecorded
```

Every stage must be supported by:

- authoritative aggregates,
- Catalogue Events,
- transactional persistence,
- CQRS projections,
- authorization,
- testing,
- operational observability.

Successful completion of this implementation plan results in a backend capable of executing the complete Humanity Union MVP Civic Chain exactly as defined by the approved specifications.

---

# Section 2 — Current Repository Assessment

Repository inspection confirms that the existing backend provides a strong operational foundation but only partial alignment with Blueprint v2.0.

The assessment below distinguishes reusable infrastructure from implementation gaps requiring development.

## Existing Repository Foundation

| Area | Status | Notes |
|------|--------|------|
| Express application | **PRESENT** | Existing application entry point retained |
| TypeScript monorepo | **PRESENT** | Current workspace structure retained |
| MongoDB integration | **PRESENT** | Primary persistence layer |
| Docker deployment | **PRESENT** | Existing deployment model retained |
| Authentication | **PRESENT** | Requires event integration |
| Health endpoint | **PRESENT** | Extend for operational readiness |
| Environment configuration | **PRESENT** | Existing configuration retained |
| JWT authentication | **PRESENT** | Extend with Actor Context |
| Email verification | **PRESENT** | Integrate with Member lifecycle |
| Repository layout | **PRESENT** | Incremental modernization |

## Existing Infrastructure Suitable for Reuse

The following infrastructure remains authoritative and should be extended rather than replaced:

- Express application bootstrap
- MongoDB configuration
- Docker deployment
- Environment loading
- Authentication framework
- HTTP middleware
- Health endpoint
- Repository configuration
- Existing package structure

These components provide the operational foundation for implementing the normative backend defined throughout the remainder of this document.

## Repository Entry Points

| Component | Status | Implementation Notes |
|----------|--------|----------------------|
| API bootstrap (`index.ts`) | **PRESENT** | Retain existing startup sequence; extend with dispatcher initialization |
| Express application (`app.ts`) | **PRESENT** | Continue as the single HTTP entry point |
| Configuration system | **PRESENT** | Extend only where required by new infrastructure |
| MongoDB connection | **PRESENT** | Primary persistence mechanism for all normative aggregates |
| Authentication module | **PRESENT** | Extend to publish Catalogue Events |
| Health endpoint | **PRESENT** | Expand to include operational readiness checks |
| Docker deployment | **PRESENT** | Continue using existing deployment strategy |
| Shared utilities | **PARTIAL** | Expand with implementation-specific infrastructure only |

---

## Normative MVP Targets

The following bounded contexts are required by Blueprint v2.0 and Module Specifications but are not yet implemented in the repository.

| Target Module | Governing Specification | Repository Status |
|---------------|-------------------------|-------------------|
| Activity | Module 02 | **MISSING** |
| Discussion | Module 03 | **MISSING** |
| Proposal | Module 04 | **MISSING** |
| Decision | Module 05 | **MISSING** |
| Implementation | Module 06 | **MISSING** |
| ImpactAssessment | Module 07 | **MISSING** |
| Workspace Projection | Module 01 | **PARTIAL** |
| Inbox Projection | Module 01 | **MISSING** |
| Civic Audit | Engineering Standards | **MISSING** |

These modules constitute the normative MVP Civic Chain and shall be implemented before any post-MVP capabilities.

---

## Existing Legacy Capability

Repository inspection identified a significant amount of Initiative-oriented functionality originating from earlier platform iterations.

This implementation remains operational but is **no longer architecturally authoritative** for Blueprint v2.0.

### Legacy Modules

| Legacy Module | Status | Migration Strategy |
|--------------|--------|-------------------|
| initiatives | PRESENT | Preserve during migration |
| initiative-collaborative-analysis | PRESENT | Replace with Discussion context |
| initiative-improvement-proposal | PRESENT | Replace with Proposal context |
| decision-session | PRESENT | Replace with Decision context |
| initiative-collective-decision | PRESENT | Replace with Decision aggregate |
| initiative-decision-vote | PRESENT | Replace with Decision policies |
| initiative-implementation-commitment | PRESENT | Replace with Implementation aggregate |
| initiative-implementation-tracking | PRESENT | Replace with Implementation context |
| initiative-public-impact | PRESENT | Replace with ImpactAssessment |
| public-civic-archive | PRESENT | Replace with Audit projections |
| capability02-integration | PRESENT | Remove after migration completion |

---

## Legacy Migration Principles

Legacy implementation SHALL:

- remain deployable during migration;
- remain isolated from normative MVP development;
- never receive new civic functionality;
- never become the authoritative implementation of Blueprint v2.0.

Migration SHALL occur by introducing new bounded contexts rather than modifying legacy Initiative architecture.

Deletion of legacy code is **not** part of MVP implementation.

---

## Existing Supporting Infrastructure

The following repository components remain valuable and shall be incrementally aligned with Version 2.0.

| Module | Status | Planned Evolution |
|--------|--------|-------------------|
| auth | PRESENT | Extend with Identity events |
| member | PARTIAL | Replace in-memory persistence with normative repository |
| member-profile | PRESENT | Align with Member aggregate |
| email | PRESENT | Reuse |
| notifications | PRESENT | Align with Catalogue Events |
| global-search | PRESENT | Activity-first redesign after MVP |
| beta-invite | PRESENT | Reuse |
| closed-beta | PRESENT | Reuse |
| preferences | PRESENT | Extend as required |
| participation-area | PRESENT | Integrate with Responsibility Profile |

---

# Architectural Inconsistencies

Repository inspection identified several architectural inconsistencies preventing compliance with Blueprint v2.0.

These inconsistencies define the implementation priority for repository modernization.

| ID | Issue | Impact | Priority |
|----|-------|---------|----------|
| C1 | Initiative-centric domain model | Prevents Activity-first architecture | **BLOCKING** |
| C2 | Missing Domain Event infrastructure | Prevents event-driven integration | **BLOCKING** |
| C3 | Dual Member persistence | Causes inconsistent Member state | **HIGH** |
| C4 | Missing Catalogue Event names | Prevents specification compliance | **BLOCKING** |
| C5 | Legacy Decision implementation | Conflicts with normative Decision context | **HIGH** |
| C6 | Missing normative aggregate types | Prevents implementation consistency | **HIGH** |
| C7 | Missing automated backend tests | Slows safe implementation | **MEDIUM** |
| C8 | Missing CI pipeline | Reduces delivery confidence | **MEDIUM** |
| C9 | Legacy FairBalance model | Not compatible with ImpactAssessment | **LOW** |

---

## Repository Modernization Strategy

Repository modernization follows the principle:

> **Build new. Migrate gradually. Retire safely.**

Implementation SHALL:

1. Preserve repository stability.
2. Build new normative bounded contexts.
3. Reuse existing infrastructure wherever practical.
4. Avoid large-scale repository rewrites.
5. Isolate legacy functionality.
6. Replace legacy UX incrementally.
7. Remove legacy components only after complete feature replacement.

This strategy minimizes migration risk while maintaining continuous repository operability.

---

# Section 3 — Backend Technology Baseline

The Humanity Union backend intentionally adopts a conservative technology stack.

The objective is to maximize long-term maintainability, simplify contributor onboarding, and minimize operational complexity while supporting the complete MVP Civic Lifecycle.

## Core Runtime

| Technology | Purpose | Repository Status | Implementation Strategy |
|------------|---------|-------------------|-------------------------|
| Node.js (LTS) | Backend runtime | **PRESENT** | Retain |
| TypeScript | Type-safe implementation | **PRESENT** | Retain |
| pnpm | Monorepo package management | **PRESENT** | Retain |
| Express | HTTP API | **PRESENT** | Extend |
| MongoDB Atlas | Primary persistence | **PRESENT** | Extend |
| MongoDB Driver | Database access | **PRESENT** | Retain |
| REST API | Client interface | **PRESENT** | Extend `/api/v1/*` |
| JWT Authentication | Session management | **PRESENT** | Extend with Identity events |
| bcrypt | Password security | **PRESENT** | Retain |
| Helmet | HTTP protection | **PRESENT** | Retain |
| CORS | Cross-origin security | **PRESENT** | Retain |
| dotenv | Environment loading | **PRESENT** | Retain |

---

## Infrastructure Additions

The following infrastructure is required before implementing the normative Civic Chain.

| Infrastructure | Status | Purpose |
|---------------|--------|---------|
| Domain Events | **MISSING** | Cross-context communication |
| Transactional Outbox | **MISSING** | Reliable event publication |
| Event Dispatcher | **MISSING** | Internal event distribution |
| CQRS Projections | **PARTIAL** | Read model generation |
| Structured Logging | **MISSING** | Operational diagnostics |
| Automated Tests | **MISSING** | Continuous validation |
| Validation Framework | **IMPLEMENTATION CONFIGURATION** | API and domain validation |

---

## Technology Governance

Technology decisions are intentionally conservative.

During MVP implementation the following principles apply:

- no microservices;
- no distributed messaging platform;
- no unnecessary frameworks;
- no replacement of proven infrastructure;
- no technology introduced without architectural justification.

Technology additions affecting architecture SHALL be approved through an Architecture Decision Record (ADR).

Implementation-specific libraries (logging, validation, testing) may be selected as implementation configuration provided they do not alter architectural principles.

---

## Technology Evolution Policy

The backend evolves according to the following hierarchy:

```text
Architecture
        ↓
Engineering Standards
        ↓
Implementation Plan
        ↓
Technology Selection
        ↓
Source Code
```

Technology serves architecture.

Architecture never changes to justify a technology choice.

# Section 4 — Implementation Principles

Backend implementation SHALL follow the architectural principles defined by Blueprint v2.0, Engineering Standards v2.0, Architecture Decision Records (ADR), and the Module Specifications.

These principles are mandatory for every backend module, command handler, event publisher, repository implementation, projection, and API endpoint.

Deviation from these principles requires either:

- an approved ADR, or
- an explicit Implementation Configuration documented within this plan.

---

## Core Implementation Principles

### 1. Architecture Before Code

Implementation SHALL follow approved architecture.

Implementation SHALL NOT redesign architecture during development.

Blueprint and Engineering Standards remain the authoritative source of architectural decisions.

---

### 2. Activity-First Civic Lifecycle

The normative civic lifecycle SHALL always be anchored by the Activity aggregate.

No new implementation may introduce an alternative civic anchor.

All downstream bounded contexts reference Activity through approved aggregate relationships.

---

### 3. Bounded Context Ownership

Every aggregate belongs to exactly one bounded context.

Only the owning bounded context may:

- create,
- modify,
- validate,
- publish lifecycle events,
- enforce aggregate invariants.

Cross-context mutation is prohibited.

---

### 4. Aggregate Ownership

Each command targets one aggregate.

One command SHALL modify one aggregate only.

Cross-aggregate workflows SHALL be coordinated through Catalogue Events.

---

### 5. Specification-First Development

Implementation begins from approved specifications.

The implementation order is always:

```text
Specification
        ↓
Aggregate
        ↓
Commands
        ↓
Repository
        ↓
REST API
        ↓
Events
        ↓
Projection
        ↓
Tests
```

Source code SHALL never become the primary specification.

---

### 6. Exact Catalogue Events

Only approved Catalogue Event names may be published.

Deprecated aliases are prohibited.

Example:

✔ ActivityCreated

✔ ProposalSubmitted

✔ DecisionApproved

✘ ProposalAccepted

✘ VoteFinished

✘ EvidenceSubmitted

Event naming SHALL remain identical across:

- Module Specifications
- Source code
- Tests
- Documentation

---

### 7. Event-Driven Integration

Bounded contexts communicate exclusively through:

- Catalogue Events,
- approved commands,
- projection updates.

Direct repository access across bounded contexts is prohibited.

---

### 8. Transactional Outbox

Every published Catalogue Event SHALL first be written into the Transactional Outbox.

Publication occurs only after successful aggregate persistence.

The Outbox guarantees reliable event delivery.

---

### 9. CQRS

Command models and query models remain independent.

Command handlers:

- modify aggregates;
- enforce invariants;
- publish events.

Query handlers:

- never modify aggregates;
- never publish events;
- only serve projections.

---

### 10. Projection-Driven User Experience

Workspace,

Inbox,

Activity timeline,

Dashboard,

Search,

Notifications

are projection modules.

They SHALL NOT contain authoritative business logic.

---

### 11. Inbox and Notifications

Inbox and Notifications represent different bounded contexts.

Inbox represents civic attention.

Notifications represent delivery.

Neither replaces the other.

---

### 12. Immutable History

Historical business events are append-only.

Corrections SHALL be represented by additional events rather than overwriting previous history.

---

### 13. Authorization at Command Boundaries

Authorization SHALL occur before aggregate execution.

Every command passes through:

```text
Authentication
        ↓
Authorization Policy
        ↓
Validation
        ↓
Aggregate
```

Authorization rules SHALL never be enforced solely within the UI.

---

### 14. Validation at Multiple Layers

Validation occurs at:

- HTTP boundary;
- application layer;
- aggregate invariants.

Each layer validates only the concerns under its responsibility.

---

### 15. Deterministic Civic Stage

The civic lifecycle stage SHALL be computed by one authoritative projector.

Multiple competing implementations of civic stage calculation are prohibited.

---

### 16. API Before UI

Backend contracts are defined independently of frontend implementation.

Frontend SHALL consume approved APIs rather than influence backend architecture.

---

### 17. Test-Driven Completion

No implementation slice is complete without automated validation.

Minimum required coverage includes:

- unit tests,
- integration tests,
- contract tests.

End-to-end validation completes the vertical slice.

---

### 18. Traceable Change Management

Changes affecting:

- aggregates,
- events,
- commands,
- bounded contexts,
- lifecycle stages,

must first update:

1. Module Specification

2. ADR (if required)

3. Backend Implementation Plan

Only afterwards may implementation proceed.

---

# Section 5 — Proposed Source Structure

The Humanity Union backend remains a **single modular monolith**.

No second backend application shall be introduced.

Existing infrastructure is extended rather than duplicated.

---

## Architectural Objectives

The source structure aims to achieve:

- clear bounded-context ownership;
- minimal coupling;
- explicit infrastructure;
- predictable dependency flow;
- easy contributor onboarding;
- long-term maintainability.

---

## Proposed Repository Structure

```text
apps/api/src/

├── index.ts
├── app.ts
│
├── config/
│
├── routes/
│
├── shared/
│   ├── domain/
│   ├── application/
│   ├── validation/
│   ├── security/
│   └── observability/
│
├── infrastructure/
│   ├── mongodb/
│   ├── events/
│   ├── outbox/
│   ├── integration/
│   └── persistence/
│
├── events/
│
├── projections/
│   ├── activity/
│   ├── workspace/
│   ├── inbox/
│   └── audit/
│
├── modules/
│   ├── auth/
│   ├── member/
│   ├── workspace/
│   ├── activity/
│   ├── discussion/
│   ├── proposal/
│   ├── decision/
│   ├── implementation/
│   │    └── impact-assessment/
│   ├── inbox/
│   ├── notifications/
│   ├── audit/
│   └── legacy/
│
└── scripts/
```

---

## Directory Responsibilities

### shared/

Contains reusable implementation abstractions.

Examples:

- Entity identifiers
- Domain errors
- Authorization interfaces
- Validation helpers
- Correlation middleware
- Logging

Business rules SHALL NOT be placed here.

---

### infrastructure/

Contains technical implementation only.

Examples:

- MongoDB
- Outbox
- Event Dispatcher
- Integration
- Persistence

Infrastructure SHALL never implement business policy.

---

### modules/

Each bounded context owns:

- aggregate
- repository
- commands
- policies
- REST routes
- event publication

Bounded contexts SHALL remain independent.

---

### projections/

Contains read models only.

Projection modules:

- never own aggregates;
- never publish Catalogue Events;
- never enforce business rules.

---

### events/

Contains:

- Catalogue Event constants;
- envelope definitions;
- shared event metadata.

Business logic SHALL NOT exist here.

---

## Legacy Isolation

Legacy implementation remains isolated under dedicated namespaces until migration is complete.

Legacy code SHALL:

- remain deployable;
- receive bug fixes where necessary;
- not receive new civic functionality.

Normative implementation SHALL always occur within the Version 2.0 bounded contexts.

---

## Dependency Rules

| Layer | May Depend On | Shall Not Depend On |
|--------|---------------|---------------------|
| Domain | shared/domain | Express, MongoDB, other modules |
| Application | Own domain, shared/application | Other bounded contexts |
| Persistence | Infrastructure, own domain | Other repositories |
| Projections | Events, projection storage | Aggregates |
| Infrastructure | Technical libraries | Business policy |
| Shared | Minimal utilities | Module-specific implementation |

---

## Repository Dependency Direction

Dependencies SHALL always flow downward.

```text
REST API
        ↓
Application
        ↓
Domain
        ↓
Persistence
        ↓
Infrastructure
```

Dependencies SHALL NOT point upward.

Business logic SHALL remain independent of infrastructure implementation.

---

# Section 6 — Bounded Context Implementation Map

Each bounded context represents an independent implementation unit.

Every context owns:

- aggregate,
- commands,
- repositories,
- events,
- policies,
- persistence,
- projections (where applicable).

The implementation order follows the approved Member Journey and MVP Civic Lifecycle.

## Normative MVP Bounded Contexts

| Bounded Context | Module Path | Aggregate | Primary Responsibility |
|----------------|------------|-----------|------------------------|
| Identity | `modules/auth/` | Session | Authentication and session lifecycle |
| Member | `modules/member/` | Member | Member lifecycle and responsibility profile |
| Workspace | `modules/workspace/` | Projection | Personalized civic workspace |
| Activity | `modules/activity/` | Activity | Civic activity lifecycle |
| Discussion | `modules/discussion/` | Discussion | Deliberation and evidence |
| Proposal | `modules/proposal/` | Proposal | Civic proposals |
| Decision | `modules/decision/` | Decision | Decision lifecycle |
| Implementation | `modules/implementation/` | Implementation | Approved work execution |
| ImpactAssessment | `modules/implementation/impact-assessment/` | ImpactAssessment | Outcome evaluation |
| Inbox | `modules/inbox/` | Projection | Member attention queue |
| Notifications | `modules/notifications/` | Notification | Delivery of notifications |
| Audit | `modules/audit/` | Projection | Operational audit history |

---

## Bounded Context Responsibilities

### Identity

Responsible for:

- authentication;
- session lifecycle;
- credential validation;
- authentication events.

Identity SHALL NOT own Member information beyond authentication concerns.

Published events include:

- MemberAuthenticated
- SessionEnded

---

### Member

Responsible for:

- Member registration;
- Responsibility Profile;
- verification state;
- Member preferences;
- Member lifecycle.

Published events include:

- MemberRegistered
- MemberProfileUpdated
- ResponsibilityProfileUpdated
- WorkspaceInitialized

Member is the authoritative owner of all Member information.

---

### Workspace

Workspace is a projection context.

Workspace SHALL:

- aggregate information from multiple bounded contexts;
- provide personalized read models;
- never own civic aggregates;
- never publish Catalogue Events.

Workspace exists solely to improve Member experience.

---

### Activity

Activity is the primary civic aggregate.

Responsibilities:

- Activity lifecycle;
- revisions;
- closure;
- civic anchor.

Published events:

- ActivityCreated
- ActivityRevised
- ActivityClosed

All downstream civic processes originate from Activity.

---

### Discussion

Discussion owns civic deliberation.

Responsibilities:

- discussion lifecycle;
- contributions;
- evidence;
- discussion closure.

Published events:

- DiscussionOpened
- ContributionAdded
- EvidenceContributed
- DiscussionClosed

Discussion never modifies Activity directly.

---

### Proposal

Proposal owns proposal development.

Responsibilities:

- proposal creation;
- proposal submission;
- proposal revision;
- proposal withdrawal;
- Member signalling.

Published events:

- ProposalSubmitted
- ProposalRevised
- ProposalWithdrawn
- MemberSignalRecorded

Proposal SHALL NOT approve itself.

---

### Decision

Decision evaluates submitted proposals.

Responsibilities:

- review;
- approval;
- rejection;
- return for revision.

Published events:

- DecisionApproved
- DecisionRejected
- DecisionReturnedForRevision

Decision SHALL never execute implementation work.

---

### Implementation

Implementation executes approved decisions.

Responsibilities:

- execution;
- progress;
- suspension;
- completion.

Published events:

- ImplementationStarted
- ImplementationSuspended
- ImplementationCompleted

Implementation SHALL only begin after an approved Decision.

---

### ImpactAssessment

ImpactAssessment belongs to the Implementation bounded context.

Responsibilities:

- evaluate completed implementation;
- record civic outcomes;
- publish completion metrics.

Published events:

- ImpactRecorded

ImpactAssessment SHALL NOT exist as an independent top-level bounded context.

---

### Inbox

Inbox is a projection context.

Responsibilities:

- Member attention;
- actionable civic items;
- unread state;
- prioritization.

Inbox SHALL never replace Notifications.

---

### Notifications

Notifications deliver information.

Responsibilities:

- delivery channels;
- notification status;
- delivery history.

Published events:

- NotificationDelivered
- NotificationRead

Notifications SHALL remain independent from Inbox.

---

### Audit

Audit records operational history.

Responsibilities:

- privileged operations;
- traceability;
- compliance;
- investigation support.

Audit SHALL never influence business decisions.

---

## Per-Context Deliverables

Every normative bounded context SHALL provide the following implementation artifacts.

| Deliverable | Required |
|-------------|----------|
| Aggregate | ✓ |
| Domain invariants | ✓ |
| Command handlers | ✓ |
| MongoDB repository | ✓ |
| REST API routes | ✓ |
| Authorization policies | ✓ |
| Request validation | ✓ |
| Domain Event publication | ✓ |
| Integration consumers (if applicable) | ✓ |
| Projection handlers | ✓ |
| Unit tests | ✓ |
| Integration tests | ✓ |
| Contract tests | ✓ |

No bounded context is considered complete until every required deliverable has been implemented.

---

## Deferred Bounded Contexts

The following capabilities remain outside the scope of the normative MVP.

| Capability | Target Release |
|------------|----------------|
| Institutions | Post-MVP |
| Working Groups | Post-MVP |
| Governance | Post-MVP |
| Collective Memory | Post-MVP |
| AI Facilitation | Advisory only |
| Translation Platform | Post-MVP |
| Media Platform | Post-MVP |
| Advanced Search | Post-MVP |

Deferred capabilities SHALL NOT influence MVP implementation decisions.

---

# Section 7 — Shared Kernel and Cross-Cutting Infrastructure

The Humanity Union backend intentionally maintains a **minimal Shared Kernel**.

Its purpose is to provide reusable implementation infrastructure while preventing architectural coupling between bounded contexts.

Shared Kernel SHALL contain technical abstractions only.

Business rules belong exclusively inside their owning bounded contexts.

---

## Shared Kernel Objectives

The Shared Kernel exists to provide:

- common identifiers;
- shared contracts;
- technical abstractions;
- infrastructure interfaces;
- reusable implementation utilities.

It SHALL NOT become a general-purpose utility library.

---

## Shared Kernel Components

| Component | Purpose |
|----------|---------|
| DomainEventEnvelope | Standard event envelope |
| CommandResult<T> | Command execution result |
| ApplicationError | Typed backend errors |
| EntityId | Strong aggregate identifiers |
| Timestamps | Standard timestamp handling |
| ActorContext | Authorization context |
| AuthorizationService | Policy evaluation |
| Repository<T> | Repository abstraction |
| TransactionScope | Aggregate transaction wrapper |
| OutboxRecord | Transactional outbox |
| IdempotencyRecord | Command replay protection |
| PaginatedResult<T> | Query pagination |
| ApiResponse<T> | HTTP response envelope |
| Logger | Structured logging |
| CorrelationMiddleware | Request correlation |

---

## Shared Kernel Rules

The Shared Kernel SHALL contain only reusable implementation abstractions.

Allowed examples:

- identifiers;
- envelopes;
- generic interfaces;
- infrastructure helpers;
- serialization contracts;
- logging.

Forbidden examples:

- Proposal business rules;
- Decision policies;
- Activity validation;
- Aggregate state machines;
- REST endpoints;
- MongoDB collections;
- Projection logic.

Business behaviour SHALL remain inside bounded contexts.

---

## Cross-Cutting Infrastructure

Several technical services operate across the entire backend while remaining independent from domain behaviour.

These services include:

- MongoDB infrastructure;
- Event Dispatcher;
- Transactional Outbox;
- Correlation middleware;
- Logging;
- Validation;
- Authentication middleware;
- Authorization framework;
- Health monitoring;
- Configuration management.

These services provide technical capabilities but SHALL never become owners of business rules.

---

## Cross-Cutting Principles

Cross-cutting infrastructure SHALL:

- remain framework-independent where practical;
- support all bounded contexts equally;
- avoid domain knowledge;
- remain reusable;
- remain replaceable without affecting business logic.

Domain implementation SHALL depend on abstractions rather than infrastructure details.

---

# Section 8 — Data Persistence Plan

Persistence follows the aggregate ownership model defined by Blueprint v2.0.

Every aggregate owns exactly one authoritative persistence model.

Read models remain independent projections.

Historical business data is append-only.

## Persistence Principles

Backend persistence follows the principles below.

### 1. Aggregate Ownership

Each aggregate owns exactly one primary persistence model.

Aggregate data SHALL NOT be shared between bounded contexts.

---

### 2. One Aggregate — One Primary Collection

Every aggregate is persisted in one authoritative MongoDB collection.

Supporting embedded documents are permitted where they remain part of the same aggregate consistency boundary.

---

### 3. Projection Separation

Read models SHALL be stored independently from aggregate collections.

Projection collections may be rebuilt from Catalogue Events and therefore never become the source of truth.

---

### 4. Event Durability

Business events SHALL be persisted before publication through the Transactional Outbox.

Event publication SHALL never bypass persistence.

---

### 5. Historical Integrity

Historical business records are append-only.

Business history SHALL never be rewritten.

Corrections SHALL be represented through additional events.

---

### 6. Incremental Migration

Legacy Initiative collections remain operational until equivalent Activity-based bounded contexts become authoritative.

No destructive migration is part of MVP implementation.

---

## Aggregate Collection Map

| Collection | Aggregate Owner | Purpose |
|------------|----------------|---------|
| `members` | Member | Member aggregate |
| `auth_users` | Identity | Authentication identities |
| `auth_sessions` | Identity | Session lifecycle |
| `activities` | Activity | Activity aggregate |
| `discussions` | Discussion | Discussion aggregate |
| `proposals` | Proposal | Proposal aggregate |
| `decisions` | Decision | Decision aggregate |
| `implementations` | Implementation | Implementation aggregate |
| `impact_assessments` | ImpactAssessment | Impact evaluation |
| `outbox` | Infrastructure | Pending domain events |
| `processed_events` | Infrastructure | Consumer idempotency |
| `projection_checkpoints` | Infrastructure | Projection rebuild checkpoints |
| `activity_projections` | Projection | Activity read model |
| `workspace_member_summary` | Projection | Workspace overview |
| `inbox_items` | Projection | Member inbox |
| `notification_deliveries` | Notification | Delivery tracking |
| `audit_log` | Audit | Operational audit history |

---

## Persistence Ownership

The following ownership model is mandatory.

| Bounded Context | Aggregate | Collection |
|----------------|-----------|------------|
| Identity | Session | auth_users / auth_sessions |
| Member | Member | members |
| Activity | Activity | activities |
| Discussion | Discussion | discussions |
| Proposal | Proposal | proposals |
| Decision | Decision | decisions |
| Implementation | Implementation | implementations |
| ImpactAssessment | ImpactAssessment | impact_assessments |

Ownership SHALL never overlap.

No bounded context may write directly into another aggregate collection.

---

## Projection Collections

Projection collections provide optimized read models.

They SHALL:

- never own business state;
- never publish Catalogue Events;
- remain fully rebuildable;
- tolerate eventual consistency.

Examples include:

- Workspace overview
- Inbox
- Activity detail
- Civic stage
- Search indexes
- Audit timeline

---

## Infrastructure Collections

Infrastructure collections support backend operation rather than business behaviour.

These include:

| Collection | Responsibility |
|------------|----------------|
| outbox | Reliable event publication |
| processed_events | Idempotent event handling |
| projection_checkpoints | Projection replay progress |
| domain_events *(optional)* | Long-term event archive |

Infrastructure collections SHALL never replace aggregate persistence.

---

## Collection Index Strategy

Indexes SHALL support:

- aggregate identifiers;
- lookup performance;
- uniqueness constraints;
- event replay;
- projection rebuild.

Compound indexes SHALL be introduced only where justified by access patterns.

Indexes SHALL remain idempotent through migration scripts.

---

## Migration Strategy

Repository modernization follows an additive migration model.

Implementation sequence:

1. Create new collections.
2. Create indexes.
3. Introduce repositories.
4. Introduce events.
5. Build projections.
6. Redirect API.
7. Deprecate legacy routes.
8. Remove legacy implementation after replacement.

Destructive migrations are outside MVP scope.

---

## Environment Strategy

| Environment | Database | Purpose |
|-------------|----------|---------|
| Local | humanity_union_dev | Developer workstation |
| Test | humanity_union_test | Automated testing |
| Staging | Humanity Union Staging | Release validation |
| Production | Humanity Union Production | Live platform |

Each environment SHALL remain completely isolated.

Production data SHALL never be copied into automated tests.

---

# Section 9 — Event Infrastructure Plan

Event-driven integration is the foundation of the Humanity Union backend.

Catalogue Events coordinate collaboration between bounded contexts while preserving aggregate independence.

The backend adopts a **Transactional Outbox + In-Process Dispatcher** architecture for the MVP.

This architecture satisfies Blueprint v2.0 while avoiding unnecessary operational complexity.

---

## Event Infrastructure Objectives

The event infrastructure SHALL provide:

- reliable event publication;
- eventual consistency;
- bounded-context isolation;
- replay capability;
- projection rebuilding;
- integration extensibility;
- operational observability.

---

## Event Lifecycle

Every Catalogue Event follows the same lifecycle.

```text
REST API
      │
      ▼
Command Handler
      │
      ▼
Aggregate
      │
      ▼
MongoDB Commit
      │
      ▼
Transactional Outbox
      │
      ▼
Dispatcher
      │
      ▼
Consumers
      │
      ▼
Projections
```

No Catalogue Event may bypass the Transactional Outbox.

---

## Event Publication Rules

Only aggregate owners publish Catalogue Events.

Publication SHALL occur after successful persistence.

Events SHALL include:

- Event ID
- Aggregate ID
- Event name
- Payload
- Timestamp
- Correlation ID
- Causation ID
- Actor ID
- Schema Version

Event payloads SHALL remain immutable after publication.

---

## Event Publisher Matrix

| Event | Publisher |
|--------|-----------|
| MemberRegistered | Member |
| MemberAuthenticated | Identity |
| WorkspaceInitialized | Member |
| ActivityCreated | Activity |
| ActivityRevised | Activity |
| ActivityClosed | Activity |
| DiscussionOpened | Discussion |
| ContributionAdded | Discussion |
| EvidenceContributed | Discussion |
| ProposalSubmitted | Proposal |
| ProposalRevised | Proposal |
| DecisionApproved | Decision |
| DecisionRejected | Decision |
| ImplementationStarted | Implementation |
| ImplementationCompleted | Implementation |
| ImpactRecorded | ImpactAssessment |
| NotificationDelivered | Notifications |

Only these bounded contexts may publish the corresponding events.

---

## Event Consumer Principles

Consumers SHALL:

- be idempotent;
- tolerate retries;
- tolerate delayed delivery;
- avoid business ownership;
- never mutate foreign aggregates.

Consumers update:

- projections;
- integration state;
- workflow readiness;
- notification queues.

---

## Consumer Responsibilities

Examples include:

| Event | Consumer |
|--------|----------|
| MemberRegistered | Workspace Projection |
| MemberRegistered | Activity eligibility |
| ProposalSubmitted | Decision initialization |
| DecisionApproved | Implementation readiness |
| ImplementationCompleted | ImpactAssessment eligibility |
| ImpactRecorded | Workspace projection |
| ImpactRecorded | Inbox projection |

Consumers SHALL remain loosely coupled.

---

## Retry Policy

Reliable delivery requires retry support.

Minimum MVP policy:

| Setting | Value |
|---------|-------|
| Retry attempts | 5 |
| Strategy | Exponential backoff |
| Failed state | Outbox failed |
| Ordering | Per aggregate |
| Duplicate handling | Idempotent consumer |
| Event replay | Supported |

---

## Projection Rebuild

Projection rebuilding SHALL always remain possible.

Standard procedure:

1. Pause dispatcher.
2. Reset projection collections.
3. Replay Catalogue Events.
4. Validate checkpoints.
5. Resume dispatcher.

Aggregate collections remain untouched during rebuild.

---

## Event Infrastructure Principles

The Humanity Union backend intentionally adopts a conservative event architecture.

The MVP SHALL NOT introduce:

- Kafka;
- RabbitMQ;
- distributed brokers;
- event streaming platforms;
- microservice messaging.

The Transactional Outbox combined with an in-process dispatcher provides sufficient reliability while maintaining architectural simplicity.

Additional messaging technologies may be introduced only through a future ADR after MVP completion.

# Section 10 — Authentication and Authorization

Authentication and authorization are distinct architectural responsibilities.

Authentication establishes **who** the Member is.

Authorization determines **what** the Member is permitted to do.

The Humanity Union backend SHALL enforce both independently.

---

## Authentication Responsibilities

The Identity bounded context is responsible for:

- account registration;
- credential verification;
- email verification;
- session lifecycle;
- JWT issuance;
- password management;
- session revocation.

Identity SHALL NOT manage civic permissions.

---

## Authorization Responsibilities

Authorization evaluates whether an authenticated Member may execute a command.

Authorization decisions are based upon:

- Member status;
- verification level;
- Responsibility Profile;
- ownership;
- moderation state;
- platform policies.

Authorization SHALL occur before command execution.

---

## Authorization Pipeline

Every write request SHALL pass through the following pipeline.

```text
HTTP Request
        │
        ▼
Authentication
        │
        ▼
Actor Context
        │
        ▼
Authorization Policy
        │
        ▼
Request Validation
        │
        ▼
Command Handler
        │
        ▼
Aggregate
```

Failure at any stage terminates request processing.

---

## Actor Context

Every authenticated request SHALL create an immutable Actor Context.

Minimum properties include:

| Property | Description |
|----------|-------------|
| MemberId | Authenticated Member |
| SessionId | Current session |
| Roles | Assigned platform roles |
| VerificationLevel | Verification status |
| ResponsibilityProfile | Responsibility settings |
| CorrelationId | Distributed tracing |
| RequestTimestamp | Request creation time |

Actor Context SHALL remain immutable throughout command execution.

---

## Authorization Policies

Authorization logic SHALL be implemented through explicit policy classes.

Examples:

```text
ActivityPolicy

DiscussionPolicy

ProposalPolicy

DecisionPolicy

ImplementationPolicy
```

Policies SHALL remain independent from:

- Express
- MongoDB
- HTTP transport

---

## Authorization Matrix

| Command | Minimum Requirement |
|----------|--------------------|
| Register Member | Anonymous |
| Update Member Profile | Owner |
| Create Activity | Authenticated Member |
| Revise Activity | Activity Owner |
| Open Discussion | Authorized Participant |
| Add Contribution | Authorized Participant |
| Submit Proposal | Eligible Member |
| Revise Proposal | Proposal Author |
| Approve Decision | Decision Authority |
| Start Implementation | Authorized Implementation Role |
| Complete Implementation | Assigned Implementation Role |
| Record Impact | Authorized Assessment Role |

Actual role mapping is governed by Module Specifications.

---

## Authorization Principles

Authorization SHALL:

- be deterministic;
- execute before aggregates;
- never rely on frontend validation;
- never bypass policies;
- produce standardized authorization failures.

---

## Identity Events

Authentication publishes the following Catalogue Events.

| Event | Purpose |
|--------|---------|
| MemberAuthenticated | Successful authentication |
| SessionEnded | Session termination |
| PasswordChanged *(optional)* | Credential update |
| EmailVerified | Account verification |

These events SHALL NOT modify civic aggregates directly.

---

## Member Events

The Member bounded context publishes:

| Event | Purpose |
|--------|---------|
| MemberRegistered | Initial Member creation |
| MemberProfileUpdated | Profile update |
| ResponsibilityProfileUpdated | Civic preferences |
| WorkspaceInitialized | Initial workspace creation |

These events initiate downstream projections.

---

# Section 11 — API Implementation Plan

The Humanity Union backend exposes a REST API organized around bounded contexts.

API endpoints represent the application layer.

Business rules remain inside aggregates.

---

## API Design Principles

REST endpoints SHALL:

- remain resource-oriented;
- delegate business logic to command handlers;
- return standardized responses;
- remain versioned;
- never expose persistence models.

---

## Versioning Strategy

All public endpoints SHALL use:

```text
/api/v1/
```

Future breaking changes SHALL introduce new API versions rather than modifying existing contracts.

---

## Module Route Structure

```text
/api/v1/auth

/api/v1/member

/api/v1/workspace

/api/v1/activity

/api/v1/discussion

/api/v1/proposal

/api/v1/decision

/api/v1/implementation

/api/v1/impact

/api/v1/inbox

/api/v1/notifications
```

Each bounded context owns its own routes.

---

## REST → Command Mapping

Every write endpoint SHALL invoke exactly one command.

Example:

| REST Endpoint | Command |
|--------------|---------|
| POST /activities | CreateActivityCommand |
| PATCH /activities/{id} | ReviseActivityCommand |
| POST /discussions | OpenDiscussionCommand |
| POST /proposals | SubmitProposalCommand |
| POST /decisions/{id}/approve | ApproveDecisionCommand |
| POST /implementations/{id}/start | StartImplementationCommand |
| POST /impact | RecordImpactCommand |

Commands SHALL own business execution.

---

## Read API

Read endpoints consume projection models only.

Examples:

```text
GET /workspace

GET /activity

GET /activity/{id}

GET /inbox

GET /notifications
```

Read endpoints SHALL NOT execute domain behaviour.

---

## Standard Response Envelope

Successful responses SHOULD follow a consistent structure.

Example:

```json
{
  "success": true,
  "data": { },
  "meta": { }
}
```

Errors SHALL follow the same standardized envelope.

---

## Error Responses

Errors SHALL include:

- error code;
- human-readable message;
- correlation ID;
- optional validation details.

Internal implementation details SHALL NOT be exposed.

---

## Validation Strategy

Validation occurs in three stages.

### HTTP Validation

Responsible for:

- JSON format;
- required fields;
- primitive types.

---

### Application Validation

Responsible for:

- request consistency;
- command construction.

---

### Domain Validation

Responsible for:

- aggregate invariants;
- business rules;
- lifecycle constraints.

Domain validation remains authoritative.

---

## API Security

Every protected endpoint SHALL require:

- JWT authentication;
- authorization policy;
- request validation;
- correlation ID.

Sensitive operations SHALL be audited.

---

## API Documentation

REST endpoints SHALL remain synchronized with:

- Module Specifications;
- Backend Implementation Plan;
- automated contract tests.

Manual documentation SHALL never become the authoritative API definition.

---

## API Implementation Principles

The API layer SHALL remain intentionally thin.

Responsibilities include:

- request parsing;
- authentication;
- authorization;
- validation;
- command dispatch;
- response serialization.

Business decisions SHALL never be implemented in controllers.

Controllers coordinate.

Aggregates decide.

# Section 12 — Vertical Slice Delivery Strategy

The Humanity Union backend SHALL be implemented using a **Vertical Slice Architecture**.

A Vertical Slice delivers one complete business capability spanning every backend layer, from HTTP entry point to persistence, event publication, projections, and automated validation.

This strategy minimizes integration risk, enables continuous deployment, and ensures that every completed slice represents production-ready functionality.

---

## Vertical Slice Objectives

Each completed slice SHALL provide:

- business value;
- executable functionality;
- complete architectural compliance;
- automated verification;
- deployable code.

No slice is considered complete if it implements only part of the required architecture.

---

## Vertical Slice Definition

Every implementation slice includes all required backend layers.

```text
REST Endpoint
        │
        ▼
Authentication
        │
        ▼
Authorization
        │
        ▼
Validation
        │
        ▼
Command Handler
        │
        ▼
Aggregate
        │
        ▼
Repository
        │
        ▼
MongoDB Transaction
        │
        ▼
Transactional Outbox
        │
        ▼
Event Dispatcher
        │
        ▼
Consumers
        │
        ▼
Projection
        │
        ▼
Automated Tests
```

Each layer SHALL be operational before a slice is considered complete.

---

## Slice Completion Criteria

A Vertical Slice SHALL include:

| Component | Required |
|-----------|----------|
| REST endpoint | ✓ |
| Request validation | ✓ |
| Authorization | ✓ |
| Command | ✓ |
| Aggregate | ✓ |
| Repository | ✓ |
| Mongo persistence | ✓ |
| Transactional Outbox | ✓ |
| Catalogue Event publication | ✓ |
| Projection updates | ✓ |
| Unit tests | ✓ |
| Integration tests | ✓ |
| Contract tests | ✓ |

Partial implementation is not considered a completed slice.

---

## MVP Slice Order

Implementation SHALL follow the approved civic lifecycle.

| Slice | Primary Deliverable |
|--------|---------------------|
| Slice 0 | Backend foundation |
| Slice 1 | Member lifecycle |
| Slice 2 | Event infrastructure |
| Slice 3 | Workspace projection |
| Slice 4 | Activity |
| Slice 5 | Discussion |
| Slice 6 | Proposal |
| Slice 7 | Decision |
| Slice 8 | Implementation |
| Slice 9 | Impact Assessment |
| Slice 10 | Inbox & Notifications |
| Slice 11 | End-to-end validation |

This sequence minimizes dependency complexity while delivering usable functionality throughout development.

---

## Dependency Principles

A slice may depend only on completed slices.

Future slices SHALL NOT introduce dependencies into previously completed implementation.

Example:

```text
Activity

↓

Discussion

↓

Proposal

↓

Decision

↓

Implementation

↓

Impact
```

Reverse dependencies are prohibited.

---

## Definition of Slice Completion

A slice is complete only when:

- business rules are implemented;
- persistence is operational;
- Catalogue Events are published;
- projections are updated;
- tests pass;
- documentation is synchronized.

Passing compilation alone does not constitute completion.

---

# Section 13 — Sprint Delivery Plan

Sprint planning converts Vertical Slices into incremental implementation work.

Each sprint produces a deployable backend increment.

Sprint duration is intentionally unspecified.

Progress is measured by completed functionality rather than calendar time.

---

## Sprint Objectives

Each sprint SHALL:

- implement complete functionality;
- preserve repository stability;
- maintain architectural compliance;
- increase automated test coverage;
- remain independently deployable.

---

## Sprint Sequence

| Sprint | Deliverables |
|---------|--------------|
| S0 | Backend foundation |
| S1 | Member events |
| S2 | Transactional Outbox |
| S3 | Workspace projections |
| S4 | Activity bounded context |
| S5 | Discussion bounded context |
| S6 | Proposal bounded context |
| S7 | Decision bounded context |
| S8 | Implementation bounded context |
| S9 | Impact Assessment |
| S10 | Inbox, Notifications, Audit |
| S11 | Complete MVP validation |

Each sprint concludes with a fully functioning implementation increment.

---

## Sprint Deliverables

Every sprint SHALL produce:

- executable backend code;
- passing automated tests;
- synchronized documentation;
- updated implementation checklist;
- deployment validation.

---

## Sprint Exit Criteria

A sprint may close only when:

- type checking passes;
- automated tests succeed;
- Catalogue Events match specifications;
- projections operate correctly;
- deployment health checks pass.

Incomplete functionality SHALL move to the following sprint rather than lowering quality standards.

---

## Sprint Review

Sprint review SHALL confirm:

- architectural compliance;
- implementation completeness;
- successful event publication;
- projection correctness;
- repository stability.

Review SHALL be evidence-based rather than subjective.

---

# Section 14 — Sprint 1 Implementation Plan

Sprint 1 establishes the minimum architectural foundation required for all subsequent backend development.

The objective is **not** to implement business functionality.

The objective is to establish reliable backend infrastructure.

---

## Sprint Goal

Deliver the foundational infrastructure necessary to begin the normative MVP Civic Chain.

Sprint 1 establishes:

- Transactional Outbox;
- Member persistence;
- Catalogue Event publication;
- structured logging;
- correlation identifiers;
- automated integration testing.

---

## Sprint Deliverables

| Deliverable | Required |
|-------------|----------|
| Member repository | ✓ |
| MemberRegistered event | ✓ |
| Event envelope | ✓ |
| Outbox persistence | ✓ |
| Dispatcher | ✓ |
| Correlation middleware | ✓ |
| Structured logger | ✓ |
| Integration test | ✓ |
| Health validation | ✓ |

---

## Repository Work

Sprint 1 SHALL introduce:

```text
modules/member/

infrastructure/outbox/

infrastructure/events/

shared/observability/

shared/application/

test/integration/
```

Repository organization SHALL remain aligned with Section 5.

---

## Member Repository

The Member repository SHALL become the authoritative persistence implementation.

Responsibilities include:

- aggregate persistence;
- optimistic concurrency;
- event persistence;
- transactional consistency.

Member SHALL become the first fully compliant aggregate.

---

## Event Envelope

All Catalogue Events SHALL adopt a unified event envelope.

Minimum fields include:

- EventId
- EventName
- AggregateId
- AggregateType
- OccurredAt
- CorrelationId
- CausationId
- ActorId
- SchemaVersion
- Payload

This envelope becomes the standard for every subsequent bounded context.

---

## Transactional Outbox

Sprint 1 introduces the Transactional Outbox.

Every MemberRegistered event SHALL:

1. persist the aggregate;
2. persist the Outbox record;
3. commit the transaction;
4. become eligible for dispatch.

Publication SHALL never occur before successful persistence.

---

## Dispatcher

The Dispatcher SHALL:

- poll pending Outbox records;
- publish events;
- mark successful delivery;
- support retry;
- preserve ordering per aggregate.

Dispatcher execution remains internal to the modular monolith.

---

## Correlation Middleware

Every incoming request SHALL receive a Correlation ID.

Correlation SHALL propagate through:

- HTTP requests;
- command handlers;
- events;
- logging;
- projections.

Operational tracing depends upon consistent correlation identifiers.

---

## Structured Logging

Sprint 1 introduces structured logging.

Every log entry SHOULD include:

- timestamp;
- severity;
- correlation ID;
- actor ID (if available);
- bounded context;
- event name (where applicable).

Logging SHALL support operational diagnostics rather than debugging only.

---

## Integration Test

Sprint 1 concludes with a complete integration test verifying:

- Member registration;
- aggregate persistence;
- Outbox insertion;
- event dispatch;
- successful projection trigger.

This establishes the baseline for all future integration testing.

---

## Sprint 1 Exit Criteria

Sprint 1 is complete only when:

- MemberRegistered is published correctly;
- Transactional Outbox functions reliably;
- Dispatcher processes events;
- automated integration tests pass;
- health endpoint reports operational readiness.

Only after these criteria are satisfied may Activity implementation begin.

# Section 15 — Testing Strategy

The Humanity Union backend adopts a **testing-first implementation strategy**.

Testing is an architectural requirement rather than a quality assurance activity performed after implementation.

Every Vertical Slice SHALL include automated validation before it is considered complete.

---

## Testing Objectives

The testing strategy SHALL ensure:

- architectural correctness;
- business rule validation;
- repository integrity;
- reliable event publication;
- projection consistency;
- deployment confidence;
- regression prevention.

Testing SHALL verify behavior rather than implementation details.

---

## Testing Pyramid

The backend follows the testing pyramid shown below.

```text
                E2E
                 ▲
          Contract Tests
                 ▲
      Integration Tests
                 ▲
            Unit Tests
```

Each higher layer depends upon confidence established by lower layers.

---

## Unit Tests

Unit tests verify isolated business behavior.

Typical scope includes:

- aggregate invariants;
- value objects;
- domain services;
- authorization policies;
- command handlers (with mocked repositories).

Unit tests SHALL NOT require:

- MongoDB;
- HTTP server;
- Event Dispatcher.

Execution SHALL remain deterministic.

---

## Integration Tests

Integration tests verify collaboration between backend components.

Typical scenarios include:

- aggregate persistence;
- MongoDB repositories;
- Transactional Outbox;
- Dispatcher execution;
- event publication;
- projection updates.

Integration tests SHALL use an isolated test database.

---

## Contract Tests

Contract tests verify API behavior.

Contract testing includes:

- endpoint responses;
- HTTP status codes;
- validation failures;
- authorization failures;
- response envelopes;
- backward compatibility.

Contract tests protect frontend-backend integration.

---

## End-to-End Tests

End-to-end tests validate complete business workflows.

Examples include:

- Member registration;
- Activity creation;
- Proposal submission;
- Decision approval;
- Implementation completion;
- Impact recording.

E2E tests verify the complete MVP Civic Lifecycle.

---

## Repository Test Structure

```text
apps/api/test/

├── unit/
├── integration/
├── contract/
├── fixtures/
├── factories/
├── helpers/
└── e2e/
```

This structure SHALL remain consistent throughout the project.

---

## Test Data

Test data SHALL be:

- deterministic;
- reproducible;
- isolated;
- disposable.

Tests SHALL NOT depend on production data.

---

## Test Fixtures

Fixtures provide reusable baseline objects.

Typical fixtures include:

- Member
- Activity
- Discussion
- Proposal
- Decision
- Implementation
- ImpactAssessment

Fixtures SHALL remain minimal.

---

## Test Factories

Factories generate valid domain objects.

Factories SHALL:

- produce deterministic defaults;
- allow explicit overrides;
- avoid unnecessary randomness.

Factories improve readability and maintainability.

---

## Event Testing

Catalogue Events SHALL be tested for:

- correct publication;
- payload correctness;
- ordering;
- idempotency;
- correlation metadata.

Event publication SHALL be considered part of the business contract.

---

## Projection Testing

Projection tests SHALL verify:

- correct projection creation;
- update consistency;
- rebuild capability;
- replay correctness.

Projection testing SHALL never rely upon manual inspection.

---

## Authorization Testing

Authorization SHALL include:

- successful execution;
- forbidden execution;
- anonymous access;
- ownership validation;
- responsibility validation.

Security behavior requires automated validation.

---

## Performance Validation

Minimum MVP performance testing includes:

- API responsiveness;
- projection rebuild timing;
- event dispatch latency;
- startup health;
- database connectivity.

Performance optimization remains secondary to correctness during MVP.

---

## Definition of Tested

Implementation is considered tested only when:

- unit tests pass;
- integration tests pass;
- contract tests pass;
- E2E scenarios succeed;
- CI pipeline succeeds.

Passing only one test layer is insufficient.

---

# Section 16 — Continuous Integration Strategy

Continuous Integration (CI) provides automated validation for every repository change.

CI SHALL enforce architectural quality before code reaches the main branch.

---

## CI Objectives

Continuous Integration SHALL:

- verify compilation;
- execute automated tests;
- detect architectural drift;
- validate event contracts;
- maintain deployment confidence.

CI SHALL become the primary quality gate.

---

## Minimum CI Pipeline

```text
Checkout
      │
      ▼
Install Dependencies
      │
      ▼
Type Check
      │
      ▼
Lint
      │
      ▼
Unit Tests
      │
      ▼
Integration Tests
      │
      ▼
Contract Tests
      │
      ▼
Build
      │
      ▼
Docker Build
      │
      ▼
Health Verification
```

Each stage SHALL complete successfully before progressing.

---

## Required Pipeline Checks

Every Pull Request SHALL execute:

- dependency installation;
- TypeScript compilation;
- linting;
- unit tests;
- integration tests;
- contract tests;
- Docker image build.

Optional quality gates may be introduced after MVP completion.

---

## Pull Request Requirements

No Pull Request may be merged unless:

- all CI stages succeed;
- architectural conventions are respected;
- Catalogue Event names remain compliant;
- automated tests pass.

Manual approval SHALL NOT replace failed CI validation.

---

## Branch Strategy

Recommended repository strategy:

```text
main

↓

feature/*

↓

pull request

↓

review

↓

merge
```

Direct commits to the production branch SHOULD be avoided.

---

## Build Artifacts

Successful builds SHALL produce:

- compiled backend;
- Docker image;
- automated test reports;
- coverage summary.

Artifacts SHALL remain reproducible.

---

## Failure Policy

Pipeline failure SHALL block merge.

Typical failures include:

- compilation errors;
- failing tests;
- contract violations;
- missing event definitions.

Build failures SHALL be resolved before implementation continues.

---

## CI Evolution

Future CI improvements may include:

- static security analysis;
- dependency vulnerability scanning;
- architectural conformance checks;
- automated documentation validation;
- deployment automation.

These enhancements remain outside the MVP critical path.

# Section 17 — Observability and Operations

Operational excellence is a core architectural requirement of the Humanity Union backend.

Every production deployment SHALL provide sufficient operational visibility to detect failures, diagnose incidents, verify business workflows, and support continuous improvement.

Observability SHALL be implemented from the first production-ready Vertical Slice rather than added after MVP completion.

---

## Operational Objectives

The operational platform SHALL provide:

- service health;
- structured logging;
- distributed request tracing;
- event visibility;
- projection monitoring;
- deployment diagnostics;
- production troubleshooting.

Observability SHALL support both infrastructure and business operations.

---

## Observability Components

| Component | Purpose |
|----------|---------|
| Structured Logging | Operational diagnostics |
| Correlation IDs | Request tracing |
| Health Checks | Service readiness |
| Metrics | Performance monitoring |
| Event Monitoring | Catalogue Event visibility |
| Projection Monitoring | Read model consistency |
| Error Reporting | Failure diagnostics |
| Audit Timeline | Operational history |

---

## Structured Logging

Every backend service SHALL produce structured logs.

Each log entry SHOULD include:

| Field | Description |
|------|-------------|
| Timestamp | UTC event time |
| Severity | INFO, WARN, ERROR |
| Correlation ID | Request trace |
| Actor ID | Authenticated Member (if applicable) |
| Module | Owning bounded context |
| Aggregate | Aggregate type |
| Event | Catalogue Event (if applicable) |
| Command | Executed command |
| Message | Human-readable description |

Logs SHALL remain machine-readable.

Plain-text debugging logs SHALL NOT be relied upon in production.

---

## Correlation IDs

Every incoming request SHALL receive a Correlation ID.

The identifier SHALL propagate through:

- HTTP requests;
- command handlers;
- aggregates;
- repositories;
- Transactional Outbox;
- Event Dispatcher;
- projections;
- notifications.

Correlation enables complete request reconstruction across the backend.

---

## Health Endpoints

The backend SHALL expose standardized health endpoints.

Recommended endpoints:

```text
GET /health

GET /health/readiness

GET /health/liveness
```

These endpoints SHALL support orchestration, deployment validation, and operational monitoring.

---

## Readiness Checks

Readiness validation SHALL verify:

- MongoDB connectivity;
- configuration loading;
- Transactional Outbox availability;
- Dispatcher availability;
- projection readiness.

A service failing readiness SHALL NOT receive production traffic.

---

## Liveness Checks

Liveness verifies that the backend process remains operational.

Minimum checks include:

- application process running;
- event loop responsive;
- configuration initialized.

Liveness SHALL remain lightweight.

---

## Event Monitoring

Catalogue Events SHALL be observable.

Operational metrics SHOULD include:

- events published;
- events processed;
- failed dispatches;
- retry attempts;
- processing latency.

Monitoring SHALL support operational troubleshooting without exposing business-sensitive data.

---

## Projection Monitoring

Projection monitoring SHALL verify:

- projection freshness;
- processing lag;
- replay progress;
- rebuild completion.

Projection monitoring SHALL detect eventual consistency issues before they affect Members.

---

## Error Reporting

Unexpected failures SHALL include:

- Correlation ID;
- stack trace (internal only);
- bounded context;
- command;
- aggregate;
- event (if applicable).

Sensitive implementation details SHALL never be exposed through public API responses.

---

## Operational Metrics

Recommended MVP operational metrics include:

| Metric | Purpose |
|--------|---------|
| API latency | Response performance |
| Command duration | Business execution |
| Event dispatch latency | Event infrastructure |
| Projection lag | Read model freshness |
| Outbox backlog | Event publication health |
| MongoDB response time | Database performance |
| Error rate | Operational quality |

These metrics support capacity planning and operational stability.

---

## Operational Alerts

Production monitoring SHOULD alert on:

- repeated health failures;
- persistent Outbox backlog;
- projection replay failures;
- repeated event dispatch errors;
- abnormal API latency;
- repeated authorization failures.

Alert thresholds SHALL be tuned based on operational experience.

---

# Section 18 — Configuration and Environment Management

Configuration SHALL remain external to application code.

Environment-specific behavior SHALL be controlled through configuration rather than conditional implementation.

---

## Configuration Principles

Configuration SHALL be:

- explicit;
- environment-specific;
- version-controlled (templates only);
- reproducible;
- documented.

Application behavior SHALL NOT depend on undocumented configuration.

---

## Environment Hierarchy

| Environment | Purpose |
|------------|---------|
| Local | Development |
| Test | Automated testing |
| Staging | Release validation |
| Production | Live deployment |

Each environment SHALL remain isolated.

---

## Environment Variables

Configuration SHOULD include:

| Variable | Purpose |
|----------|---------|
| NODE_ENV | Runtime mode |
| PORT | HTTP port |
| MONGODB_URI | Database connection |
| JWT_SECRET | Authentication |
| JWT_EXPIRES_IN | Session duration |
| OUTBOX_INTERVAL | Dispatcher polling |
| LOG_LEVEL | Logging verbosity |
| APP_URL | Public application URL |

Additional configuration SHALL remain documented.

---

## Secrets Management

Sensitive values SHALL include:

- JWT secrets;
- database credentials;
- SMTP credentials;
- API tokens;
- encryption keys.

Secrets SHALL NEVER be committed to source control.

---

## Configuration Validation

Application startup SHALL validate:

- required environment variables;
- supported values;
- configuration consistency.

Invalid configuration SHALL prevent application startup.

---

## Environment Templates

Repository SHALL provide:

```text
.env.example
```

The template SHALL contain:

- required variables;
- descriptions;
- example values.

Production secrets SHALL never appear in templates.

---

## Feature Flags

Feature flags MAY be introduced for:

- incremental migration;
- experimental features;
- staged rollout;
- legacy compatibility.

Feature flags SHALL NOT replace architectural decisions.

---

## Environment Isolation

Development, testing, staging, and production SHALL:

- use separate databases;
- use separate secrets;
- remain operationally independent.

No automated process SHALL connect a test environment to production resources.

---

# Section 19 — Deployment Strategy

Deployment SHALL prioritize reliability, repeatability, and operational simplicity.

The MVP backend is deployed as a single modular monolith.

---

## Deployment Objectives

Deployment SHALL provide:

- repeatable releases;
- minimal downtime;
- rollback capability;
- operational verification;
- deployment traceability.

---

## Deployment Pipeline

Standard deployment sequence:

```text
Source Code
      │
      ▼
Type Check
      │
      ▼
Automated Tests
      │
      ▼
Build
      │
      ▼
Docker Image
      │
      ▼
Deployment
      │
      ▼
Health Validation
      │
      ▼
Production
```

---

## Docker Strategy

Docker SHALL package:

- API application;
- runtime dependencies;
- production configuration;
- startup scripts.

Images SHALL remain immutable.

---

## Deployment Validation

Every deployment SHALL verify:

- successful startup;
- MongoDB connectivity;
- health endpoint;
- dispatcher readiness;
- configuration loading.

Deployment SHALL fail if validation fails.

---

## Rollback Strategy

Rollback SHALL be supported through:

- immutable Docker images;
- versioned releases;
- database compatibility;
- feature flags (where appropriate).

Rollback SHALL restore the previous operational state without requiring repository changes.

---

## Post-Deployment Verification

Following deployment, operational verification SHALL confirm:

- service availability;
- successful authentication;
- event publication;
- projection updates;
- API responsiveness.

Deployment SHALL not be considered complete until operational validation succeeds.

# Section 20 — Migration Strategy

Migration from the legacy repository to the Blueprint v2.0 architecture SHALL be incremental, predictable, and reversible wherever practical.

The primary objective is to introduce the normative MVP Civic Chain while preserving repository stability and avoiding unnecessary disruption to existing operational functionality.

Migration is an implementation activity rather than an architectural redesign.

---

## Migration Objectives

Repository migration SHALL:

- preserve production stability;
- minimize implementation risk;
- avoid large-scale rewrites;
- enable continuous deployment;
- maintain architectural traceability;
- allow progressive replacement of legacy functionality.

---

## Migration Principles

Migration SHALL follow these principles.

### Incremental Evolution

New bounded contexts SHALL be introduced alongside existing implementation.

Legacy components SHALL remain operational until their replacements become production-ready.

---

### Build Before Replace

Replacement SHALL occur only after the new implementation has successfully completed:

- implementation;
- testing;
- deployment validation;
- production verification.

Deletion is always the final step.

---

### No Breaking Repository Refactoring

Repository restructuring SHALL occur gradually.

Large-scale repository reorganization is prohibited during MVP implementation.

---

### Feature Equivalence

Legacy functionality SHALL NOT be removed until equivalent normative functionality has been verified.

Feature parity is required before retirement.

---

### Controlled Transition

Migration SHALL occur through explicit implementation milestones rather than ad hoc code replacement.

---

## Migration Phases

| Phase | Objective |
|--------|-----------|
| Phase 1 | Establish backend infrastructure |
| Phase 2 | Introduce normative Member lifecycle |
| Phase 3 | Introduce Activity bounded context |
| Phase 4 | Replace civic workflow modules |
| Phase 5 | Redirect API endpoints |
| Phase 6 | Deprecate legacy functionality |
| Phase 7 | Remove obsolete implementation |

Each phase concludes with successful validation before the following phase begins.

---

## Legacy Preservation

Legacy implementation SHALL remain:

- deployable;
- isolated;
- maintainable;
- compatible with existing production deployments.

Only critical defects SHOULD be corrected during migration.

New business functionality SHALL be implemented exclusively within Version 2.0 bounded contexts.

---

## Data Migration

Where existing business data requires migration:

- migration SHALL be repeatable;
- migration SHALL be idempotent;
- migration SHALL be logged;
- migration SHALL be validated.

Migration SHALL preserve historical information.

Business history SHALL never be discarded.

---

## Migration Scripts

Migration scripts SHALL remain independent from application startup.

Recommended structure:

```text
apps/api/src/scripts/

    migrate/

    seed/

    verify/
```

Migration SHALL be executable on demand.

---

## Verification After Migration

Every migration step SHALL verify:

- collection integrity;
- index integrity;
- aggregate consistency;
- projection rebuild;
- event publication.

Migration SHALL be considered complete only after successful verification.

---

## Legacy Retirement

Legacy implementation SHALL be retired only after:

- replacement implementation is production-ready;
- automated tests succeed;
- deployment validation succeeds;
- production monitoring confirms stability.

Deletion SHALL occur in dedicated Pull Requests.

---

# Section 21 — Implementation Risks

Backend implementation introduces technical and operational risks that SHALL be actively managed throughout development.

Risk management supports predictable delivery while preserving repository quality.

---

## Risk Assessment Principles

Each identified risk includes:

- description;
- likelihood;
- impact;
- mitigation strategy;
- ownership.

Risks SHALL be reviewed throughout implementation.

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Legacy coupling delays implementation | Medium | High | Isolate legacy modules |
| R2 | Event infrastructure defects | Medium | High | Integration testing |
| R3 | Projection inconsistency | Medium | Medium | Replay capability |
| R4 | Authorization defects | Low | High | Policy testing |
| R5 | Repository drift | Medium | Medium | Specification-first workflow |
| R6 | Incomplete migration | Low | High | Incremental rollout |
| R7 | CI instability | Low | Medium | Progressive pipeline adoption |
| R8 | Performance degradation | Low | Medium | Operational monitoring |

---

## Technical Risks

Technical risks include:

- aggregate inconsistency;
- duplicate event publication;
- projection lag;
- database schema drift;
- dependency coupling;
- deployment failures.

Technical risks SHALL be mitigated through automated validation.

---

## Operational Risks

Operational risks include:

- service outages;
- configuration errors;
- deployment failures;
- infrastructure instability;
- insufficient observability.

Operational risks SHALL be reduced through health monitoring and deployment verification.

---

## Architectural Risks

Architectural risks include:

- deviation from Blueprint;
- unauthorized event names;
- cross-context dependencies;
- aggregate ownership violations;
- duplicated business logic.

Architectural risks SHALL be detected through code review and implementation governance.

---

## Risk Review

Risk assessment SHALL be updated whenever:

- a new bounded context is introduced;
- architecture changes through ADR;
- deployment strategy changes;
- implementation priorities change.

---

# Section 22 — Architecture Decision Register

Some implementation decisions require explicit architectural governance.

The following register distinguishes resolved architectural decisions from implementation configuration choices.

---

## Decision Categories

| Category | Description |
|----------|-------------|
| RESOLVED | Approved architectural decision |
| IMPLEMENTATION CONFIGURATION | Technical implementation choice |
| ADR REQUIRED | Requires Architecture Decision Record |
| DEFERRED | Outside MVP scope |

---

## Current Decision Register

| Decision | Status |
|----------|--------|
| Activity-first architecture | RESOLVED |
| Modular monolith | RESOLVED |
| Transactional Outbox | RESOLVED |
| CQRS projections | RESOLVED |
| MongoDB persistence | RESOLVED |
| REST API | RESOLVED |
| Validation library selection | IMPLEMENTATION CONFIGURATION |
| Logging framework | IMPLEMENTATION CONFIGURATION |
| Testing utilities | IMPLEMENTATION CONFIGURATION |
| External message broker | DEFERRED |
| Microservices | DEFERRED |

---

## Decisions Requiring ADR

The following implementation changes SHALL require an approved Architecture Decision Record before implementation:

- introduction of a new bounded context;
- modification of aggregate ownership;
- Catalogue Event changes;
- repository architecture changes;
- distributed deployment architecture;
- external messaging infrastructure.

No architectural implementation SHALL bypass ADR governance.

---

## Implementation Configuration

Implementation configuration MAY determine:

- validation library;
- logging framework;
- testing utilities;
- formatting tools;
- dependency versions.

Implementation configuration SHALL NOT alter architectural principles.

---

# Section 23 — Definition of Done

The Definition of Done establishes the minimum quality standard required before implementation is considered complete.

Completion requires architectural compliance rather than functional completion alone.

---

## Command Definition of Done

Every command SHALL include:

- authorization;
- validation;
- aggregate execution;
- persistence;
- Catalogue Event publication;
- automated tests.

---

## Aggregate Definition of Done

Every aggregate SHALL provide:

- invariants;
- state transitions;
- repository;
- event publication;
- unit tests.

---

## Bounded Context Definition of Done

Every bounded context SHALL include:

- aggregate;
- commands;
- repositories;
- API routes;
- authorization;
- persistence;
- projections;
- integration tests;
- contract tests.

---

## Vertical Slice Definition of Done

Every completed slice SHALL include:

- deployable functionality;
- passing tests;
- synchronized documentation;
- operational validation;
- CI success.

---

## MVP Backend Definition of Done

The backend MVP is complete only when:

- the complete civic lifecycle executes successfully;
- Catalogue Events comply with Blueprint v2.0;
- projections operate correctly;
- deployment succeeds;
- health monitoring passes;
- CI pipeline succeeds;
- legacy functionality required for MVP has been replaced.

Partial implementation SHALL NOT be considered MVP completion.

# Section 24 — Implementation Governance

Implementation governance ensures that backend development remains aligned with the approved Humanity Union architecture throughout the entire lifecycle of the project.

Governance establishes mandatory implementation rules, repository quality standards, review requirements, and architectural safeguards.

These rules apply to every contributor, regardless of implementation experience or development tooling.

---

## Governance Objectives

Implementation governance SHALL ensure:

- architectural consistency;
- repository maintainability;
- specification compliance;
- implementation traceability;
- predictable code quality;
- long-term sustainability.

Governance protects architecture from gradual implementation drift.

---

## Governance Principles

Backend implementation SHALL follow these principles.

### Specification Before Implementation

Every implementation begins with an approved specification.

Developers SHALL NOT implement undocumented functionality.

---

### Architecture Before Optimization

Architectural correctness always takes precedence over premature optimization.

Performance improvements SHALL NOT compromise architectural integrity.

---

### Incremental Delivery

Implementation progresses through complete Vertical Slices.

Large unfinished feature branches SHOULD be avoided.

---

### Repository Stability

Every completed Pull Request SHALL leave the repository in a deployable state.

Broken builds SHALL never be merged.

---

### Continuous Documentation

Documentation SHALL evolve together with implementation.

Implementation SHALL NOT become the only source of truth.

---

## Mandatory Repository Rules

| Rule | Requirement |
|------|-------------|
| Specification-first | Module Specification updated before implementation |
| ADR governance | Architectural changes require ADR approval |
| Catalogue protection | Event names SHALL exactly match the Catalogue |
| Aggregate ownership | One aggregate owned by one bounded context |
| Cross-context isolation | No direct repository access across contexts |
| Vertical Slice completion | Partial implementation is prohibited |
| Automated testing | Required for every new command |
| Documentation synchronization | Specifications remain current |
| Legacy isolation | Legacy modules SHALL remain isolated |
| MVP discipline | Deferred functionality SHALL remain deferred |

These rules are mandatory.

---

## Pull Request Requirements

Every Pull Request SHALL demonstrate:

- successful compilation;
- passing automated tests;
- documentation updates;
- architectural compliance;
- no deprecated Catalogue Events;
- no cross-context repository writes.

Review SHALL focus on correctness rather than implementation style.

---

## Code Review Checklist

Every review SHOULD verify:

### Architecture

- bounded context ownership;
- aggregate ownership;
- dependency direction;
- CQRS compliance.

---

### Business Logic

- invariant enforcement;
- lifecycle correctness;
- authorization;
- event publication.

---

### Infrastructure

- persistence;
- Transactional Outbox;
- projection updates;
- logging;
- health.

---

### Testing

- unit tests;
- integration tests;
- contract tests;
- event validation.

---

### Documentation

- specification updated;
- implementation plan remains valid;
- API documentation synchronized.

---

## Repository Drift Detection

Repository drift SHALL be monitored continuously.

Examples include:

- deprecated Catalogue Events;
- duplicated business rules;
- unauthorized dependencies;
- obsolete projections;
- abandoned feature flags.

Architectural drift SHALL be corrected before introducing new functionality.

---

## Deferred Feature Policy

Deferred functionality SHALL be clearly identified.

Recommended marker:

```text
# MVP-DEFERRED
```

Deferred implementation SHALL reference:

- Blueprint;
- Module Specification;
- future roadmap.

Incomplete implementation SHALL NOT be partially introduced into production modules.

---

## Governance Responsibilities

| Role | Responsibility |
|------|----------------|
| Software Architect | Architectural integrity |
| Technical Lead | Implementation planning |
| Backend Developer | Specification compliance |
| Reviewer | Quality verification |
| Contributor | Repository consistency |
| AI-assisted Development Tools | Implementation support only |

Architectural authority remains external to implementation.

---

# Section 25 — Final Implementation Roadmap

This roadmap summarizes the complete backend implementation sequence required to deliver the Humanity Union MVP.

Each milestone represents a production-quality implementation increment.

---

## Roadmap Principles

The roadmap follows:

- approved Member Journey;
- Activity-first architecture;
- Vertical Slice implementation;
- incremental repository modernization.

No milestone depends upon incomplete future implementation.

---

## Milestone Roadmap

| Milestone | Deliverable | Dependencies | Validation |
|-----------|-------------|--------------|------------|
| **M0** | Backend foundation | None | Health endpoint |
| **M1** | Member lifecycle | M0 | MemberRegistered |
| **M2** | Event infrastructure | M1 | Outbox + Dispatcher |
| **M3** | Workspace | M2 | Projection validation |
| **M4** | Activity | M3 | ActivityCreated |
| **M5** | Discussion | M4 | DiscussionOpened |
| **M6** | Proposal | M5 | ProposalSubmitted |
| **M7** | Decision | M6 | DecisionApproved |
| **M8** | Implementation | M7 | ImplementationCompleted |
| **M9** | Impact Assessment | M8 | ImpactRecorded |
| **M10** | Inbox & Notifications | M9 | Projection validation |
| **M11** | End-to-End MVP | M10 | Complete civic lifecycle |

---

## Critical Path

The critical implementation sequence is:

```text
Foundation

↓

Member

↓

Events

↓

Workspace

↓

Activity

↓

Discussion

↓

Proposal

↓

Decision

↓

Implementation

↓

Impact

↓

MVP Validation
```

This path minimizes implementation risk while maximizing repository stability.

---

## MVP Completion Checklist

The backend MVP SHALL satisfy all of the following:

- Complete Member lifecycle
- Complete Activity lifecycle
- Complete civic workflow
- Transactional Outbox operational
- Catalogue Events implemented
- CQRS projections operational
- Authorization complete
- Integration tests passing
- Contract tests passing
- End-to-End validation passing
- CI pipeline green
- Deployment validated
- Operational monitoring enabled

Completion requires every item above.

---

# Appendices

---

# Appendix A — Repository Assessment Matrix

*(See Section 2.)*

---

# Appendix B — Backend Module Matrix

| Module | Specification | Priority | Status |
|---------|---------------|----------|--------|
| Member | Module 01 | P0 | Partial |
| Workspace | Module 01 | P0 | Partial |
| Activity | Module 02 | P0 | Missing |
| Discussion | Module 03 | P0 | Missing |
| Proposal | Module 04 | P0 | Missing |
| Decision | Module 05 | P0 | Missing |
| Implementation | Module 06 | P0 | Missing |
| ImpactAssessment | Module 07 | P0 | Missing |
| Inbox | Module 01 | P0 | Missing |
| Notifications | Module 01 | P1 | Partial |
| Audit | Engineering Standards | P1 | Missing |

---

# Appendix C — Aggregate Matrix

| Aggregate | Collection |
|-----------|------------|
| Member | members |
| Activity | activities |
| Discussion | discussions |
| Proposal | proposals |
| Decision | decisions |
| Implementation | implementations |
| ImpactAssessment | impact_assessments |

---

# Appendix D — Catalogue Event Matrix

*(See Section 9.)*

---

# Appendix E — Projection Matrix

| Projection | Collection |
|------------|------------|
| Workspace | workspace_member_summary |
| Activity | activity_projections |
| Inbox | inbox_items |
| Audit | audit_log |

---

# Appendix F — API Matrix

*(See Section 11.)*

---

# Appendix G — Vertical Slice Matrix

*(See Section 12.)*

---

# Appendix H — Sprint Matrix

*(See Section 13.)*

---

# Appendix I — Testing Matrix

| Layer | Primary Tool |
|--------|--------------|
| Unit | node:test |
| Integration | node:test + MongoDB |
| Contract | node:test |
| End-to-End | tsx scripts |

---

# Appendix J — Environment Matrix

*(See Section 18.)*

---

# Appendix K — Risk Register

*(See Section 21.)*

---

# Appendix L — Architecture Decision Register

*(See Section 22.)*

---

# Appendix M — Definition of Done

*(See Section 23.)*

---

# Final Assessment

## Repository Readiness

The existing repository provides a mature operational foundation suitable for incremental modernization.

Core infrastructure—including Express, MongoDB, authentication, configuration, and deployment—remains reusable.

The primary implementation gap is the absence of the normative Blueprint v2.0 Civic Chain.

---

## Architecture Readiness

Blueprint v2.0, Engineering Standards v2.0, the Member Journey Specification, and the Module Specifications collectively provide a complete architectural foundation for implementation.

No additional architectural design work is required before backend development proceeds.

---

## Implementation Readiness

The backend implementation strategy defined in this document provides:

- repository assessment;
- implementation sequencing;
- module ownership;
- persistence architecture;
- event infrastructure;
- testing strategy;
- deployment strategy;
- governance;
- operational guidance.

The implementation roadmap is complete and executable.

---

## Immediate Next Action

Backend implementation SHALL begin with **Sprint 1** as defined in Section 14.

Sprint 1 establishes:

- Member persistence;
- Transactional Outbox;
- Catalogue Event publication;
- structured logging;
- correlation identifiers;
- automated integration testing.

Completion of Sprint 1 provides the architectural foundation required for all subsequent Vertical Slices.

---

# Final Status

## **READY FOR IMPLEMENTATION**

This document constitutes the authoritative backend implementation roadmap for Humanity Union Version 2.0.

It translates the approved platform architecture into an executable engineering plan while preserving strict alignment with:

- Humanity Union Constitution v2.0;
- Blueprint v2.0;
- Engineering Standards v2.0;
- Member Journey Specification v2.0;
- Module Specifications 01–07;
- approved Architecture Decision Records (ADR).

Implementation SHALL proceed incrementally through the defined Vertical Slices, following the governance, quality standards, and execution strategy established throughout this document.