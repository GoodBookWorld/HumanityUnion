# IMPLEMENTATION PLAN

## Capability 02 — Participation

### Epic 06 — Implementation

Version: 1.0

Status: Ready

---

# Purpose

Define the engineering implementation plan for the **Implementation** Aggregate.

Implementation is Stage 7 of the Participation Pipeline.

This plan translates approved Epic 06 architecture into an executable engineering sequence aligned with the Humanity Union Engineering Methodology and the Participation Architecture Freeze.

It defines strategy only.

It does not define implementation.

Architecture references:

- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`
- `STATE_MACHINE.md`
- `WORKSPACE_SPECIFICATION.md`
- `PUBLIC_PROJECTION.md`
- `EPIC_06_ARCHITECTURE_REVIEW.md`

Platform standards references:

- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`
- `project/architecture/experience/EXPERIENCE_ARCHITECTURE.md`
- `project/architecture/core/ENGINEERING_METHODOLOGY.md`
- `project/architecture/core/DOMAIN_MODELING_GUIDELINES.md`
- `project/architecture/core/API_DESIGN_GUIDELINES.md`
- `project/architecture/core/UI_ARCHITECTURE_GUIDELINES.md`
- `project/architecture/core/PLATFORM_PATTERNS.md`

---

# Scope

## What Belongs to Epic 06

Epic 06 implements the **Implementation** vertical slice — the civic stage that answers:

**"What is being done?"**

### Aggregate ownership

Epic 06 owns:

- **Implementation** Aggregate root and lifecycle (`Planned` → `Started` → `In Progress` → `Completed` → `Archived`);
- **Implementation Phase**, **Milestone**, **Achievement** and **Evidence** entity recording;
- aggregate commands defined in `STATE_MACHINE.md`:
  - Create Implementation
  - Start Implementation
  - Add Phase
  - Update Phase
  - Add Milestone
  - Update Milestone
  - Record Achievement
  - Attach Evidence
  - Complete Milestone
  - Complete Phase
  - Complete Implementation
  - Archive Implementation;
- **derived values** computed from achievements, milestone state and Frozen Policy reference:
  - Collective Progress
  - Completion Assessment
  - Completion
  - Progress Indicator
  - Completion Indicator
  - Progress Snapshot;
- **Operational Workspace** per `WORKSPACE_SPECIFICATION.md`;
- **Public Projection** per `PUBLIC_PROJECTION.md`;
- **Platform Integration** linking bootstrap pipeline stages through Implementation Commitment to bootstrap Implementation;
- architecture review remediation items required before or during Sprint 1 as documented in `EPIC_06_ARCHITECTURE_REVIEW.md`.

### Version 1 delivery characteristics

- bootstrap-first in-memory store (Progressive Bootstrap platform standard);
- one Implementation per approved participation path in bootstrap data;
- achievement recording authorized for bootstrap participant or policy-defined steward role in Version 1;
- Frozen Policy consumed by read-only reference (`frozenPolicyId`) — extend Epic 05 fixture or shared policy module for milestone/completion criteria;
- collective progress and completion derived only — never manually editable;
- Community and Public surfaces share one aggregate model; operational/public route separation enforced;
- Next Meaningful Observation — not work recommendation — in workspace experience.

### Participation Pipeline position

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

↓

Implementation   ← this Epic

↓

