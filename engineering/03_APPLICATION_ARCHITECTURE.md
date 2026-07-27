# Humanity Union Application Architecture

## Version 2.0

### Normative Engineering Standard

---

# Executive Summary

This document defines the **Application Layer** of the Humanity Union Platform.

The Application Layer coordinates business use cases while preserving the integrity of the Domain Model.

It acts as the bridge between external interfaces (Web UI, Mobile Applications, APIs, Background Workers) and the business domain.

The Application Layer:

- receives requests;
- validates application-level rules;
- coordinates domain objects;
- executes business use cases;
- manages transactions;
- persists Aggregate state;
- publishes Domain Events;
- orchestrates communication between Bounded Contexts.

The Application Layer **does not contain business rules**.

Business rules belong exclusively to the Domain Layer.

---

## Status

Normative Engineering Standard

---

## Scope

This document defines:

- Application Layer responsibilities;
- Application Services;
- Commands;
- Queries;
- CQRS principles;
- transaction boundaries;
- Repository usage;
- orchestration patterns;
- Domain Service interaction;
- event publication;
- application workflow coordination.

This document intentionally excludes:

- REST API design;
- GraphQL schema;
- HTTP endpoints;
- UI implementation;
- database schemas;
- infrastructure technologies;
- cloud deployment.

---

## Architectural Authority

This document derives its authority from:

1. Humanity Union Blueprint
2. Humanity Union Constitution
3. Charter of Ethical Technology
4. Ubiquitous Language
5. System Architecture
6. Domain Model
7. Canonical Event Catalogue

The Application Layer must never contradict these documents.

---

## Related Normative Documents

- `00_UBIQUITOUS_LANGUAGE.md`
- `01_SYSTEM_ARCHITECTURE.md`
- `02_DOMAIN_MODEL.md`
- `CANONICAL_EVENT_CATALOGUE.md`
- `04_API_ARCHITECTURE.md`
- `05_DATABASE_STRATEGY.md`
- `06_EVENT_ARCHITECTURE.md`

---

# Table of Contents

1. Executive Summary
2. Application Layer Purpose
3. Architectural Principles
4. Clean Architecture
5. Layer Responsibilities
6. Application Services
7. Commands
8. Queries
9. CQRS
10. Transaction Boundaries
11. Repository Pattern
12. Domain Service Interaction
13. Application Workflows
14. Cross-Context Orchestration
15. Event Publication
16. Outbox Pattern
17. Read Models
18. Validation Strategy
19. Error Handling
20. Idempotency
21. Engineering Rules
22. Architecture Diagrams
23. Anti-Patterns
24. Related Documents
25. Verification
26. Document Metadata

---

# 1. Application Layer Purpose

The Application Layer coordinates business execution.

It is responsible for transforming external requests into business operations while preserving Domain integrity.

The Application Layer is the only layer allowed to orchestrate multiple Aggregates and Bounded Contexts.

---

## Responsibilities

The Application Layer shall:

- receive Commands;
- execute Queries;
- invoke Application Services;
- load Aggregates;
- coordinate Domain Services;
- manage transactions;
- persist changes;
- publish Domain Events;
- invoke Infrastructure through interfaces;
- return results to clients.

---

## The Application Layer Never

The Application Layer shall never:

- contain business rules;
- modify Aggregate internals directly;
- bypass Aggregate invariants;
- access databases directly;
- publish Integration Events directly;
- implement UI logic;
- implement infrastructure logic.

---

## Primary Goal

The primary goal of the Application Layer is to coordinate business execution without owning business knowledge.

Business decisions remain inside the Domain Layer.

---

# 2. Core Architectural Principles

The Humanity Union Application Layer follows the principles of:

- Domain-Driven Design (DDD)
- Clean Architecture
- Hexagonal Architecture
- Command Query Responsibility Segregation (CQRS)
- Event-Driven Architecture (EDA)
- Dependency Inversion Principle (DIP)

---

## Principle 1 — Application Coordinates

Application Services coordinate execution.

They do not make business decisions.

---

## Principle 2 — Domain Decides

Aggregates evaluate business rules.

Only Aggregates may change business state.

---

## Principle 3 — Infrastructure Supports

Infrastructure provides technical capabilities.

Infrastructure never owns business logic.

---

## Principle 4 — Dependencies Point Inward

Dependencies always point toward the Domain Layer.

```text
Presentation

↓

Application

↓

Domain

↑

Infrastructure
```

Infrastructure depends on Application.

Application depends on Domain.

Domain depends on nothing.

---

## Principle 5 — Business First

Business language always takes precedence over technology.

Application Services are named using Ubiquitous Language.

Examples:

```text
Create Initiative

Submit Proposal

Open Petition

Start Decision Session

Publish Decision

Start Implementation
```

---

# 3. Clean Architecture

The Humanity Union Platform follows Clean Architecture.

---

## Layer Structure

```text
Presentation Layer

↓

Application Layer

↓

Domain Layer

↓

Infrastructure Layer
```

---

## Layer Responsibilities

| Layer | Responsibility |
|--------|----------------|
| Presentation | User interaction |
| Application | Use case orchestration |
| Domain | Business rules |
| Infrastructure | Technical implementation |

---

## Dependency Rule

Source code dependencies always point toward the Domain Layer.

