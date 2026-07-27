# 12_APPLICATION_WORKFLOWS.md

## Version 2.1

### Normative Cross-Context Workflow Architecture for the Humanity Union Platform

---

# Executive Summary

This document defines the canonical cross-context application workflows of the Humanity Union Platform.

Application Workflows coordinate business execution across multiple bounded contexts while preserving domain ownership, aggregate consistency, explicit authorization, and human governance.

A workflow coordinates business activities.

It does not own business state.

It does not replace Aggregate behavior.

It does not redefine Domain rules.

Every business decision remains owned by the authoritative bounded context responsible for that decision.

Cross-context coordination is achieved exclusively through:

- public Application Services;
- Commands;
- Queries;
- Integration Events;
- permission-aware projections.

Application Workflows provide orchestration through business coordination—not through distributed transactions.

The platform follows an Event-Driven Architecture.

Every workflow is recoverable.

Every workflow is observable.

Every workflow is auditable.

Every workflow preserves human authority.

Artificial Intelligence participates only as an advisory capability as defined by **10_AI_INTEGRATION.md**.

Search remains projection-based as defined by **09_SEARCH_ARCHITECTURE.md**.

Deployment remains implementation infrastructure as defined by **11_DEPLOYMENT_ARCHITECTURE.md**.

---

# 1. Scope

This document defines:

- cross-context workflow coordination;
- business workflow boundaries;
- workflow lifecycle;
- workflow ownership;
- command sequencing;
- integration event coordination;
- workflow recovery;
- workflow observability;
- workflow traceability;
- workflow verification.

This document does **not** define:

- Aggregate behavior;
- Domain invariants;
- business policies;
- authorization rules;
- persistence;
- API contracts;
- deployment topology;
- infrastructure implementation.

Those responsibilities belong to their respective engineering standards.

---

# 2. Authority

This document is a normative engineering standard.

Every implementation of cross-context workflows shall comply with this specification.

Application Workflows coordinate business execution.

They never redefine Domain ownership.

When conflicts exist, authority shall be resolved in the following order:

1. Ubiquitous Language
2. System Architecture
3. Domain Model
4. Application Architecture
5. API Architecture
6. Database Strategy
7. Event Architecture
8. Permission Model
9. Notification Architecture
10. Search Architecture
11. AI Integration
12. Deployment Architecture
13. Application Workflows

Application Workflows depend upon all preceding architectural standards.

No preceding document depends upon Application Workflows.

---

# 3. Related Documents

This specification depends upon:

- **00_UBIQUITOUS_LANGUAGE.md**
- **01_SYSTEM_ARCHITECTURE.md**
- **02_DOMAIN_MODEL.md**
- **03_APPLICATION_ARCHITECTURE.md**
- **04_API_ARCHITECTURE.md**
- **05_DATABASE_STRATEGY.md**
- **06_EVENT_ARCHITECTURE.md**
- **07_PERMISSION_MODEL.md**
- **08_NOTIFICATION_ARCHITECTURE.md**
- **09_SEARCH_ARCHITECTURE.md**
- **10_AI_INTEGRATION.md**
- **11_DEPLOYMENT_ARCHITECTURE.md**

Application Workflows integrate these standards into executable business coordination.

---

# 4. Workflow Principles

The following principles govern every application workflow.

| Principle | Rule |
|-----------|------|
| Domain ownership remains local | Every Aggregate owns its own business decisions |
| Commands express intent | Commands request business actions |
| Events express completed facts | Domain Events describe completed business outcomes |
| Integration Events coordinate contexts | Cross-context communication never bypasses Application boundaries |
| Authorization precedes execution | Every privileged transition requires authorization |
| Eventual consistency accepted | Read Models may lag authoritative writes |
| Human authority preserved | AI never performs governance decisions |
| Search remains projection-based | Search never owns business state |
| Notifications remain derived | Notifications never create authority |
| Recoverability mandatory | Workflows must tolerate replay and retry |
| Traceability mandatory | Every workflow shall be auditable |

These principles are mandatory.

---

# 5. Workflow Model

Application Workflows coordinate bounded contexts through public architectural contracts.