Impact
```

---

## What Explicitly Does NOT Belong

Epic 06 does **not** implement:

### Adjacent pipeline stages

- **Impact** (Stage 8) — outcome measurement and civic learning;
- modifications to **Initiative**, **Collaborative Analysis**, **Collective Decision**, **Petition** or **Implementation Commitment** aggregate behavior beyond read-only integration references.

### Wrong domain semantics

- **task management**, personal assignment, backlog or kanban semantics;
- **project management**, scheduling, calendar coordination or messaging;
- **volunteer dispatch**, roster management or shift signup;
- employment, compensation or HR semantics;
- popularity, engagement or signature-count proxies for progress;
- manual entry or override of Collective Progress or Completion;
- external project management tool integration or embedding.

### Reserved future capabilities (Version 1 non-goals)

- **Coordination Space**;
- **Implementation Dashboard** (public PM-style dashboards);
- **Volunteer Coordination**;
- **External PM Integration**;
- task-linked achievements (`TaskLinked` reserved events remain unimplemented).

### Platform experience services (read-only consumption only)

- **Participation Navigator** platform service implementation;
- **Humanity Assistant** intelligence backend (static explain-only shell in Version 1);
- **Registration Gateway** identity administration;
- notification systems;
- moderation workflows;
- analytics funnels or conversion optimization.

### Infrastructure deferred platform-wide

- persistence layer;
- domain event bus (unless explicitly scoped in a future engineering decision);
- real authentication beyond bootstrap participant identity;
- advanced Living Policy authoring workflows beyond bootstrap Frozen Policy fixture.

### Architecture violations

- cross-aggregate mutation;
- embedded operational graphs from external aggregates;
- public exposure of participant identities, work logs, coordination detail or operational workspace internals;
- separate community and public aggregate or workspace variants;
- partial implementation of deferred coordination features through synonym drift.

Boundary verification is required at every sprint.

---

# Vertical Slice Strategy

Epic 06 delivers one complete vertical slice.

The slice is complete only when every layer is implemented and verified end-to-end.

Implementation order:

```
1. Domain

↓

2. Store

↓

3. API

↓

4. Workspace

↓

5. Public Projection

↓

6. Platform Integration

↓