```text
Presentation

↓

Application

↓

Domain

↑

Infrastructure
```

The Domain Layer remains independent of every technical implementation.

---

# 4. Layer Responsibilities

---

## Presentation Layer

Responsible for:

- HTTP requests;
- GraphQL requests;
- WebSocket communication;
- Mobile applications;
- administrative interfaces.

Presentation never:

- modifies Aggregates;
- accesses repositories;
- executes business logic.

---

## Application Layer

Responsible for:

- use cases;
- orchestration;
- transactions;
- repository coordination;
- event publication.

Application never:

- owns business rules;
- validates domain invariants.

---

## Domain Layer

Responsible for:

- business rules;
- Aggregates;
- Entities;
- Value Objects;
- Domain Services;
- Domain Events.

The Domain Layer is the heart of the platform.

---

## Infrastructure Layer

Responsible for:

- persistence;
- messaging;
- email;
- search;
- storage;
- authentication providers;
- cloud services.

Infrastructure never owns business knowledge.

---

# 5. Relationship to the Domain Model

Every Application Service coordinates one or more Domain Aggregates.

Application Services never replace Aggregates.

Instead they coordinate them.

---

## Example

```text
Participant

↓

Submit Proposal

↓

Initiative Application Service

↓

Initiative Aggregate

↓

ProposalSubmitted

↓

Repository

↓

Commit

↓

Domain Event
```

---

## Cross-Context Example

```text
ProposalSubmitted

↓

Governance Application Service

↓

Decision Session Aggregate

↓

DecisionSessionStarted
```

Notice that:

- the Initiative Aggregate publishes `ProposalSubmitted`;
- the Governance Application Service reacts to it;
- the Governance Aggregate publishes `DecisionSessionStarted`.

No Aggregate directly invokes another Aggregate.

---

# 6. Application Layer Principles

Every Application Service follows the same execution model.

```text
Receive Command

↓

Load Aggregate(s)

↓

Execute Domain Operation

↓

Persist Changes

↓

Publish Domain Events

↓

Return Result
```

Application Services coordinate.

Aggregates decide.

Repositories persist.

Infrastructure delivers.

---

## Engineering Constraints

The Application Layer shall never:

- bypass Aggregate invariants;
- call another Aggregate directly;
- expose persistence details;
- depend on frameworks;
- contain duplicated business logic.

Every business operation must pass through an Application Service.

---

# 7. Application Services

Application Services coordinate business use cases.

They define the execution flow of the application while delegating all business decisions to the Domain Layer.

Application Services serve as the entry point for every business operation.

---

## Responsibilities

Application Services shall:

- receive Commands;
- execute Queries;
- load Aggregates;
- coordinate multiple Aggregates when necessary;
- invoke Domain Services;
- manage transaction boundaries;
- persist Aggregate state;
- publish Domain Events;
- return application results.

---

## Application Services Never

Application Services shall never:

- contain business rules;
- validate Aggregate invariants;
- modify Aggregate state directly;
- perform persistence without Repositories;
- communicate directly with databases;
- implement infrastructure concerns.

---

## Naming Convention

Application Services use business-oriented names.

Examples:

```text
InitiativeApplicationService

GovernanceApplicationService

ImplementationApplicationService

InstitutionApplicationService

MembershipApplicationService
```

Each service owns one business capability.

---

## Service Granularity

Application Services are organized around use cases—not technical operations.

Good examples:

```text
Create Initiative

Submit Proposal

Open Petition

Start Decision Session

Cast Vote

Publish Decision

Start Implementation

Publish Impact Report
```

Poor examples:

```text
UpdateDatabase

SaveProposal

ExecuteSQL

KafkaPublisher

NotificationManager
```

---

# 8. Commands

Commands express the intention to perform a business operation.

A Command requests change.

A Command does not guarantee success.

Only successful execution produces a Domain Event.

---

## Command Principles

Commands:

- express intent;
- target one business use case;
- may be rejected;
- are validated before execution;
- never represent historical facts.

---

## Command Naming

Commands use imperative verbs.

Examples:

```text
RegisterParticipantCommand

GrantMembershipCommand

CreateInitiativeCommand

SubmitProposalCommand

OpenPetitionCommand

RecordCollectiveSignalCommand

StartDecisionSessionCommand

OpenVotingCommand

CloseVotingCommand

PublishDecisionCommand

StartImplementationCommand

CompleteImplementationCommand

PublishImpactReportCommand
```

---

## Command Lifecycle

```text
Receive Command

↓

Validate Request

↓

Load Aggregate

↓

Execute Domain Operation

↓

Persist State

↓

Raise Domain Events

↓

Return Result
```

---

## Command Validation

Validation occurs at three levels.

| Level | Responsibility |
|---------|---------------|
| Presentation | Request format |
| Application | Authorization, permissions, existence checks |
| Domain | Business invariants |

---

## Command Outcome

Commands may produce:

- success;
- validation failure;
- authorization failure;
- business rule violation;
- concurrency conflict.

Only successful Commands produce Domain Events.

---

# 9. Queries

Queries retrieve information.

Queries never modify business state.

Queries never produce Domain Events.

---

## Query Principles

Queries:

- are read-only;
- return projections;
- may aggregate data;
- may use specialized read models;
- never invoke Aggregate mutations.

---

## Query Naming

Examples:

```text
GetParticipantProfileQuery

GetInitiativeQuery

SearchInitiativesQuery

GetWorkingGroupQuery

GetDecisionSessionQuery

SearchInstitutionsQuery

GetImpactReportQuery
```

---

## Query Pipeline

```text
Receive Query

↓

Validate Request

↓

Read Projection

↓

Transform Result

↓

Return Response
```

---

## Query Sources

Queries may retrieve data from:

- Read Models;
- Search Index;
- Projection Database;
- Analytics Store;
- Institutional Memory.

Queries should avoid loading Aggregates unless necessary.

---

# 10. Command Query Responsibility Segregation (CQRS)

The Humanity Union Platform follows CQRS.

Commands and Queries have different responsibilities.

---

## Command Side

Responsible for:

- business execution;
- Aggregate coordination;
- Domain Events;
- transactions.

---

## Query Side

Responsible for:

- information retrieval;
- optimized projections;
- search;
- analytics.

---

## CQRS Overview

```text
             Commands

Participant

↓

Application Service

↓

Aggregate

↓

Repository

↓

Domain Event



             Queries

Participant

↓

Query Handler

↓

Projection

↓

Response
```

---

## CQRS Principles

Commands:

- modify state;
- publish events;
- require transactions.

Queries:

- never modify state;
- never publish events;
- optimize read performance.

---

# 11. Command Pipeline

Every Command follows the same execution model.

---

## Standard Pipeline

```text
Receive Command

↓

Authentication

↓

Authorization

↓

Application Validation

↓

Load Aggregate

↓

Execute Domain Logic

↓

Persist Aggregate

↓

Commit Transaction

↓

Publish Domain Events

↓

Return Result
```

---

## Pipeline Responsibilities

| Stage | Responsibility |
|--------|----------------|
| Authentication | Verify participant identity |
| Authorization | Verify permissions |
| Validation | Validate request |
| Aggregate Loading | Restore current state |
| Domain Execution | Apply business rules |
| Persistence | Save Aggregate |
| Event Publication | Publish Domain Events |
| Response | Return application result |

---

## Transaction Boundary

Everything from Aggregate loading through persistence occurs within a single transaction.

Domain Events are published only after successful commit.

---

# 12. Query Pipeline

Queries follow a simplified execution model.

---

## Standard Pipeline

```text
Receive Query

↓

Authentication

↓

Authorization

↓

Read Projection

↓

Transform Result

↓

Return Response
```

---

## Query Characteristics

Queries:

- are stateless;
- never open business transactions;
- never publish events;
- may use caching;
- may combine multiple projections.

---

## Projection Strategy

Query handlers should prefer:

- Search Indexes;
- Read Models;
- Materialized Views;
- Analytics Stores.

Aggregate loading should be avoided unless business consistency requires it.

---

# 13. Command and Query Separation

The Humanity Union Platform enforces strict separation.

---

| Concern | Command | Query |
|----------|---------|-------|
| Changes State | ✓ | ✗ |
| Reads Data | ✓ (when needed) | ✓ |
| Publishes Domain Events | ✓ | ✗ |
| Opens Transaction | ✓ | ✗ |
| Uses Aggregate | ✓ | Rarely |
| Uses Read Models | Optional | Primary |
| Produces Business Facts | ✓ | ✗ |

---

## Engineering Rule

A single request must never both:

- modify business state;
- return complex analytical projections.

If both behaviors are required:

1. execute the Command;
2. publish Domain Events;
3. update projections;
4. execute a separate Query.

This preserves CQRS separation and simplifies scalability.

---

# 14. Business Workflow Orchestration

The Application Layer is responsible for orchestrating business workflows.

A workflow coordinates multiple business operations while ensuring that each Aggregate preserves its own consistency boundaries.

Application Services orchestrate.

Aggregates make business decisions.

Repositories persist state.

Infrastructure delivers technical capabilities.

---

## Workflow Principles

Every business workflow shall:

- begin with a Command;
- execute within one Application Service;
- invoke one or more Aggregates when necessary;
- preserve Aggregate boundaries;
- publish Domain Events after successful persistence;
- never bypass Aggregate invariants.

---

## Workflow Ownership

The Application Layer owns:

- workflow orchestration;
- execution order;
- transaction coordination;
- interaction between Bounded Contexts.

The Domain Layer owns:

- business rules;
- invariants;
- business decisions.

---

## Standard Business Workflow

```text
Participant

↓

Command

↓

Application Service

↓

Aggregate

↓

Business Rules

↓

Repository

↓

Commit

↓

Domain Event

↓

Outbox

↓

Integration Events
```

---

## Example — Initiative Creation

```text
Participant

↓

CreateInitiativeCommand

↓

InitiativeApplicationService

↓

Initiative Aggregate

↓

InitiativeCreated

↓

Repository

↓

Commit

↓

Domain Event Published
```

---

## Example — Proposal Submission

```text
Participant

↓

SubmitProposalCommand

↓

InitiativeApplicationService

↓

Initiative Aggregate

↓

ProposalSubmitted

↓

Repository

↓

Commit

↓

ProposalSubmitted Event
```

---

## Example — Governance Begins

```text
ProposalSubmitted

↓

GovernanceApplicationService

↓

DecisionSession Aggregate

↓

DecisionSessionStarted

↓

Repository

↓

Commit
```

