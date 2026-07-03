# IMPLEMENTATION_PLAN

## Capability 02 — Participation

### Epic 04 — Petition

Version: 1.0

Status: Draft

---

# Purpose

Define the engineering implementation plan for the Petition Aggregate.

Petition is the Public Endorsement stage of the Participation Pipeline.

This plan translates approved Epic 04 architecture into an executable engineering sequence aligned with the Humanity Union Engineering Methodology.

It defines strategy only.

It does not define implementation.

---

# Architectural Position

Petition is an independent Aggregate within Capability 02 — Participation.

It references:

- Initiative
- Collaborative Analysis
- Collective Decision

It owns:

- Signatures
- Petition Policy
- Support Metrics
- Petition lifecycle
- Public Endorsement presentation context

Petition never owns or modifies external Aggregates.

Participation Pipeline position:

```
Initiative

↓

Collaborative Analysis

↓

Collective Decision

↓

Petition

↓

Implementation Commitment
```

Architecture references:

- `EPIC_04_PETITION.md`
- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`
- `STATE_MACHINE.md`
- `WORKSPACE_SPECIFICATION.md`
- `PUBLIC_PROJECTION.md`

Platform standards references:

- `project/architecture/ENGINEERING_METHODOLOGY.md`
- `project/architecture/DOMAIN_MODELING_GUIDELINES.md`
- `project/architecture/API_DESIGN_GUIDELINES.md`
- `project/architecture/UI_ARCHITECTURE_GUIDELINES.md`
- `project/architecture/PLATFORM_PATTERNS.md`

---

# Implementation Objectives

Implement Petition as a complete vertical slice that:

- begins only after an Approved Collective Decision;
- records immutable Signatures;
- supports Community Participation and Public Participation within one Aggregate;
- separates Operational Workspace from Public Projection;
- derives Support Metrics and Petition Outcome;
- integrates with Initiative, Collaborative Analysis and Collective Decision by reference;
- preserves aggregate independence and historical integrity;
- passes Epic Architecture Review before Epic closure.

Version 1 focuses on Initiative-based Petitions following approved Community Poll decisions.

---

# Implementation Philosophy

Implementation proceeds from the domain outward.

Each layer depends only on the previous layer.

This follows the Platform Aggregate Pattern defined in platform architecture standards.

```
Architecture

↓

Domain

↓

Store

↓

API

↓

Workspace

↓

Public Projection

↓

Platform Integration

↓

Architecture Review
```

Architecture documents must be approved before implementation begins.

Implementation begins only after architectural foundation is sufficiently defined.

---

# Vertical Slice Strategy

Epic 04 delivers one complete vertical slice.

The slice is complete only when every layer is implemented and verified.

Vertical slice contents:

```
Petition Aggregate

↓

Petition Store

↓

Petition REST API

↓

Petition Workspace

↓

Public Petition Projection

↓

Platform Integration

↓