Every workflow follows the same conceptual lifecycle.

```text
Participant

↓

Authorization

↓

Command

↓

Application Service

↓

Aggregate

↓

Domain Event

↓

Integration Event

↓

Workflow Continuation

↓

Read Models

↓

Notifications

↓

Search Projections

↓

AI Advisory

↓

Participant
```

Business ownership never leaves the authoritative Aggregate.

Workflow coordination shall never merge Aggregate responsibilities.

---

## 5.1 Workflow Stages

| Stage | Responsibility |
|--------|----------------|
| Trigger | Participant action or Integration Event |
| Authorization | Permission evaluation |
| Command | Business intent |
| Aggregate Execution | Business decision |
| Domain Event | Authoritative business fact |
| Integration Event | Cross-context communication |
| Workflow Continuation | Next bounded context |
| Projection Update | Read Model refresh |
| Notification | Participant communication |
| Search Update | Search Projection refresh |
| AI Advisory | Optional advisory assistance |
| Completion | Workflow terminates or continues |

Each stage has exactly one architectural responsibility.

---

# 6. Workflow Categories

Application Workflows are grouped into the following categories.

| Category | Purpose |
|----------|---------|
| Participant Workflows | Identity and civic participation |
| Initiative Workflows | Civic initiative lifecycle |
| Collaborative Analysis | Discussion, contributions, evidence |
| Proposal Workflows | Proposal preparation and submission |
| Petition Workflows | Public support collection |
| Decision Workflows | Decision Session and Collective Decision |
| Implementation Workflows | Execution of approved decisions |
| Impact Assessment | Outcome evaluation |
| Institutional Workflows | Institutions and Working Groups |
| Cross-Cutting Workflows | Search, Notification, AI, Translation |
| Operational Workflows | Recovery, observability, security |

Each workflow category owns its own coordination logic.

---

# 7. Canonical Collective Participation Journey

The Humanity Union Platform follows a single canonical civic lifecycle.

Every workflow belongs to one stage of this journey.

```text
Participant

↓

Initiative

↓

Collaborative Analysis

↓

Proposal

↓

Petition

↓

Decision Session

↓

Collective Decision

↓

Implementation

↓

Impact Assessment

↓

Institutional Memory
```

Not every Initiative reaches every stage.

Each transition is governed by its owning bounded context.

No workflow may bypass intermediate business authority.

---

# 8. Participant Registration and Workspace Initialization

## Business Objective

Establish a new Participant within the Humanity Union Platform.

Create an authenticated civic identity.

Initialize the Participant workspace.

Configure optional civic responsibility preferences.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Register | Participant | `RegisterParticipant` | `ParticipantRegistered` |
| Verify | Identity | Verification Process | `ParticipantVerified` |
| Configure | Participant | `UpdateCivicResponsibilityProfile` | `ResponsibilityProfileUpdated` |
| Initialize | Participant | `InitializeWorkspace` | `WorkspaceInitialized` |

---

## Registration Lifecycle

Registration, authentication, and verification remain distinct responsibilities.

| Responsibility | Purpose |
|---------------|---------|
| Registration | Creates Participant existence |
| Authentication | Establishes active session |
| Verification | Confirms identity trust level |

Authentication never replaces registration.

Verification never replaces registration.

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Authorization | Guests may register according to platform policy |
| Privacy | Civic Responsibility Profile remains private |
| Notifications | Welcome and verification messages are policy-driven |
| Search | Public profile indexed only when permitted |
| AI | No participation during registration |
| Audit | Registration fully traceable |

Participant existence begins with **ParticipantRegistered**.

No workflow may assume Participant existence beforehand.

---

# 9. Participant Profile and Civic Responsibility

Participant profile management remains independent from Civic Responsibility.

Public presentation and civic preferences represent separate business concerns.

---

## Commands

| Command | Context | Canonical Event |
|---------|---------|-----------------|
| UpdateProfile | Participant | `ParticipantProfileUpdated` |
| UpdateCivicResponsibilityProfile | Participant | `ResponsibilityProfileUpdated` |
| UpdateWorkspacePreferences | Participant | `WorkspacePreferencesUpdated` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Public Profile | Visible according to Visibility Policy |
| Civic Responsibility | Private by default |
| Notifications | Responsibility influences routing only |
| Search | Only authorized profile data projected |
| AI | Advisory recommendations only |
| Audit | Every profile change recorded |