Notice that:

The Initiative Aggregate never creates a Decision Session.

The Governance Application Service performs the orchestration.

---

# 15. Cross-Context Orchestration

Business workflows frequently span multiple Bounded Contexts.

The Application Layer coordinates this interaction.

Contexts remain independent.

---

## Cross-Context Rules

Application Services may:

- consume Domain Events;
- invoke Repositories;
- invoke Domain Services;
- start workflows in another Bounded Context.

Application Services shall never:

- directly modify another Aggregate;
- bypass another Context;
- access another Context's internal state.

---

## Cross-Context Flow

```text
Initiative

↓

ProposalSubmitted

↓

Governance

↓

DecisionSessionStarted

↓

CollectiveDecisionReached

↓

Implementation

↓

ImplementationStarted

↓

Impact Assessment

↓

ImpactReportPublished
```

Each Context owns its own Aggregates.

The Application Layer coordinates the transition.

---

## Context Independence

Bounded Contexts communicate only through:

- Commands;
- Domain Events;
- Integration Events.

Never through direct Aggregate manipulation.

---

# 16. Transaction Boundaries

A transaction represents one consistent business operation.

Transactions are managed exclusively by the Application Layer.

---

## Transaction Principles

Every transaction shall:

- load required Aggregates;
- execute business logic;
- persist changes;
- commit atomically;
- publish Domain Events after commit.

---

## Standard Transaction

```text
Begin Transaction

↓

Load Aggregate

↓

Business Operation

↓

Persist Changes

↓

Commit

↓

Publish Domain Events
```

---

## Transaction Scope

Transactions should remain as small as possible.

They should include:

- Aggregate loading;
- Aggregate execution;
- Repository persistence.

They should exclude:

- notification delivery;
- email sending;
- search indexing;
- analytics;
- AI facilitation.

Those concerns occur asynchronously.

---

## Aggregate Consistency

A transaction guarantees consistency only inside its Aggregate boundary.

Cross-Aggregate consistency is achieved through Domain Events.

---

# 17. Repository Pattern

Repositories provide persistence for Aggregate Roots.

Repositories abstract storage implementation from the Domain Layer.

---

## Repository Responsibilities

Repositories shall:

- retrieve Aggregates;
- persist Aggregates;
- support optimistic concurrency;
- hide infrastructure details.

Repositories shall never:

- implement business rules;
- orchestrate workflows;
- publish events.

---

## Repository Examples

```text
ParticipantRepository

MembershipRepository

InitiativeRepository

WorkingGroupRepository

DecisionSessionRepository

ImplementationRepository

InstitutionRepository

InstitutionalMemoryRepository
```

---

## Repository Usage

Application Services use Repositories.

Aggregates never access Repositories directly.

Example:

```text
Application Service

↓

Repository

↓

Aggregate

↓

Repository

↓

Commit
```

---

## Repository Principles

Repositories persist complete Aggregate Roots.

They never persist partial Aggregate state independently.

---

# 18. Domain Service Interaction

Some business operations cannot naturally belong to a single Aggregate.

These operations belong to Domain Services.

Application Services coordinate Domain Services.

---

## Domain Service Responsibilities

Domain Services encapsulate business logic that:

- spans multiple Entities;
- does not naturally belong to one Aggregate;
- remains part of the business domain.

---

## Application Service Interaction

```text
Application Service

↓

Load Aggregate

↓

Invoke Domain Service

↓

Update Aggregate

↓

Persist Aggregate
```

---

## Domain Service Principles

Domain Services:

- contain business knowledge;
- remain infrastructure independent;
- never coordinate transactions;
- never access databases directly.

---

## Examples

Possible Humanity Union Domain Services:

```text
ParticipationEligibilityService

GovernanceEligibilityService

CollectiveDecisionEvaluationService

InstitutionFormationService

ImpactEvaluationService
```

These services express business expertise.

They do not replace Aggregates.

---

# 19. Aggregate Coordination

Application Services may coordinate multiple Aggregates.

Each Aggregate remains responsible for its own consistency.

---

## Coordination Rules

Application Services may:

- load several Aggregates;
- invoke them sequentially;
- coordinate workflow execution.

Application Services shall never:

- merge Aggregate boundaries;
- bypass Aggregate invariants;
- expose Aggregate internals.

---

## Example

```text
Participant

↓

SubmitProposalCommand

↓

Initiative Aggregate

↓

ProposalSubmitted

↓

Governance Aggregate

↓

DecisionSessionStarted
```

Each Aggregate performs only its own responsibilities.

---

# 20. Workflow Consistency

Every workflow shall preserve:

- business consistency;
- Aggregate integrity;
- event ordering;
- transaction boundaries.

---

## Workflow Guarantees

The Application Layer guarantees:

- one business workflow per Command;
- deterministic execution;
- transactional consistency;
- reliable Domain Event publication;
- clear separation of responsibilities.

---

## Engineering Constraints

The Application Layer shall never:

- duplicate Domain logic;
- bypass Repositories;
- coordinate through Infrastructure;
- publish Integration Events before Domain Events;
- execute business logic inside Controllers.

Every workflow must remain deterministic, traceable, and fully aligned with the Domain Model.

---

# 21. Event Publication

The publication of Domain Events is a fundamental responsibility of the Application Layer.