Epic Architecture Review
```

Bootstrap-first delivery applies.

Version 1 uses deterministic bootstrap data before persistence is introduced.

Progressive Bootstrap is a platform standard and applies to this Epic.

---

# Dependencies on Previous Epics

Epic 04 depends upon approved vertical slices from:

## Epic 01 — Initiative Foundation

Provides:

- Initiative Aggregate
- Initiative public projection
- Initiative workspace reference context

Petition references Initiative as Petition Subject in Version 1.

## Epic 02 — Collaborative Analysis

Provides:

- Collaborative Analysis Aggregate
- analysis summary, readiness and progress policy context

Petition consumes understanding context for informed endorsement.

It does not own analysis data.

## Epic 03 — Collective Decision Framework

Provides:

- Collective Decision Aggregate
- Approved Outcome eligibility
- public and operational decision context

Petition begins only after Approved Outcome.

Collective Decision does not create Petition.

## Platform Foundations

Provides:

- Engineering Methodology
- API Design Guidelines
- UI Architecture Guidelines
- Domain Modeling Guidelines
- Member identity baseline for Participant registration

Registration Gateway uses platform identity capabilities.

Identity administration remains outside the Petition Aggregate.

---

# Aggregate Boundaries

## Petition Owns

- Petition lifecycle
- Signatures
- Petition Policy
- Share Link
- Support Metrics
- Petition Outcome
- participation history within Petition scope

## Petition References

- CollectiveDecisionId
- InitiativeId
- approved decision and subject context

## Petition Never Owns

- Initiative
- Collaborative Analysis
- Collective Decision
- Implementation Commitment
- Participation Navigator
- Member identity administration

## Petition Never Modifies

- external Aggregate state
- approved decision results
- initiative lifecycle directly

Boundary verification is required at every implementation phase.

---

# Implementation Phases

## Phase 1 — Domain

Purpose

Implement the Petition domain model in shared types.

Includes

- Petition Aggregate root
- Signature entity
- PetitionSubject entity
- PetitionPolicy
- ShareLink
- SupportMetrics
- PetitionOutcome
- public projection types

Deliverables align with `DOMAIN_MODEL.md`.

Domain contains types only.

No business logic in types layer per Domain Modeling Guidelines.

Guide:

Guide 01 — Petition Domain

---

## Phase 2 — Store

Purpose

Implement the in-memory Petition Store.

Responsibilities

- bootstrap petition linked to approved decision path
- CRUD for preparatory states
- lifecycle transitions per `STATE_MACHINE.md`
- immutable Signature recording
- derived Support Metrics
- derived Petition Outcome
- archive support
- structuredClone protection

Store owns business rules.

Guide:

Guide 02 — Petition Store

---

## Phase 3 — API

Purpose

Expose Petition through REST following API Design Guidelines.

Responsibilities

- standard resource operations
- lifecycle commands
- Signature submission command
- public projection endpoint separation
- thin controller pattern
- standard response envelope
- validation and immutable field protection

API planning includes:

### Standard Resource Operations

- list petitions
- get petition by id
- create petition
- patch petition in permitted states

### Domain Commands

- prepare / ready / publish / open / close / archive lifecycle commands
- submit signature

### Integration Lookup

- get petition by approved collective decision id or initiative id where appropriate for platform integration

### Public API

- public petition projection endpoint under `/api/v1/public/...`

Operational and public endpoints remain separated per Explicit Publicity.

Guide:

Guide 03 — Petition API

---

## Phase 4 — Workspace

Purpose

Implement the operational Petition Workspace per `WORKSPACE_SPECIFICATION.md` and UI Architecture Guidelines.

Workspace planning includes sections:

- Participation Journey Context
- Petition Overview
- Petition Subject
- Decision Context
- Endorsement Panel
- Support Statistics
- Petition Outcome
- Contribution Recognition
- Next Meaningful Action
- Secondary Actions

Workspace principles:

- Understanding Before Action
- Calm Interface
- one Next Meaningful Action
- Contribution Recognition without personal worth evaluation
- Community and Public Participation share one workspace model

Participation Navigator integration is planned as consumption of a future platform service.

Version 1 may present journey guidance locally only if aligned with Domain Decisions.

Guide:

Guide 04 — Petition Workspace

---

## Phase 5 — Public Projection

Purpose

Implement the Public Petition Projection per `PUBLIC_PROJECTION.md`.

Public projection planning includes:

- projection builder
- public API endpoint
- public page

Expose only:

- petition identity and summary
- petition subject
- approved decision context in public terms
- aggregate support statistics
- petition outcome when available
- share reference
- registration entry guidance

Never expose:

- participant-only operational information
- individual signature records in Version 1 public view
- external aggregate internals beyond approved summaries

Guide:

Guide 05 — Public Petition Projection

---

## Phase 6 — Platform Integration

Purpose

Integrate Petition into the Participation Pipeline.

Verify:

```
Initiative

↓

Collaborative Analysis

↓

Collective Decision

↓