Profile presentation never modifies civic authority.

Responsibility preferences never become public business state.

---

# 10. Initiative Workflow

## Business Objective

Establish a new civic Initiative.

An Initiative represents the authoritative entry point for collective civic participation.

Every Proposal, Petition, Decision Session, Implementation, and Impact Assessment shall be traceable to an originating Initiative.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Create | Initiative | `CreateInitiative` | `InitiativeCreated` |
| Update | Initiative | `ReviseInitiative` | `InitiativeRevised` |
| Suspend | Initiative | `SuspendInitiative` | `InitiativeSuspended` |
| Close | Initiative | `CloseInitiative` | `InitiativeClosed` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Ownership | Initiative Aggregate owns Initiative lifecycle |
| Authorization | Governed by Permission Model |
| Visibility | Controlled by Visibility Policy |
| Notifications | Responsibility-based |
| Search | Search Projection updated |
| AI | Advisory discovery only |
| Audit | Complete lifecycle recorded |

An Initiative owns its own lifecycle.

No foreign bounded context may modify Initiative state directly.

---

# 11. Collaborative Analysis Workflow

## Business Objective

Enable Participants to collaboratively analyze an Initiative through discussions, evidence, questions, contributions, and structured knowledge sharing.

Collaborative Analysis produces understanding.

It does not produce governance decisions.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Start | Collaborative Analysis | `StartCollaborativeAnalysis` | `CollaborativeAnalysisStarted` |
| Contribute | Collaborative Analysis | `AddContribution` | `ContributionAdded` |
| Add Evidence | Collaborative Analysis | `AddEvidence` | `EvidenceContributed` |
| Revise | Collaborative Analysis | `ReviseContribution` | `ContributionRevised` |
| Close | Collaborative Analysis | `CloseCollaborativeAnalysis` | `CollaborativeAnalysisClosed` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Participation | Governed by Participation Policy |
| Evidence | Append-only |
| Moderation | Human governed |
| Translation | Managed by Translation context |
| Notifications | Policy filtered |
| Search | Authorized Search Documents |
| AI | Advisory summarization only |

Collaborative Analysis never creates governance decisions.

---

# 12. Proposal Workflow

## Business Objective

Transform analyzed civic ideas into formal governance proposals.

Proposal preparation remains private until officially submitted.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Draft | Proposal | `CreateProposal` | *(internal state only)* |
| Revise | Proposal | `ReviseProposal` | *(internal state only)* |
| Submit | Proposal | `SubmitProposal` | `ProposalSubmitted` |
| Update | Proposal | `ReviseSubmittedProposal` | `ProposalRevised` |
| Withdraw | Proposal | `WithdrawProposal` | `ProposalWithdrawn` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Authors | Proposal Policy |
| Initiative | Every Proposal references one Initiative |
| Evidence | References Collaborative Analysis |
| Notifications | Review alerts |
| Search | Visibility controlled |
| AI | Draft assistance only |
| Audit | Revision history preserved |

No external Proposal exists before **ProposalSubmitted**.

---

# 13. Petition Workflow

## Business Objective

Collect public civic support for submitted Proposals.

Petitions measure civic support.

They do not approve governance decisions.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Open | Petition | `OpenPetition` | `PetitionOpened` |
| Support | Petition | `RecordPetitionSupport` | `PetitionSupportRecorded` |
| Withdraw Support | Petition | `WithdrawPetitionSupport` | `PetitionSupportWithdrawn` |
| Close | Petition | `ClosePetition` | `PetitionClosed` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Authorization | Verified Participants where required |
| Support | One support per Participant |
| Visibility | Public unless restricted |
| Notifications | Milestone alerts |
| Search | Search Projection updated |
| AI | Trend analysis only |
| Audit | Support history preserved |

Petition support never replaces formal voting.

---

# 14. Decision Session Workflow

## Business Objective