Application Services ensure that every successfully completed business operation results in the publication of its corresponding Domain Events.

Application Services never create Domain Events directly.

Aggregates raise Domain Events.

The Application Layer coordinates their publication.

---

## Publication Principles

Every Domain Event shall be:

- raised by exactly one Aggregate;
- persisted together with Aggregate state;
- published only after a successful transaction commit;
- immutable after publication;
- available for downstream processing.

---

## Publication Pipeline

```text
Command

↓

Application Service

↓

Aggregate

↓

Domain Event Raised

↓

Repository

↓

Commit Transaction

↓

Outbox

↓

Event Publisher

↓

Integration Event

↓

Consumers
```

---

## Publication Guarantees

The Application Layer guarantees:

- Domain Events are never published before persistence.
- Failed transactions never publish events.
- Events preserve publication order within an Aggregate.
- Events remain immutable after publication.

---

# 22. Outbox Pattern

The Humanity Union Platform adopts the **Transactional Outbox Pattern** to guarantee reliable event publication.

The Outbox Pattern prevents inconsistencies between database commits and asynchronous event delivery.

---

## Why the Outbox Exists

Without an Outbox:

```text
Database Commit

↓

Network Failure

↓

No Event Published
```

The business state changes, but downstream systems never receive the event.

---

With an Outbox:

```text
Database Commit

↓

Store Domain Event

↓

Commit Transaction

↓

Asynchronous Publisher

↓

Integration Event
```

The business transaction completes successfully before publication begins.

---

## Outbox Responsibilities

The Outbox shall:

- store pending Domain Events;
- guarantee reliable publication;
- support retries;
- preserve ordering;
- ensure at-least-once delivery.

The Outbox shall never:

- evaluate business rules;
- modify Aggregate state;
- create Domain Events.

---

## Outbox Lifecycle

```text
Aggregate

↓

Raise Domain Event

↓

Persist Aggregate

↓

Persist Outbox Record

↓

Commit

↓

Publisher Reads Outbox

↓

Publish

↓

Mark as Delivered
```

---

# 23. Integration Events

Domain Events remain internal to the business domain.

Integration Events expose business facts to external consumers.

---

## Responsibilities

Integration Events:

- communicate across services;
- synchronize read models;
- update search indexes;
- notify external systems;
- trigger asynchronous workflows.

---

## Transformation

```text
Domain Event

↓

Integration Mapper

↓

Integration Event
```

Example:

```text
ProposalSubmitted

↓

integration.initiative.proposal-submitted.v1
```

---

## Principles

Integration Events:

- preserve Domain meaning;
- may evolve independently;
- never redefine business vocabulary.

Application Services coordinate publication.

Infrastructure performs delivery.

---

# 24. Read Models

Read Models optimize information retrieval.

They are derived from Domain Events.

Read Models never become authoritative business records.

---

## Responsibilities

Read Models:

- improve query performance;
- support CQRS;
- aggregate information;
- simplify reporting.

---

## Read Model Flow

```text
Domain Event

↓

Projection Handler

↓

Read Model

↓

Query
```

---

## Examples

Possible Humanity Union Read Models:

```text
Participant Profile

Initiative Summary

Proposal Overview

Decision Dashboard

Institution Directory

Implementation Timeline

Impact Report Summary
```

---

## Read Model Principles

Read Models:

- are disposable;
- can be rebuilt;
- never replace Aggregates;
- never own business rules.

---

# 25. Search Projections

The Search subsystem maintains optimized searchable representations of business information.

Search projections are derived exclusively from Domain Events.

---

## Projection Pipeline

```text
Domain Event

↓

Search Projection Handler

↓

Search Document

↓

Search Index
```

---

## Search Responsibilities

Search Projections:

- improve discoverability;
- support filtering;
- support multilingual indexing;
- support relevance ranking.

---

## Search Never

Search shall never:

- modify business state;
- execute business rules;
- publish Domain Events.

---

# 26. Notification Flow

Notifications are derived from business events.

Notifications are never business events themselves.

---

## Notification Pipeline

```text
Domain Event

↓

Notification Policy

↓

Notification Created

↓

Delivery

↓

Participant
```

---

## Responsibilities

Notification Policies determine:

- who should receive notifications;
- delivery channels;
- notification priority;
- localization;
- scheduling.

---

## Examples

```text
ProposalSubmitted

↓

Notify Governance Participants
```

```text
DecisionPublished

↓

Notify Interested Participants
```

```text
ImplementationCompleted

↓

Notify Initiative Followers
```

---

## Notification Principles

Notifications:

- react to business facts;
- never modify business state;
- may be retried independently.

---

# 27. AI Facilitation Flow

Artificial Intelligence assists Participants by consuming business events.

AI never exercises constitutional authority.

---

## AI Pipeline

```text
Domain Event

↓

AI Analysis

↓

Facilitation Output

↓

Participant
```

---

## AI Responsibilities

AI may:

- summarize discussions;
- recommend related initiatives;
- organize evidence;
- identify duplicate proposals;
- improve discoverability;
- generate analytical insights.

---

## AI Shall Never

AI shall never:

- approve Proposals;
- publish Collective Decisions;
- activate Membership;
- modify Institutions;
- change historical records;
- override Participants.

---

## AI Output