Petition
```

Integration planning includes:

- eligibility from Approved Collective Decision Outcome
- initiative lookup for petition subject
- operational navigation across stages
- public cross-links across public projections
- routing conventions consistent with prior Epics
- aggregate independence preserved

Collective Decision must not create Petition automatically unless an explicit future platform rule is approved.

Version 1 assumes explicit petition progression after eligibility.

Guide:

Guide 06 — Platform Integration

---

## Phase 7 — Epic Architecture Review

Purpose

Perform the complete Epic review.

Verify:

- Domain
- Store
- API
- Workspace
- Public Projection
- Platform Integration
- Documentation
- Repository discipline

Review follows Engineering Methodology review gates.

Guide:

Guide 07 — Epic Architecture Review

---

# Standard Guide Sequence

Guide 01

Domain

↓

Guide 02

Store

↓

Guide 03

API

↓

Guide 04

Workspace

↓

Guide 05

Public Projection

↓

Guide 06

Platform Integration

↓

Guide 07

Epic Architecture Review

One Guide equals one engineering cycle.

---

# Bootstrap Scope

Version 1 bootstrap planning includes:

Petition Subject

- Initiative linked to bootstrap decision path

Eligibility

- Approved Collective Decision Outcome from bootstrap pipeline

Lifecycle

- Draft through Archived path demonstrable in bootstrap data

Signatures

- at least one bootstrap Participant signature path

Support Metrics

- derived from bootstrap signatures

Public Projection

- public view for bootstrap petition

One Share Link

One Petition Policy

No advanced withdrawal policy complexity unless required by architecture baseline.

---

# Deferred

Future releases may introduce:

- Implementation Commitment Aggregate
- Participation Navigator platform service
- public signer attribution policies
- regional petition campaigns
- organizational petition subjects
- institutional petition subjects
- verified expert endorsements
- persistence layer
- moderation workflows
- notification systems
- advanced analytics

Deferred items must not block Version 1 vertical slice completion.

---

# Testing Strategy

Testing follows verification discipline from Engineering Methodology.

Verification occurs at guide boundaries rather than as a separate undefined phase.

## Domain Verification

- types compile
- domain exports complete
- no business logic in types

## Store Verification

- lifecycle transitions match `STATE_MACHINE.md`
- signature immutability enforced
- one signature per participant
- derived metrics correct
- aggregate invariants enforced

## API Verification

- endpoint surface complete
- thin API preserved
- envelope standard preserved
- immutable fields protected
- public endpoint exposes projection only

## Workspace Verification

- section hierarchy matches specification
- informed endorsement precedes signing
- one Next Meaningful Action presented
- Contribution Recognition language approved
- no engagement-optimized patterns

## Public Projection Verification

- public page renders
- aggregate statistics visible
- participant operational data hidden
- share and registration entry available when lifecycle permits

## Integration Verification

- bootstrap pipeline navigation succeeds
- Initiative → Analysis → Decision → Petition links work
- public cross-links work
- aggregate boundaries preserved

## Platform Verification

```
typecheck PASS
```

Application verification:

- operational pages HTTP 200
- public pages HTTP 200

Completion is verified rather than assumed.

---

# Review Checkpoints

Each phase ends with a guide completion checkpoint.

## Checkpoint A — Architecture Approved

Epic architecture documents approved before Guide 01 begins.

## Checkpoint B — Domain Complete

Guide 01 complete.

Domain model matches architecture documents.

## Checkpoint C — Store Complete

Guide 02 complete.

Lifecycle and invariants verified.

## Checkpoint D — API Complete

Guide 03 complete.

Thin API and public separation verified.

## Checkpoint E — Workspace Complete

Guide 04 complete.

Workspace specification satisfied.

## Checkpoint F — Public Projection Complete

Guide 05 complete.

Explicit Publicity verified.

## Checkpoint G — Integration Complete

Guide 06 complete.

Participation Pipeline integration verified.

## Checkpoint H — Epic Review Complete

Guide 07 complete.

Epic approval decision recorded.

Progression to the next checkpoint requires successful completion of the previous checkpoint.

---

# Approval Criteria

Epic 04 is approved only when:

- architecture passes;
- implementation compiles;
- typecheck passes;
- Petition vertical slice is complete;
- Platform Integration succeeds;
- Workspace and Public Projection satisfy approved specifications;
- aggregate boundaries remain intact;
- documentation is synchronized;
- architecture review passes;
- repository is clean.

Epic approval does not require:

- Implementation Commitment;
- Participation Navigator service;
- persistence;
- advanced petition policy variants.

Those remain future work.

---

# Documentation Synchronization

Each guide completion updates:

- implementation guide for that phase
- command center documents when appropriate
- capability changelog when Epic closes

Architecture documents remain the source of truth during implementation.

Implementation guides record execution of the plan.

Documentation and implementation evolve together per Engineering Methodology.

---

# Engineering Principles

Implementation preserves platform standards including:

- Domain First
- Human Leadership
- Explicit Publicity
- Historical Integrity
- Progressive Bootstrap
- Thin API
- Derived State
- Aggregate Independence
- Understanding Before Action
- Calm Interface
- Operational View vs Public View

No Epic-local redefinition of these principles is permitted.

---

# Risks and Controls

## Risk — Petition Created Before Approval

Control:

Store and API enforce Approved Outcome eligibility.

## Risk — Operational Data Leaks into Public Projection

Control:

Dedicated projection builder and public endpoint review in Guide 05 and Guide 07.

## Risk — Duplicate Participation Models

Control:

One Aggregate, one lifecycle, one Signature model for Community and Public modes.

## Risk — Workspace Becomes Engagement-Driven

Control:

Workspace specification and UI Architecture Guidelines enforced in Guide 04 review.

## Risk — Aggregate Boundary Erosion

Control:

Reference-only integration with prior Epics; no cross-aggregate mutation in store.

---

# Success Criteria

Implementation is successful when:

- Petition Aggregate is complete;
- Public Endorsement functions for Version 1 Initiative subjects;
- Signatures are immutable and derived statistics are trustworthy;
- Workspace and Public Projection remain separated;
- Participation Pipeline extends naturally after Collective Decision;
- engineering principles remain intact;
- Epic Architecture Review approves the vertical slice.

---

# Final Principle

Petition implementation should extend the Participation Pipeline without redesigning prior Aggregates.

Build one Petition Aggregate.

Reuse platform standards.

Verify each layer before proceeding.

Close the Epic only through review, not assumption.

Public Endorsement must remain meaningful, transparent and independent from decision-making itself.