Coordinate formal governance review of submitted Proposals.

Decision Sessions evaluate Proposals.

They do not execute Implementation.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Open | Decision | `OpenDecisionSession` | `DecisionSessionOpened` |
| Review | Decision | `ReviewProposal` | *(internal evaluation)* |
| Close | Decision | `CloseDecisionSession` | `DecisionSessionClosed` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Authority | Human governance only |
| Eligibility | Decision Policy |
| Quorum | Defined by Decision context |
| AI | Advisory analysis only |
| Notifications | Review milestones |
| Search | Public outcomes only |
| Audit | Complete review trace |

Decision Sessions coordinate governance.

They never bypass authorization.

---

# 15. Collective Decision Workflow

## Business Objective

Produce authoritative governance outcomes.

Collective Decisions become authoritative business facts.

---

## Workflow Steps

| Outcome | Command | Canonical Event |
|----------|---------|-----------------|
| Approve | `ApproveDecision` | `DecisionApproved` |
| Reject | `RejectDecision` | `DecisionRejected` |
| Return | `ReturnDecisionForRevision` | `DecisionReturnedForRevision` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Authority | Human reviewers only |
| Voting | Governed by Decision Policy |
| Quorum | Aggregate invariant |
| Notifications | Outcome alerts |
| Search | Search Projection updated |
| Institutional Memory | Consumes decision outcomes |
| AI | Never approves or rejects |
| Audit | Governance decisions immutable |

Collective Decisions terminate Decision Sessions.

Implementation may begin only after an authorized **DecisionApproved** outcome.

---

# 16. Implementation Workflow

## Business Objective

Execute approved governance decisions.

Implementation performs business execution.

It does not evaluate impact.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Start | Implementation | `StartImplementation` | `ImplementationStarted` |
| Suspend | Implementation | `SuspendImplementation` | `ImplementationSuspended` |
| Resume | Implementation | `ResumeImplementation` | `ImplementationResumed` |
| Complete | Implementation | `CompleteImplementation` | `ImplementationCompleted` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Authorization | Requires approved Decision |
| Ownership | Implementation Aggregate |
| Working Groups | Participate by mandate |
| Institutions | Participate by mandate |
| Notifications | Milestones only |
| Search | Projection updated |
| AI | Progress assistance only |
| Audit | Linked to Decision and Initiative |

Completion of Implementation automatically enables Impact Assessment.

---

# 17. Impact Assessment Workflow

## Business Objective

Evaluate measurable outcomes produced by completed Implementations.

Impact Assessment measures results.

It never changes historical governance decisions.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Begin | Impact Assessment | `StartImpactAssessment` | `ImpactAssessmentStarted` |
| Record | Impact Assessment | `RecordImpactAssessment` | `ImpactRecorded` |
| Complete | Impact Assessment | `CompleteImpactAssessment` | `ImpactAssessmentCompleted` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Independence | Separate Aggregate |
| Evidence | References completed Implementation |
| Search | Search Projection updated |
| Institutional Memory | Receives completed assessment |
| Notifications | Final reports |
| AI | Analytical assistance only |
| Audit | Immutable measurements |

Impact Assessment concludes the operational lifecycle of an Initiative.

---

# 18. Working Group Workflow

## Business Objective

Create temporary operational teams responsible for executing clearly defined objectives within an Initiative.

Working Groups coordinate execution.

They do not become governing authorities.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Create | Working Group | `CreateWorkingGroup` | `WorkingGroupCreated` |
| Update | Working Group | `ReviseWorkingGroup` | `WorkingGroupRevised` |
| Suspend | Working Group | `SuspendWorkingGroup` | `WorkingGroupSuspended` |
| Close | Working Group | `CloseWorkingGroup` | `WorkingGroupClosed` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Authority | Limited to assigned mandate |
| Membership | Governed by Working Group policies |
| Permissions | Context-specific |
| Notifications | Lifecycle events only |
| Search | Visibility policy applies |
| AI | Coordination assistance only |
| Audit | Membership and actions recorded |

Working Groups never acquire permanent institutional authority.

---

# 19. Institution Workflow

## Business Objective

Create and manage permanent organizational structures responsible for long-term governance.