AI recommendations are advisory.

Participants and governing Institutions remain solely responsible for civic decisions.

---

# 28. Asynchronous Processing

Most downstream activities execute asynchronously.

Business transactions remain short and deterministic.

---

## Typical Asynchronous Consumers

```text
Search

Notifications

Analytics

Translation

Media Processing

AI Facilitation

Institutional Memory

Audit
```

---

## Asynchronous Principles

Asynchronous consumers:

- subscribe to Integration Events;
- execute independently;
- retry safely;
- remain idempotent.

---

# 29. Event Publication Guarantees

The Application Layer guarantees:

| Guarantee | Description |
|-----------|-------------|
| **Atomic Persistence** | Aggregate state and Outbox are committed together |
| **Reliable Publication** | Every committed Domain Event is eventually published |
| **Ordered Publication** | Events from the same Aggregate preserve sequence |
| **Idempotent Delivery** | Consumers safely process duplicate deliveries |
| **Business Consistency** | Domain state is always authoritative |
| **Infrastructure Independence** | Publication mechanism is replaceable without affecting business logic |

---

## Engineering Constraints

The Application Layer shall never:

- publish Integration Events before Domain Events;
- bypass the Outbox Pattern;
- invoke external systems inside business transactions;
- block transactions while waiting for asynchronous consumers;
- allow Platform Services to modify Aggregate state.

Every published event must remain fully traceable back to its originating Aggregate and business operation.

---

# 30. Validation Strategy

Validation ensures that every business operation is executed safely, consistently, and according to the responsibilities of each architectural layer.

Validation is performed progressively as a request moves through the system.

No single layer is responsible for all validation.

---

## Validation Layers

```text
Presentation

↓

Application

↓

Domain

↓

Infrastructure
```

Each layer validates only its own concerns.

---

## Presentation Validation

The Presentation Layer validates:

- request format;
- required fields;
- data types;
- value ranges;
- serialization;
- protocol compliance.

Examples:

- malformed JSON;
- invalid UUID;
- unsupported language;
- missing required field.

Presentation validation never evaluates business rules.

---

## Application Validation

The Application Layer validates:

- authentication;
- authorization;
- permissions;
- existence of referenced objects;
- workflow eligibility;
- application policies.

Examples:

- participant is authenticated;
- participant has active Membership;
- Initiative exists;
- participant has permission to vote;
- Decision Session is currently open.

Application validation never evaluates Aggregate invariants.

---

## Domain Validation

The Domain Layer validates:

- business rules;
- Aggregate invariants;
- lifecycle rules;
- business consistency.

Examples:

- Proposal cannot be submitted after Petition closure.
- Voting cannot close before opening.
- Membership cannot become Active twice.
- Decision cannot be published before voting concludes.

Only the Domain Layer owns business validation.

---

## Infrastructure Validation

Infrastructure validates technical concerns.

Examples:

- storage availability;
- message delivery;
- external service connectivity;
- encryption;
- authentication provider responses.

Infrastructure never evaluates business rules.

---

# 31. Authorization

Authorization determines whether a Participant may execute a requested business operation.

Authorization is performed before Aggregate execution.

---

## Authorization Pipeline

```text
Participant

↓

Authentication

↓

Authorization

↓

Application Service

↓

Aggregate
```

---

## Authorization Responsibilities

The Application Layer evaluates:

- identity;
- Membership status;
- assigned roles;
- delegated permissions;
- institutional authority;
- workflow participation.

---

## Authorization Sources

Authorization decisions may depend upon:

- Participant;
- Membership;
- Institution;
- Working Group;
- Initiative;
- Decision Session.

---

## Authorization Principles

Authorization shall be:

- explicit;
- deterministic;
- auditable;
- repeatable;
- independent of infrastructure.

---

# 32. Error Handling

Errors are categorized according to their origin.

Each architectural layer reports only its own errors.

---

## Error Categories

| Layer | Error Type |
|--------|------------|
| Presentation | Invalid request |
| Application | Authorization failure |
| Domain | Business rule violation |
| Infrastructure | Technical failure |

---

## Business Errors

Examples:

```text
ProposalAlreadySubmitted

MembershipInactive

VotingClosed

DecisionAlreadyPublished

ParticipantNotEligible
```

Business errors represent expected outcomes.

They are not system failures.

---

## Technical Errors

Examples:

```text
DatabaseUnavailable

MessageBrokerUnavailable

StorageTimeout

SearchIndexUnavailable
```

Technical failures may be retried.

Business rule violations shall never be retried automatically.

---

# 33. Idempotency

Commands must support safe retry whenever practical.

Repeated execution of the same request shall never produce duplicated business effects.

---

## Idempotent Command Principle

```text
Command

↓

Application Service

↓

Already Executed?

↓

Yes → Return Existing Result

↓

No → Execute Workflow
```

---

## Typical Idempotent Operations

Examples:

- Membership activation;
- Initiative creation;
- Proposal submission;
- Vote recording;
- Notification publication.

---

## Idempotency Keys

Application Services may use:

- Command Identifier;
- Correlation Identifier;
- Request Identifier;
- Business Identifier.

Idempotency mechanisms belong to the Application Layer.

---

# 34. Consistency Rules

Application Services preserve business consistency.

Consistency is achieved through:

- Aggregate boundaries;
- transactions;
- Domain Events;
- eventual consistency between Contexts.

---

## Immediate Consistency

Guaranteed inside one Aggregate.

```text
Command

↓

Aggregate

↓

Commit
```

---

## Eventual Consistency

Guaranteed between Bounded Contexts.

```text
Context A

↓

Domain Event

↓

Context B

↓

Application Service

↓

Aggregate

↓

Commit
```

---

## Consistency Principles

The Application Layer shall guarantee:

- deterministic execution;
- ordered workflows;
- transaction integrity;
- reliable event publication.

---

# 35. Architecture Diagrams

---

## Complete Command Flow

```text
Participant

↓

Presentation

↓

Command

↓

Application Service

↓

Repository

↓

Aggregate

↓

Business Rules

↓

Repository

↓

Commit

↓

Outbox

↓

Integration Event

↓

Platform Services
```

---

## CQRS Overview

```text
             COMMAND

Participant

↓

Application Service

↓

Aggregate

↓

Repository

↓

Domain Event



              QUERY

Participant

↓

Query Handler

↓

Read Model

↓

Response
```

---

## Cross-Context Workflow

```text
Participant

↓

Initiative

↓

ProposalSubmitted

↓

Governance

↓

DecisionSessionStarted

↓

CollectiveDecisionReached

↓

Implementation

↓

ImplementationStarted

↓

Impact Assessment

↓

ImpactReportPublished

↓

Institutional Memory
```

---

## Event Publication Pipeline

```text
Aggregate

↓

Domain Event

↓

Repository

↓

Commit

↓

Outbox

↓

Publisher

↓

Integration Event

↓

Search

Notifications

Analytics

Translation

AI

Institutional Memory
```

---

## Layer Interaction

```text
Presentation

↓

Application

↓

Domain

↑

Infrastructure
```

Dependencies always point toward the Domain Layer.

---

# 36. Anti-Patterns

The Humanity Union Platform explicitly prohibits the following architectural practices.

---

## Business Logic Inside Controllers

❌ Incorrect

```text
Controller

↓

Business Decision
```

Controllers shall only translate external requests.

---

## Repository Access from Presentation

❌ Incorrect

```text
Presentation

↓

Repository
```

All persistence must pass through Application Services.

---

## Aggregate-to-Aggregate Calls

❌ Incorrect

```text
Aggregate A

↓

Aggregate B
```

Aggregates never invoke one another.

Cross-Aggregate coordination belongs to the Application Layer.

---

## Infrastructure Owning Business Rules

❌ Incorrect

```text
Database

↓

Business Decision
```

Infrastructure never determines business behavior.

---

## Application Services Containing Business Rules

❌ Incorrect

```text
Application Service

↓

Business Rule
```

Business rules belong exclusively to the Domain Layer.

---

## Publishing Events Before Commit

❌ Incorrect

```text
Aggregate

↓

Publish Event

↓

Commit
```

Events shall be published only after a successful transaction commit.

---

## Shared Mutable State Between Contexts

❌ Incorrect

Two Bounded Contexts sharing the same mutable Aggregate.

Contexts communicate only through events and well-defined interfaces.

---

## Direct Database Integration Between Contexts

❌ Incorrect

```text
Context A

↓

Database

↓

Context B
```

Contexts never communicate through shared persistence.

---

# 37. Engineering Rules

Every Application Service shall:

- coordinate exactly one business use case;
- preserve Aggregate boundaries;
- execute inside a well-defined transaction;
- publish Domain Events after commit;
- remain independent of infrastructure technologies.

Every Aggregate shall:

- own its business consistency;
- enforce invariants;
- produce immutable Domain Events.

Every Repository shall:

- persist Aggregate Roots;
- abstract storage technology;
- never contain business logic.

Every business workflow shall remain:

- deterministic;
- traceable;
- testable;
- reproducible;
- aligned with the Domain Model.

---

# 30. Related Normative Documents

The Humanity Union Application Layer is defined within the broader engineering architecture of the platform.

This document shall be interpreted together with the following normative documents:

| Document | Purpose |
|-----------|---------|
| `00_UBIQUITOUS_LANGUAGE.md` | Defines the business vocabulary |
| `01_SYSTEM_ARCHITECTURE.md` | Defines platform structure and Bounded Contexts |
| `02_DOMAIN_MODEL.md` | Defines Aggregates, Entities, Value Objects, and Domain Services |
| `CANONICAL_EVENT_CATALOGUE.md` | Defines all Domain Events |
| `04_API_ARCHITECTURE.md` | Defines external application interfaces |
| `05_DATABASE_STRATEGY.md` | Defines persistence strategy |
| `06_EVENT_ARCHITECTURE.md` | Defines event transport and messaging |
| `07_PERMISSION_MODEL.md` | Defines authorization model |
| `08_NOTIFICATION_ARCHITECTURE.md` | Defines notification infrastructure |
| `09_SEARCH_ARCHITECTURE.md` | Defines search architecture |
| `10_AI_INTEGRATION.md` | Defines AI facilitation |
| `11_DEPLOYMENT_ARCHITECTURE.md` | Defines deployment architecture |

---

# 31. Architectural Dependency Hierarchy

The Humanity Union engineering documentation follows a layered dependency model.

Each document builds upon the previous one.

No document may redefine concepts introduced by an earlier document.