7. Review
```

## Layer responsibilities

| Step | Layer | Responsibility |
|------|-------|------------------|
| 1 | **Domain** | Shared types, enums, identifiers, projection types in `@hu/types` — no business logic; harmonize lifecycle enum with `STATE_MACHINE.md` |
| 2 | **Store** | Behavior: commands, lifecycle transitions, invariant enforcement, derivation (progress, completion, indicators); in-memory persistence, bootstrap seed, `structuredClone` protection |
| 3 | **API** | Thin REST operational routes, command endpoints, validators, mappers, standard envelope; lookup by commitment, initiative, decision, petition where applicable |
| 4 | **Workspace** | Operational UI per workspace specification — achievement/evidence recording surfaces, derived displays, Next Meaningful Observation, navigation |
| 5 | **Public Projection** | Projection builder with privacy sanitization, public API route, public page — aggregate-only public fields |
| 6 | **Platform Integration** | Bootstrap pipeline linkage, cross-stage navigation, eligibility verification |
| 7 | **Review** | Architecture satisfaction, implementation review, repository discipline |

Each layer depends only on previous layers.

Experience must not precede or redefine structure per Participation Architecture Freeze.

Bootstrap-first delivery applies before persistence is introduced.

Sprint 2 implements **Behavior** and **Store** together within the Store sprint boundary.

---

# Sprint Plan

One Sprint equals one engineering cycle.

Each sprint ends with verification requirements defined below.

---

## Sprint 1 — Domain

### Goal

Establish the Implementation domain model in shared types and close Sprint 1 architecture review preconditions.

### Deliverables

- harmonize `DOMAIN_MODEL.md` Implementation Status with canonical lifecycle: `Planned`, `Started`, `InProgress`, `Completed`, `Archived` (or architecture-approved enum naming);
- domain types for Implementation aggregate root;
- Implementation Phase, Milestone, Achievement, Evidence entity types;
- value object types:
  - Implementation Status
  - Progress Snapshot
  - Completion Assessment
  - Progress Indicator
  - Completion Indicator
  - Evidence Reference, Evidence Attachment, Evidence Link
  - Implementation Visibility
  - Implementation Timeline;
- derived value types: Collective Progress, Completion (derived boolean or value object as modeled);
- public projection types (`PublicImplementationProjection` or equivalent);
- command input types aligned with `STATE_MACHINE.md`;
- domain note: `recordedByParticipantId` operational-only — excluded from public projection types;
- clarify **Implementation Update** as command/event nomenclature only (no duplicate entity unless architecture amends model);
- domain exports from `@hu/types`.

### Verification

- `tsc --noEmit` passes for `packages/types`;
- domain exports complete;
- no business logic in types layer;
- lifecycle enum matches `STATE_MACHINE.md` across domain types;
- `git status` reviewed — changes scoped to Sprint 1 deliverables;
- Sprint Review recorded — domain matches `DOMAIN_MODEL.md` and architecture review issues 1–3 addressed.

---

## Sprint 2 — Store

### Goal

Implement aggregate behavior and in-memory store with bootstrap data, lifecycle transitions, achievement/evidence recording and derived value recalculation.

### Deliverables

- behavior module:
  - command handlers for all twelve aggregate commands;
  - lifecycle transition enforcement per `STATE_MACHINE.md`;
  - forbidden transition rejection;
  - invariant enforcement (`IM-001` through `IM-021`, `SM-001` through `SM-016`);
  - derivation engine:
    - Collective Progress from achievements and milestone state;
    - Completion Assessment from required milestones and Completion Criteria;
    - Completion from Completion Assessment;
    - Progress Indicator and Completion Indicator;
    - Progress Snapshot on material derivation changes where retained;
  - achievement recording preserves history;
  - evidence attachment subordinate to achievements;
- in-memory store:
  - bootstrap Implementation linked to bootstrap Initiative, Collective Decision, Petition and Implementation Commitment;
  - representative phases, required/optional milestones and sample achievements for vertical slice demo;
  - bootstrap Frozen Policy or shared fixture for completion criteria evaluation;
  - command application through aggregate root entry point only;
  - `structuredClone` protection on reads;
- eligibility: Create Implementation requires Implementation Commitment reference and approved decision context;
- Version 1 default: authoritative achievement recording in **In Progress** only.

### Verification

- `tsc --noEmit` passes for types, behavior and store packages;
- lifecycle transitions match `STATE_MACHINE.md` allowed and forbidden tables;
- derived values recompute on achievement record, milestone complete and phase complete events;
- required milestones gate Completion Assessment; optional milestones do not block Completion;
- Frozen Policy not mutated in place;
- no cross-aggregate mutation;
- `git status` reviewed;
- Sprint Review recorded — store and behavior verified against state machine and domain decisions.

---

## Sprint 3 — API

### Goal

Expose Implementation through thin REST API with operational and public route separation at the API layer boundary.

### Deliverables

- operational module under `apps/api`:
  - routes registered at `/api/v1/implementations` (or architecture-approved equivalent);
  - standard resource operations:
    - list
    - get by id
    - create (Create Implementation)
    - patch in permitted preparatory states;
  - lifecycle command endpoints:
    - start
    - complete
    - archive;
  - structure command endpoints:
    - add/update phase
    - add/update milestone
    - complete milestone
    - complete phase;
  - recording command endpoints:
    - record achievement
    - attach evidence;
  - integration lookup endpoints:
    - by implementation commitment id
    - by initiative id
    - by collective decision id
    - by petition id where applicable;
  - validators, mappers, thin controllers;
  - standard response envelope;
  - immutable and derived field protection on PATCH;
- module index and `app.ts` registration.

Public projection endpoint is planned in Sprint 5 — not in Sprint 3.

### Verification

- `tsc --noEmit` passes for `apps/api` and dependencies;
- all operational routes return expected responses against bootstrap data;
- thin API — business rules not duplicated in controllers;
- operational routes do not serialize public projection directly as aggregate root;
- `git status` reviewed;
- Sprint Review recorded — API surface matches implementation plan and API Design Guidelines.

---

## Sprint 4 — Workspace

### Goal

Implement the operational Implementation Workspace per `WORKSPACE_SPECIFICATION.md`.

### Deliverables

- feature module under `apps/web`:
  - API client for operational endpoints;
  - workspace page route (for example `/implementations/:id`);
  - sections aligned to information hierarchy:
    1. Initiative Context
    2. Implementation Status
    3. Collective Progress
    4. Current Phase
    5. Milestones
    6. Achievements
    7. Evidence
    8. Completion Assessment
    9. Humanity Assistant
    10. Related Navigation;
  - canonical **Achievement Recording Panel** and **Evidence Attachment Panel**;
  - **Next Meaningful Observation** (not Next Meaningful Action);
  - empty, loading and completion states;
  - achievement acknowledgment messaging — calm, factual;
  - calm UI patterns per UI Architecture Guidelines;
  - no task board, assignee, calendar or messaging patterns;
  - operational display excludes `recordedByParticipantId` from default UI unless policy expands.

### Verification

- `tsc --noEmit` passes for `apps/web` and dependencies;
- workspace route HTTP 200 for bootstrap implementation;
- section hierarchy matches specification;
- recording commands reachable only when lifecycle and eligibility permit;
- one Next Meaningful Observation presented;
- no work recommendation language in observation copy;
- `git status` reviewed;
- Sprint Review recorded — workspace specification satisfied.

---

## Sprint 5 — Public Projection

### Goal

Implement Public Implementation Projection per `PUBLIC_PROJECTION.md`.

### Deliverables

- projection builder from aggregate truth (not operational aggregate serialization);
- public types finalized if not complete in Sprint 1;
- privacy sanitization:
  - omit participant identities and operational-only fields;
  - sanitize achievement summaries and evidence labels for public display;
  - use policy-aligned category language in progress summaries;
- public API route:
  - `GET /api/v1/public/implementations/:id`;
- public web page:
  - route (for example `/implementations/public/:id`);
  - public information hierarchy:
    1. Initiative
    2. Collective Decision
    3. Petition
    4. Implementation Commitment
    5. Implementation Status
    6. Collective Progress
    7. Current Phase
    8. Achievements
    9. Evidence
    10. Completion
    11. Share
    12. Registration Gateway;
  - Humanity Assistant explain-only copy;
  - share link support;
  - registration entry guidance;
  - privacy boundaries enforced.

### Verification

- `tsc --noEmit` passes across affected packages;
- public API route HTTP 200 for bootstrap implementation;
- public page HTTP 200;
- participant identities, work logs and coordination detail not exposed;
- aggregate progress and completion visible as derived values;
- evidence and completion copy avoids proof/certification language;
- share link stable;
- registration guidance present and accurate;
- `git status` reviewed;
- Sprint Review recorded — Explicit Publicity verified.

---

## Sprint 6 — Platform Integration

### Goal

Integrate Implementation into the Participation Pipeline vertical slice.

### Deliverables

- bootstrap data updates:
  - `implementation-bootstrap-001` (or equivalent) linked to:
    - `initiative-bootstrap-001`
    - `decision-bootstrap-001`
    - `petition-bootstrap-001`
    - `commitment-bootstrap-001`;
  - bootstrap phases and milestones demonstrating required/optional semantics;
  - bootstrap achievements and evidence demonstrating transparency model;
  - bootstrap lifecycle demonstrable through **In Progress** with derived progress movement and through **Completed** when criteria satisfied;
- cross-stage navigation:
  - Implementation Commitment ↔ Implementation (operational);
  - public cross-links across public projections;
  - Future Impact link placeholder when not yet active;
- lookup integration verified from adjacent epics;
- share link from bootstrap implementation public projection;
- eligibility gate documented and enforced:
  - Implementation Commitment reference required;
  - approved Collective Decision Outcome required;
- Implementation Commitment workspace/navigation links to Implementation where available.

Prior stages must not auto-create Implementation.

Version 1 uses explicit bootstrap linkage for vertical slice verification.

### Verification

- `tsc --noEmit` passes monorepo typecheck;
- pipeline navigation succeeds end-to-end on bootstrap IDs;
- operational and public cross-links HTTP 200;
- aggregate independence preserved — no cross-aggregate writes;
- bootstrap achievements produce expected derived progress and completion movement;
- `git status` reviewed;
- Sprint Review recorded — platform integration complete.

---

## Sprint 7 — Implementation Review

### Goal

Close Epic 06 through architecture satisfaction and implementation review.

### Deliverables

- `EPIC_06_ARCHITECTURE_REVIEW.md` cross-cutting issues closed or explicitly deferred with Version 1 scope notes;
- implementation review document with verdict;
- documentation synchronization:
  - architecture document statuses advanced where appropriate;
  - `EPIC_06_ARCHITECTURE_FREEZE.md` approved when governance process completes;
- repository commit of complete vertical slice (when authorized by engineering process);
- deferred items list confirmed out of scope;
- Version 1 Non-Goals list confirmed at closure.

### Verification

- `tsc --noEmit` / `pnpm typecheck` passes for monorepo;
- all required HTTP routes verified (operational + public + lookups);
- aggregate invariants verified in review checklist;
- derived progress and completion verified against bootstrap scenarios;
- evidence model and privacy boundaries verified;
- architecture review conditional items resolved or deferred in writing;
- implementation review verdict **APPROVED** or remediation list issued;
- `git status` clean — no uncommitted Epic 06 slice changes at closure;
- Sprint Review recorded — Epic completion criteria evaluated.

---

# Verification Requirements

Every Sprint must finish with:

## Typecheck

```bash
npm exec pnpm -- typecheck
```

Or equivalent per-package verification:

```bash
npx tsc --noEmit
```

in each affected package (`packages/types`, behavior/store modules, `apps/api`, `apps/web`).

Typecheck must pass before the sprint is considered complete.

## Git Status

```bash
git status
```

Review working tree at sprint boundary:

- changes must correspond to sprint deliverables;
- unrelated modifications must not accumulate across sprints;
- Epic closure requires a clean repository per completion criteria.

## Review

Each sprint ends with a **Sprint Review**:

- deliverables checked against this plan and architecture documents;
- boundary violations recorded if found;
- blockers documented before next sprint begins;
- verification evidence recorded (typecheck result, route checks, review notes).

No sprint may begin until the previous sprint review is complete.

---

# Completion Criteria

Epic 06 is complete **only** when all of the following are true:

## Vertical Slice works

Bootstrap Implementation path functions end-to-end:

- create / start / in-progress lifecycle demonstrable;
- phase and milestone structure present;
- achievement recording and evidence attachment preserve history;
- derived Collective Progress and Completion Assessment update correctly;
- complete / archive path demonstrable when required milestones satisfied.

## Workspace works

- operational page renders full specification hierarchy;
- authorized participant can record achievement and attach evidence through canonical surfaces when eligible;
- calm empty, loading and completion states present;
- Next Meaningful Observation is contextual and never recommends work.

## Public Projection works

- public API returns approved public read model;
- public page renders aggregate progress, achievements, evidence summaries and completion;
- privacy boundaries hold — no identities, work logs or coordination detail;
- share link works.

## Progress is derived

- Collective Progress and Progress Indicator computed from achievements and milestone state;
- no manual progress override at store, API, workspace or public layers.

## Completion is derived

- Completion Assessment and Completion computed from required milestone satisfaction and Completion Criteria;
- Complete Implementation command validates derivation — no manual closure authority.

## Evidence model works

- evidence attaches to achievements only;
- public evidence sanitization enforced;
- evidence copy supports transparency without truth/certification claims.

## HTTP routes verified

Operational and public routes return **HTTP 200** (or correct REST semantics) against bootstrap data, including integration lookups.

Recommended bootstrap routes:

- `/implementations/implementation-bootstrap-001`
- `/implementations/public/implementation-bootstrap-001`
- lookups from Commitment, Petition, Decision and Initiative contexts

## Architecture Review satisfied

`EPIC_06_ARCHITECTURE_REVIEW.md` conditional items closed or explicitly deferred with documented Version 1 scope decisions.

No unresolved FAIL-level architecture findings remain at Epic closure.

## Implementation Review approved

Implementation review document records **APPROVED** verdict.

Remediation-required reviews block Epic closure until resolved.

## Repository clean

```bash
git status
```

shows no uncommitted changes for the Epic 06 vertical slice at closure.

---

# Bootstrap Scope

Version 1 bootstrap planning includes:

**References**

- Initiative: `initiative-bootstrap-001`
- Collective Decision: `decision-bootstrap-001` (Completed, Approved)
- Petition: `petition-bootstrap-001`
- Implementation Commitment: `commitment-bootstrap-001`
- Implementation: `implementation-bootstrap-001`

**Structure**

- at least two Implementation Phases;
- required and optional milestones across phases;
- representative Completion Criteria via Frozen Policy fixture

**Lifecycle**

- Planned through Archived path demonstrable; primary demo path through **In Progress** to **Completed**

**Recording**

- at least one bootstrap Achievement with Evidence;
- derived progress movement demonstrable before and after milestone completion

**Public Projection**

- public page and share link for bootstrap implementation

**Integration**

- navigation from Commitment → Implementation in operational and public surfaces;
- reverse links from Implementation to prior pipeline stages

---

# Dependencies on Previous Epics

Epic 06 depends upon approved vertical slices from:

| Epic | Provides |
|------|----------|
| Epic 01 — Initiative Foundation | Initiative aggregate, workspace and public projection references |
| Epic 02 — Collaborative Analysis | Analysis context for journey presentation (read-only) |
| Epic 03 — Collective Decision | Approved Outcome eligibility |
| Epic 04 — Petition | Endorsement context |
| Epic 05 — Implementation Commitment | Preparedness context, eligibility input, `commitment-bootstrap-001` |

Platform foundations provide identity baseline, engineering methodology and UI/API standards.

Registration Gateway consumes platform identity capabilities.

Identity administration remains outside the Implementation Aggregate.

---

# Deferred

Future releases may introduce:

- Impact Aggregate (Stage 8);
- Coordination Space;
- Task Assignment and External PM Integration;
- Calendar, Scheduling and Messaging;
- Volunteer Coordination;
- Participation Navigator platform service;
- Humanity Assistant backend;
- persistence layer;
- domain event publishing;
- public attribution policies for achievement recorders;
- governed mid-pipeline Frozen Policy reference update workflow;
- notification systems.

Deferred items must not block Version 1 vertical slice completion.

---

# Risks and Controls

| Risk | Control |
|------|---------|
| Implementation created before Commitment eligibility | Store and API enforce preconditions from `STATE_MACHINE.md` and Decision 01 |
| PM/task semantics enter UI | Workspace spec, Non-Goals list and Sprint 4/7 review |
| Operational data leaks into public projection | Dedicated projection builder with sanitization; Sprint 5 and Sprint 7 review |
| Manual progress or completion override | Derived fields read-only at API and store layers |
| Lifecycle naming drift | Sprint 1 harmonization before types export |
| Behavior duplicated in API controllers | Thin API pattern; rules live in behavior/store |
| Architecture review preconditions skipped | Sprint 1 includes documentation harmonization deliverables |
| Aggregate boundary erosion | Reference-only integration; Sprint 6 and Sprint 7 verification |
| Deferred coordination enters through synonyms | Decision 15 review gate on all PRs |

---

# Final Principle

Implementation follows architecture.

Architecture follows principles.

Principles follow Humanity.

Epic 06 must be built as **collective progress recording and derived completion** — extending the Participation Pipeline without redesigning prior aggregates, without coordinating people and without substituting project management tools for civic transparency.

Verify each layer before proceeding.

Close the Epic only through review, not assumption.