Institutions represent durable governance.

They are never created automatically.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Propose | Institution | `ProposeInstitution` | `InstitutionProposed` |
| Create | Institution | `CreateInstitution` | `InstitutionCreated` |
| Review | Institution | `ReviewInstitution` | `InstitutionReviewed` |
| Suspend | Institution | `SuspendInstitution` | `InstitutionSuspended` |
| Close | Institution | `CloseInstitution` | `InstitutionClosed` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Governance | Human authority only |
| Transparency | Public mandate required |
| Search | Projection updated |
| Notifications | Lifecycle events |
| AI | Advisory analysis only |
| Audit | Governance history preserved |

Institutions remain independent bounded contexts.

---

# 20. Translation Workflow

## Business Objective

Provide multilingual access to civic content while preserving the original authoritative source.

Translations improve accessibility.

They never replace original content.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Publish | Translation | `PublishTranslation` | `TranslationPublished` |
| Correct | Translation | `CorrectTranslation` | `TranslationCorrected` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Original Content | Always authoritative |
| Translation | Linked to source |
| Search | Localized Search Documents |
| Notifications | Localized delivery |
| AI | Translation assistance only |
| Audit | Translator accountability |

---

# 21. Notification Workflow

## Business Objective

Deliver policy-driven participant notifications derived from authoritative business events.

Notifications communicate.

They never authorize.

---

## Workflow Lifecycle

```text
Domain Event

↓

Integration Event

↓

Notification Policy

↓

Authorization

↓

Participant Preferences

↓

Localization

↓

Delivery

↓

NotificationDelivered

↓

NotificationRead
```

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Authority | Derived only |
| Retry | Never repeats business commands |
| Authorization | Revalidated before delivery |
| Preferences | Participant controlled |
| Localization | Automatic |
| Audit | Delivery trace preserved |

Notifications never mutate foreign Aggregates.

---

# 22. Search Workflow

## Business Objective

Provide authorized discovery of civic information using projection-based search.

Search discovers.

It never owns business state.

---

## Workflow Lifecycle

```text
Domain Event

↓

Integration Event

↓

Search Projection

↓

Search Document

↓

Authorized Search

↓

Participant
```

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Source of Truth | Aggregate only |
| Search Projection | Eventually consistent |
| Authorization | Permission-aware |
| Localization | Supported |
| AI | Explain results only |
| Audit | Search queries traceable |

Search never bypasses authorization.

---

# 23. AI Integration Workflow

## Business Objective

Provide advisory assistance while preserving complete human governance.

Artificial Intelligence assists.

Participants decide.

---

## Workflow Lifecycle

```text
Authorized Queries

↓

Search Projections

↓

Search Documents

↓

Context Assembly

↓

Permission Filtering

↓

AI Processing

↓

Output Validation

↓

Advisory Recommendation

↓

Participant

↓

Authorized Command
```

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Authority | Human only |
| Context | Authorized only |
| Output | Advisory only |
| Search | Read-only |
| Aggregates | Never modified directly |
| Audit | AI requests recorded |

AI never publishes Domain Events.

AI never approves governance.

AI never authorizes workflow transitions.

---

# 24. Institutional Memory Workflow

## Business Objective

Preserve permanent institutional knowledge created by completed civic processes.

Institutional Memory records history.

It never rewrites history.

---

## Workflow Steps

| Step | Context | Command | Canonical Event |
|------|---------|---------|-----------------|
| Append | Institutional Memory | `AppendInstitutionalMemory` | `InstitutionalMemoryAppended` |
| Correct | Institutional Memory | `CorrectInstitutionalMemory` | `InstitutionalMemoryCorrected` |

---

## Workflow Rules

| Concern | Rule |
|---------|------|
| Storage | Append-only |
| Corrections | Never erase history |
| Search | Search Projection updated |
| AI | Navigation assistance |
| Audit | Immutable |

Institutional Memory represents the final stage of every completed Initiative.

---

# 25. Workflow Recovery

Every workflow shall remain recoverable.

Recovery never changes authoritative business history.

---

## Failure Responses