---

## Documentation Hierarchy

```text
Blueprint

↓

Constitution

↓

Charter of Ethical Technology

↓

Ubiquitous Language

↓

System Architecture

↓

Domain Model

↓

Canonical Event Catalogue

↓

Application Architecture

↓

API Architecture

↓

Database Strategy

↓

Event Architecture

↓

Permission Model

↓

Notification Architecture

↓

Search Architecture

↓

AI Integration

↓

Deployment Architecture
```

---

## Dependency Principles

Every engineering document shall:

- extend previous architectural decisions;
- never redefine business terminology;
- never contradict the Domain Model;
- preserve architectural consistency.

---

# 32. Guiding Principle

The Application Layer coordinates business execution.

It never owns business knowledge.

Business knowledge belongs exclusively to the Domain Layer.

Application Services orchestrate execution while respecting Aggregate boundaries, transaction consistency, and event-driven communication.

---

## Core Philosophy

The Humanity Union Platform separates responsibilities according to a single principle:

> **The Domain decides. The Application coordinates. Infrastructure delivers. Presentation communicates.**

This principle applies to every business workflow.

---

# 33. Architectural Principles Summary

The Application Layer follows these engineering principles:

- Domain-Driven Design (DDD)
- Clean Architecture
- Hexagonal Architecture
- CQRS
- Event-Driven Architecture
- Dependency Inversion
- Aggregate Consistency
- Transactional Integrity
- Reliable Event Publication
- Asynchronous Integration
- Infrastructure Independence

These principles are mandatory.

---

# 34. Application Layer Verification

Every implementation of the Application Layer shall satisfy the following criteria.

---

## Structural Verification

- Every business operation enters through an Application Service.
- Every Aggregate is accessed through a Repository.
- Every Command executes inside an Application Service.
- Every Query uses a Query Handler or Read Model.
- Business rules remain inside the Domain Layer.
- Infrastructure remains replaceable.

---

## Behavioral Verification

Every successful Command shall:

- load required Aggregate(s);
- execute Domain logic;
- persist state;
- commit transaction;
- publish Domain Events.

Every Query shall:

- remain read-only;
- avoid Aggregate mutation;
- return projections.

---

## Event Verification

Every Domain Event shall:

- originate from one Aggregate;
- be immutable;
- be persisted atomically with Aggregate state;
- be published after transaction commit;
- remain traceable throughout its lifecycle.

---

## Consistency Verification

The Application Layer shall guarantee:

- Aggregate consistency;
- deterministic workflows;
- transaction integrity;
- reliable event publication;
- bounded context isolation.

---

# 35. Engineering Compliance Checklist

An implementation complies with this specification if all of the following statements are true.

| Requirement | Status |
|-------------|--------|
| Commands handled by Application Services | □ |
| Queries separated from Commands | □ |
| CQRS respected | □ |
| Business rules isolated in Domain Layer | □ |
| Aggregate boundaries preserved | □ |
| Repositories used for persistence | □ |
| Transactions coordinated by Application Layer | □ |
| Domain Events published after commit | □ |
| Outbox Pattern implemented | □ |
| Read Models used for queries | □ |
| Cross-context communication event-driven | □ |
| Infrastructure independent of business rules | □ |

This checklist serves as an architectural verification tool during implementation and code review.

---

# 36. Future Evolution

The Application Layer is designed for long-term evolution.

Future versions may extend:

- orchestration patterns;
- workflow automation;
- distributed execution;
- Saga and Process Manager support;
- advanced scheduling;
- additional asynchronous processing mechanisms.

Future extensions shall preserve the principles defined in this document.

---

# 37. Document Metadata

| Property | Value |
|-----------|-------|
| Document | Humanity Union Application Architecture |
| Version | 2.0 |
| Status | Normative Engineering Standard |
| Classification | Core Architecture |
| Layer | Application Layer |
| Primary Audience | Software Architects, Backend Engineers, Technical Leads |
| Depends On | Ubiquitous Language, System Architecture, Domain Model, Canonical Event Catalogue |
| Followed By | API Architecture |

---

# Final Statement

This document defines the Application Layer of the Humanity Union Platform.

It establishes a single, consistent approach to application orchestration by separating business knowledge from execution coordination.

The principles defined herein ensure that:

- business rules remain exclusively within the Domain Layer;
- Application Services coordinate use cases without owning business logic;
- Aggregate boundaries are preserved;
- transactions remain consistent;
- Domain Events become the foundation of inter-context communication;
- infrastructure remains replaceable without affecting business behavior.

Together with the System Architecture, Domain Model, and Canonical Event Catalogue, this document forms the architectural foundation for all future implementation of the Humanity Union Platform.

---

## End of Document

**Document**

Humanity Union Application Architecture

**Version**

2.0

**Status**

Normative Engineering Standard

**Architectural Role**

Single Source of Truth for the Application Layer

**Defines**

- Application Services
- Commands
- Queries
- CQRS
- Workflow Orchestration
- Transaction Boundaries
- Repository Coordination
- Event Publication
- Outbox Pattern
- Read Models
- Cross-Context Coordination

**Normative Dependencies**

- Ubiquitous Language
- System Architecture
- Domain Model
- Canonical Event Catalogue

**Next Document**

`04_API_ARCHITECTURE.md`