| Failure | Recovery |
|----------|----------|
| Authorization denied | Reject command |
| Invariant violation | Reject command |
| Duplicate command | Idempotent processing |
| Consumer unavailable | Retry |
| Projection delay | Event replay |
| Notification failure | Delivery retry |
| Search failure | Projection rebuild |
| AI unavailable | Continue workflow |
| Translation unavailable | Original language available |
| Timeout | Human continuation |

---

## Recovery Lifecycle

```text
Command

↓

Aggregate

↓

Domain Event

↓

Integration Event

↓

Retry

↓

Replay

↓

Projection Recovery

↓

Workflow Continues
```

---

# 26. Workflow Observability

Every workflow shall be observable.

---

## Observability Signals

| Signal | Purpose |
|--------|---------|
| Correlation ID | End-to-end trace |
| Command Trace | Business execution |
| Domain Event | Business history |
| Integration Event | Cross-context communication |
| Projection Lag | Search freshness |
| Notification Delivery | Communication quality |
| AI Usage | Advisory metrics |
| Authorization | Security analysis |
| Workflow Duration | Performance |

Private information shall never appear in operational telemetry.

---

# 27. Workflow Security

Every workflow shall preserve platform security.

---

## Security Principles

| Principle | Rule |
|-----------|------|
| Least Privilege | Minimum permissions |
| Reauthorization | Sensitive transitions |
| Public Contracts | Context isolation |
| Context Boundaries | No foreign persistence |
| AI Isolation | Authorized context only |
| Audit | Privileged operations logged |

Security policies shall be evaluated before every privileged workflow transition.

---

# 28. Workflow Testing

Every workflow shall be verifiable.

---

## Required Test Categories

| Category | Purpose |
|----------|---------|
| Aggregate Tests | Business invariants |
| Authorization Tests | Permission evaluation |
| API Contract Tests | Public interfaces |
| Event Tests | Canonical events |
| Integration Tests | Cross-context workflows |
| Projection Tests | Read models |
| Search Tests | Authorization filtering |
| Notification Tests | Delivery policies |
| AI Boundary Tests | Advisory limitations |
| Replay Tests | Recovery validation |

Testing frameworks remain implementation decisions.

---

# 29. Workflow Traceability Matrix

| Workflow | Primary Context | Aggregate | Commands | Canonical Events | Search | Notification | AI | Audit |
|----------|-----------------|-----------|-----------|------------------|--------|--------------|-----|-------|
| Participant Registration | Participant | Participant | RegisterParticipant | ParticipantRegistered | ✓ | ✓ | — | ✓ |
| Initiative | Initiative | Initiative | CreateInitiative | InitiativeCreated | ✓ | ✓ | Advisory | ✓ |
| Collaborative Analysis | Collaborative Analysis | Analysis | AddContribution | ContributionAdded | ✓ | ✓ | Summary | ✓ |
| Proposal | Proposal | Proposal | SubmitProposal | ProposalSubmitted | ✓ | ✓ | Draft assist | ✓ |
| Petition | Petition | Petition | OpenPetition | PetitionOpened | ✓ | ✓ | Analysis | ✓ |
| Decision Session | Decision | Decision Session | OpenDecisionSession | DecisionSessionOpened | ✓ | ✓ | Analysis | ✓ |
| Collective Decision | Decision | Decision | ApproveDecision | DecisionApproved | ✓ | ✓ | None | ✓ |
| Implementation | Implementation | Implementation | StartImplementation | ImplementationStarted | ✓ | ✓ | Advisory | ✓ |
| Impact Assessment | Impact Assessment | Assessment | RecordImpactAssessment | ImpactRecorded | ✓ | ✓ | Analytics | ✓ |
| Working Group | Working Group | Working Group | CreateWorkingGroup | WorkingGroupCreated | ✓ | ✓ | Coordination | ✓ |
| Institution | Institution | Institution | CreateInstitution | InstitutionCreated | ✓ | ✓ | Advisory | ✓ |
| Translation | Translation | Translation | PublishTranslation | TranslationPublished | ✓ | ✓ | Drafting | ✓ |
| Search | Search | Search Documents | SearchAuthorizedContent | — | ✓ | — | Explain | Query |
| AI Integration | AI Integration | Advisory Context | RequestFacilitation | FacilitationOutputProduced | — | — | Advisory | ✓ |
| Institutional Memory | Institutional Memory | Memory | AppendInstitutionalMemory | InstitutionalMemoryAppended | ✓ | — | Navigation | ✓ |

---

# 30. Architecture Diagrams

## 30.1 Canonical Collective Participation Lifecycle

```text
Participant
        │
        ▼
Initiative
        │
        ▼
Collaborative Analysis
        │
        ▼
Proposal
        │
        ▼
Petition
        │
        ▼
Decision Session
        │
        ▼
Collective Decision
        │
        ▼
Implementation
        │
        ▼
Impact Assessment
        │
        ▼
Institutional Memory
```

Every workflow belongs to exactly one stage of the canonical lifecycle.

No workflow may bypass domain authority.

---

## 30.2 Cross-Context Workflow Coordination

```text
Participant
        │
        ▼
Authorization
        │
        ▼
Command
        │
        ▼
Application Service
        │
        ▼
Aggregate
        │
        ▼
Domain Event
        │
        ▼
Integration Event
        │
        ▼
Workflow Continuation
        │
        ▼
Search Projection
        │
        ├────────► Notification
        │
        ├────────► AI Advisory
        │
        ▼
Participant
```

Each bounded context owns only its own Aggregate.

---

## 30.3 Cross-Context Recovery

```text
Command
      │
      ▼
Authorization
      │
      ▼
Aggregate
      │
      ▼
Domain Event
      │
      ▼
Integration Event
      │
      ▼
Consumer
   ┌──┴───────────────┐
   │                  │
Success            Failure
   │                  │
   ▼                  ▼
Projection        Retry
                     │
                     ▼
                  Replay
                     │
                     ▼
              Projection Recovery
```

Recovery never changes authoritative business history.

---

## 30.4 Search Workflow

```text
Domain Event
      │
      ▼
Integration Event
      │
      ▼
Search Projection
      │
      ▼
Search Document
      │
      ▼
Authorized Search
      │
      ▼
Participant
```

Search remains projection-based.

---

## 30.5 AI Advisory Workflow

```text
Authorized Queries
        │
        ▼
Search Projections
        │
        ▼
Search Documents
        │
        ▼
Context Assembly
        │
        ▼
Permission Filtering
        │
        ▼
AI Processing
        │
        ▼
Output Validation
        │
        ▼
Advisory Recommendation
        │
        ▼
Participant
        │
        ▼
Authorized Command
```

AI never publishes Domain Events.

---

# 31. Architectural Anti-Patterns

The following practices are prohibited.

| Anti-Pattern | Reason |
|--------------|--------|
| One Aggregate controlling entire civic lifecycle | Violates bounded context ownership |
| Cross-context persistence access | Violates Aggregate isolation |
| Shared database ownership | Violates Database Strategy |
| Commands executed against foreign Aggregates | Breaks Application boundaries |
| Distributed business transactions | Violates Aggregate consistency |
| Workflow-specific event names | Violates Event Architecture |
| Non-canonical Domain Events | Violates Event Catalogue |
| Search as authoritative data source | Violates Search Architecture |
| Notification modifying business state | Violates Notification Architecture |
| AI publishing Domain Events | Violates AI Integration |
| AI authorizing governance | Human authority required |
| Workflow bypassing authorization | Violates Permission Model |
| Workflow bypassing Application Services | Breaks architecture |
| Direct Aggregate communication | Commands required |
| Hidden business transitions | Violates traceability |
| Unrecoverable workflow execution | Violates operational resilience |
| Missing audit trail | Violates accountability |
| UI controlling business logic | Presentation layer cannot own business rules |

Every prohibited pattern weakens architectural consistency.

---

# 32. Dependency Hierarchy

Application Workflows represent the highest behavioral layer of the engineering architecture.

```text
Ubiquitous Language
        │
        ▼
System Architecture
        │
        ▼
Domain Model
        │
        ▼
Application Architecture
        │
        ▼
API Architecture
        │
        ▼
Database Strategy
        │
        ▼
Event Architecture
        │
        ▼
Permission Model
        │
        ▼
Notification Architecture
        │
        ▼
Search Architecture
        │
        ▼
AI Integration
        │
        ▼
Deployment Architecture
        │
        ▼
Application Workflows
```

Application Workflows depend on every preceding architectural standard.

No lower architectural layer depends on Application Workflows.

---

# 33. Engineering Constraints

The following constraints are mandatory.

| Constraint | Requirement |
|------------|-------------|
| Aggregate ownership | Preserved |
| Application boundaries | Preserved |
| Public contracts | Required |
| Commands | Required for business intent |
| Domain Events | Canonical only |
| Integration Events | Cross-context communication only |
| Authorization | Required before privileged execution |
| Search | Projection-based only |
| AI | Advisory only |
| Notifications | Derived only |
| Audit | Mandatory |
| Recovery | Mandatory |
| Traceability | Mandatory |
| Human governance | Mandatory |

These constraints apply to every workflow.

---

# 34. Workflow Verification Checklist

Every implementation shall satisfy the following checklist.

| # | Verification |
|---|--------------|
| 1 | Every workflow owns exactly one business responsibility |
| 2 | Aggregate ownership preserved |
| 3 | Commands express intent |
| 4 | Domain Events are canonical |
| 5 | Integration Events coordinate contexts |
| 6 | Authorization evaluated before execution |
| 7 | Search uses Search Projections |
| 8 | Search uses Search Documents |
| 9 | AI receives authorized context only |
| 10 | AI never mutates Aggregates |
| 11 | Notifications never create authority |
| 12 | Recovery supports replay |
| 13 | Workflow fully traceable |
| 14 | Audit complete |
| 15 | Human governance preserved |

All checklist items shall pass before production deployment.

---

# 35. Future Evolution

The workflow architecture is designed for long-term evolution.

Future versions may introduce:

- additional civic workflow types;
- advanced workflow analytics;
- adaptive civic participation guidance;
- predictive workflow monitoring;
- intelligent workload balancing;
- distributed institutional coordination;
- automated workflow validation;
- enhanced observability;
- richer Search capabilities;
- improved AI advisory services.

Future evolution shall preserve:

- Aggregate ownership;
- bounded context isolation;
- Application boundaries;
- canonical Domain Events;
- human governance;
- authorization;
- auditability;
- recoverability.

Architecture principles are immutable.

Implementation may evolve.

---

# 36. Guiding Principle

Application Workflows coordinate business execution across independent bounded contexts without transferring domain ownership, weakening Aggregate consistency, bypassing authorization, or reducing human governance.

Every workflow shall preserve:

- explicit business intent;
- canonical Domain Events;
- recoverable execution;
- complete traceability;
- transparent responsibility;
- projection-based discovery;
- advisory-only Artificial Intelligence.

**Workflows coordinate the architecture.**

**They never redefine the architecture.**

---

# 37. Engineering Readiness Assessment

| Dimension | Status |
|-----------|--------|
| Workflow Completeness | Ready |
| Domain Consistency | Ready |
| Cross-Context Coordination | Ready |
| CQRS Compliance | Ready |
| Event-Driven Compliance | Ready |
| Search Integration | Ready |
| AI Integration | Ready |
| Deployment Compatibility | Ready |
| Recovery Strategy | Ready |
| Observability | Ready |
| Engineering Verification | Ready |
| Production Readiness | Ready |

The workflow architecture is suitable for enterprise implementation.

---

# 38. Document Metadata

| Property | Value |
|----------|-------|
| Document | Application Workflows |
| Identifier | 12_APPLICATION_WORKFLOWS.md |
| Version | 2.1 |
| Status | Normative Engineering Standard |
| Architecture Style | Domain-Driven Design · Clean Architecture · CQRS · Event-Driven Architecture |
| Primary Responsibility | Cross-context business workflow coordination |
| Depends On | Engineering Standards 00–11 |
| Supersedes | Application Workflows v1.0 |
| Primary Audience | Software Architects, Backend Engineers, Platform Engineers, Solution Architects, Technical Leads |

---
