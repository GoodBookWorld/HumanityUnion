# IMPLEMENTATION_PLAN

## Capability 02 — Participation

### Epic 05 — Implementation Commitment

Version: 1.0

Status: Ready

---

# Purpose

Define the engineering implementation plan for the **Implementation Commitment** Aggregate.

Implementation Commitment is Stage 6 of the Participation Pipeline.

This plan translates approved Epic 05 architecture into an executable engineering sequence aligned with the Humanity Union Engineering Methodology and the Participation Architecture Freeze.

It defines strategy only.

It does not define implementation.

Architecture references:

- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`
- `STATE_MACHINE.md`
- `WORKSPACE_SPECIFICATION.md`
- `PUBLIC_PROJECTION.md`
- `EPIC_05_ARCHITECTURE_REVIEW.md`

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

## What Belongs to Epic 05

Epic 05 implements the **Implementation Commitment** vertical slice — the civic stage that answers:

**"Who is prepared to help?"**

### Aggregate ownership

Epic 05 owns:

- **Implementation Commitment** Aggregate root and lifecycle (`Draft` → `Submitted` → `Active` → `Completed` / `Withdrawn` → `Archived`);
- **Contribution Item** entity recording;
- **Contribution Profile** participant grouping within the aggregate;
- aggregate commands defined in `STATE_MACHINE.md`:
  - Create Commitment
  - Submit Commitment
  - Activate Commitment
  - Update Contribution Profile
  - Add Contribution Item
  - Remove Contribution Item
  - Withdraw Commitment
  - Complete Commitment
  - Archive Commitment;
- **derived values** computed from declarations and Frozen Policy reference:
  - Community Capacity
  - Implementation Readiness
  - Policy Satisfaction
  - Contribution Summary
  - Community Need (projection of unsatisfied Readiness Thresholds);
- **Operational Workspace** per `WORKSPACE_SPECIFICATION.md`;
- **Public Projection** per `PUBLIC_PROJECTION.md`;
- **Platform Integration** linking bootstrap Initiative, Collective Decision and Petition to a bootstrap Implementation Commitment;
- architecture review remediation items required before or during Sprint 1 as documented in `EPIC_05_ARCHITECTURE_REVIEW.md`.

### Version 1 delivery characteristics

- bootstrap-first in-memory store (Progressive Bootstrap platform standard);
- one Implementation Commitment per approved participation path in bootstrap data;
- participant-only withdrawal in Version 1 unless Frozen Policy bootstrap explicitly defines coordinator rules;
- Frozen Policy consumed by read-only reference (`frozenPolicyId`) with bootstrap policy fixture;
- Community and Public participation share one aggregate model and one operational workspace after registration.

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

Implementation Commitment   ← this Epic

↓

Implementation

↓

Impact
```

---

## What Explicitly Does NOT Belong

Epic 05 does **not** implement:

### Adjacent pipeline stages

- **Implementation** (Stage 7) — execution, task coordination, progress tracking;
- **Impact** (Stage 8) — outcome measurement and civic learning;
- modifications to **Initiative**, **Collaborative Analysis**, **Collective Decision** or **Petition** aggregate behavior beyond read-only integration references.

### Wrong domain semantics

- Petition **Signature** recording or support metrics;
- collective **decision-making** or ballot replay;
- **task assignment**, scheduling, backlog management or project management;
- employment, compensation or HR semantics;
- popularity, engagement or signature-count proxies for readiness;
- manual entry or override of Community Capacity or Implementation Readiness.

### Platform experience services (read-only consumption only)

- **Participation Navigator** platform service implementation;
- **Humanity Assistant** or **Policy Assistant** intelligence backends;
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
- public exposure of participant identities, contribution detail or workspace internals;
- separate community and public workspace or aggregate variants.

Boundary verification is required at every sprint.

---

# Vertical Slice Strategy

Epic 05 delivers one complete vertical slice.

The slice is complete only when every layer is implemented and verified end-to-end.

Implementation order:

```
1. Domain

↓

2. Behavior

↓

3. Store

↓

4. API

↓

5. Workspace

↓

6. Public Projection

↓

7. Platform Integration

↓

8. Review
```

## Layer responsibilities

| Step | Layer                    | Responsibility                                                                                                         |
| ---- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 1    | **Domain**               | Shared types, enums, identifiers, projection types in `@hu/types` — no business logic                                  |
| 2    | **Behavior**             | Commands, lifecycle transitions, invariant enforcement, derivation (capacity, readiness, needs, satisfaction, summary) |
| 3    | **Store**                | In-memory aggregate persistence, bootstrap seed, `structuredClone` protection, behavior invocation                     |
| 4    | **API**                  | Thin REST operational routes, command endpoints, validators, mappers, standard envelope                                |
| 5    | **Workspace**            | Operational UI per workspace specification — declaration surface, derived displays, navigation                         |
| 6    | **Public Projection**    | Projection builder, public API route, public page — aggregate-only public fields                                       |
| 7    | **Platform Integration** | Bootstrap pipeline linkage, cross-stage navigation, eligibility verification                                           |
| 8    | **Review**               | Architecture review satisfaction, implementation review, repository discipline                                         |

Each layer depends only on previous layers.

Experience must not precede or redefine structure per Participation Architecture Freeze.

Bootstrap-first delivery applies before persistence is introduced.

---

# Sprint Plan

One Sprint equals one engineering cycle.

Each sprint ends with verification requirements defined below.

---

## Sprint 1 — Domain

### Goal

Establish the Implementation Commitment domain model in shared types and close Sprint 1 architecture review preconditions.

### Deliverables

- domain types for Implementation Commitment aggregate root;
- Contribution Item entity types;
- Contribution Profile value object types;
- Contribution Type, Commitment Status, Availability value objects;
- derived value types:
  - Community Capacity
  - Implementation Readiness
  - Policy Satisfaction
  - Contribution Summary
  - Community Need (unsatisfied threshold projection);
- Readiness Threshold reference types;
- public projection types (`PublicImplementationCommitmentProjection` or equivalent);
- command input types aligned with `STATE_MACHINE.md`;
- domain exports from `@hu/types`;
- architecture documentation harmonization for Sprint 1 preconditions:
  - Community Need / Capability Matching modeling note in domain model or explicit projection-only documentation;
  - harmonized "per Implementation Commitment context" invariant wording;
  - Contribution Summary as Version 1 commitment outcome summary naming.

### Verification

- `tsc --noEmit` passes for `packages/types`;
- domain exports complete;
- no business logic in types layer;
- `git status` reviewed — changes scoped to Sprint 1 deliverables;
- Sprint Review recorded — domain matches `DOMAIN_MODEL.md` and architecture review preconditions for Guide 01.

---

## Sprint 2 — Store

### Goal

Implement aggregate behavior and in-memory store with bootstrap data, lifecycle transitions and derived value recalculation.

Sprint 2 implements **Behavior** (step 2) and **Store** (step 3) of the vertical slice strategy.

### Deliverables

- behavior module:
  - command handlers for all ten aggregate commands;
  - lifecycle transition enforcement per `STATE_MACHINE.md`;
  - forbidden transition rejection;
  - invariant enforcement (`IC-001` through `IC-017`, `SM-001` through `SM-009`);
  - derivation engine:
    - Community Capacity from active Contribution Items;
    - Implementation Readiness from Community Capacity + Frozen Policy bootstrap fixture;
    - Policy Satisfaction;
    - Contribution Summary;
    - Community Need from unsatisfied thresholds;
  - withdrawal preserves history — no silent deletion after accountable declaration;
- in-memory store:
  - bootstrap Implementation Commitment linked to bootstrap Initiative, Collective Decision and Petition;
  - bootstrap Frozen Policy fixture with representative Readiness Thresholds;
  - CRUD for preparatory states;
  - command application through aggregate root entry point only;
  - `structuredClone` protection on reads;
- Frozen Policy read-only contract via bootstrap module (external reference — not owned by commitment store).

### Verification

- `tsc --noEmit` passes for types, behavior and store packages;
- lifecycle transitions match `STATE_MACHINE.md` allowed and forbidden tables;
- derived values recompute on add / withdraw / remove events;
- one active declaration per participant per commitment context enforced;
- Frozen Policy not mutated in place;
- no cross-aggregate mutation;
- `git status` reviewed;
- Sprint Review recorded — store and behavior verified against state machine and domain decisions.

---

## Sprint 3 — API

### Goal

Expose Implementation Commitment through thin REST API with operational and public route separation at the API layer boundary.

### Deliverables

- operational module under `apps/api`:
  - routes registered at `/api/v1/implementation-commitments` (or architecture-approved equivalent);
  - standard resource operations:
    - list
    - get by id
    - create (Create Commitment)
    - patch in permitted preparatory states;
  - lifecycle command endpoints:
    - submit
    - activate
    - complete
    - archive;
  - contribution command endpoints:
    - update contribution profile
    - add contribution item
    - remove contribution item
    - withdraw commitment;
  - integration lookup endpoints:
    - by collective decision id
    - by initiative id
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

Implement the operational Implementation Commitment Workspace per `WORKSPACE_SPECIFICATION.md`.

### Deliverables

- feature module under `apps/web`:
  - API client for operational endpoints;
  - workspace page route (for example `/implementation-commitments/:id`);
  - sections aligned to information hierarchy:
    1. Initiative Context
    2. Current Implementation Readiness
    3. Community Capacity
    4. Frozen Policy (Satisfied / Pending / Optional)
    5. Participant Commitment
    6. Contribution Profile
    7. Community Needs
    8. Next Meaningful Action
    9. Humanity Assistant presentation shell (static or placeholder copy aligned to spec — no AI backend)
    10. Related Navigation;
  - canonical **Contribution Declaration** surface (named consistently across UI and docs);
  - empty, loading and completion states;
  - Contribution Recognition messaging;
  - calm UI patterns per UI Architecture Guidelines;
  - no pressure, gamification or ranking patterns.

Participation Navigator: local Next Meaningful Action rules only, aligned with Domain Decisions.

### Verification

- `tsc --noEmit` passes for `apps/web` and dependencies;
- workspace route HTTP 200 for bootstrap commitment;
- section hierarchy matches specification;
- declaration commands reachable only when lifecycle and eligibility permit;
- one Next Meaningful Action presented;
- `git status` reviewed;
- Sprint Review recorded — workspace specification satisfied.

---

## Sprint 5 — Public Projection

### Goal

Implement Public Implementation Commitment Projection per `PUBLIC_PROJECTION.md`.

### Deliverables

- projection builder from aggregate truth (not operational aggregate serialization);
- public types finalized if not complete in Sprint 1;
- public API route:
  - `GET /api/v1/public/implementation-commitments/:id`;
- public web page:
  - route (for example `/implementation-commitments/public/:id`);
  - public information hierarchy:
    1. Initiative
    2. Collective Decision
    3. Petition
    4. Community Capacity
    5. Implementation Readiness
    6. Community Needs
    7. Share
    8. Registration Gateway entry guidance;
  - public-safe policy summary via Community Needs and readiness copy (Version 1);
  - share link support;
  - Humanity Assistant presentation shell (explain-only copy — no persuasion);
  - privacy boundaries enforced.

### Verification

- `tsc --noEmit` passes across affected packages;
- public API route HTTP 200 for bootstrap commitment;
- public page HTTP 200;
- participant identities and contribution detail not exposed;
- aggregate capacity and readiness visible;
- share link stable;
- registration guidance present and accurate;
- `git status` reviewed;
- Sprint Review recorded — Explicit Publicity verified.

---

## Sprint 6 — Platform Integration

### Goal

Integrate Implementation Commitment into the Participation Pipeline vertical slice.

### Deliverables

- bootstrap data updates:
  - `commitment-bootstrap-001` (or equivalent) linked to:
    - `initiative-bootstrap-001`
    - `decision-bootstrap-001`
    - `petition-bootstrap-001`;
  - bootstrap Collective Decision remains **Completed** with Approved outcome;
  - bootstrap Petition in eligible state for commitment creation path;
  - bootstrap commitment lifecycle demonstrable through **Active** with sample declarations;
- cross-stage navigation:
  - Initiative ↔ Collective Decision ↔ Petition ↔ Implementation Commitment (operational);
  - public cross-links across public projections;
  - future Implementation link placeholder when not yet active;
- lookup integration verified from adjacent epics;
- share link from bootstrap commitment public projection;
- eligibility gate documented and enforced:
  - Approved Collective Decision Outcome required;
  - Petition stage completion per Version 1 policy (documented in bootstrap).

Collective Decision and Petition must not auto-create Implementation Commitment.

Version 1 uses explicit bootstrap linkage for vertical slice verification.

### Verification

- `tsc --noEmit` passes monorepo typecheck;
- pipeline navigation succeeds end-to-end on bootstrap IDs;
- operational and public cross-links HTTP 200;
- aggregate independence preserved — no cross-aggregate writes;
- bootstrap declarations produce expected derived readiness movement;
- `git status` reviewed;
- Sprint Review recorded — platform integration complete.

---

## Sprint 7 — Review

### Goal

Close Epic 05 through architecture satisfaction and implementation review.

### Deliverables

- `EPIC_05_ARCHITECTURE_REVIEW.md` cross-cutting issues closed or explicitly deferred with Version 1 scope notes;
- implementation review document with verdict;
- documentation synchronization:
  - implementation guides or sprint records updated;
  - architecture document statuses advanced where appropriate;
- repository commit of complete vertical slice (when authorized by engineering process);
- deferred items list confirmed out of scope.

### Verification

- `tsc --noEmit` / `pnpm typecheck` passes for monorepo;
- all required HTTP routes verified (operational + public + lookups);
- aggregate invariants verified in review checklist;
- architecture review conditional items resolved or deferred in writing;
- implementation review verdict **APPROVED** or remediation list issued;
- `git status` clean — no uncommitted Epic 05 slice changes at closure;
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

Epic 05 is complete **only** when all of the following are true:

## Vertical Slice works

Bootstrap Implementation Commitment path functions end-to-end:

- create / submit / activate lifecycle demonstrable;
- contribution declaration and withdrawal preserve history;
- derived Community Capacity and Implementation Readiness update correctly;
- complete / archive path demonstrable.

## Public Projection works

- public API returns approved public read model;
- public page renders aggregate capacity, readiness and unmet needs;
- privacy boundaries hold;
- share link works.

## Workspace works

- operational page renders full specification hierarchy;
- participant can declare and review commitment through canonical surface when eligible;
- calm empty, loading and completion states present;
- Next Meaningful Action is contextual.

## HTTP routes verified

Operational and public routes return **HTTP 200** (or correct REST semantics) against bootstrap data, including integration lookups.

## Aggregate invariants preserved

- one active declaration per participant per commitment context;
- derived values only — no manual readiness or capacity override;
- Frozen Policy immutable in place;
- no Petition, Decision or Initiative mutation from commitment commands;
- withdrawal preserves history;
- readiness is not approval.

## Architecture Review satisfied

`EPIC_05_ARCHITECTURE_REVIEW.md` conditional items closed or explicitly deferred with documented Version 1 scope decisions.

No unresolved FAIL-level architecture findings remain at Epic closure.

## Implementation Review approved

Implementation review document records **APPROVED** verdict.

Remediation-required reviews block Epic closure until resolved.

## Repository clean

```bash
git status
```

shows no uncommitted changes for the Epic 05 vertical slice at closure.

---

# Dependencies on Previous Epics

Epic 05 depends upon approved vertical slices from:

| Epic                             | Provides                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| Epic 01 — Initiative Foundation  | Initiative aggregate, workspace and public projection references         |
| Epic 02 — Collaborative Analysis | Analysis context for journey presentation (read-only)                    |
| Epic 03 — Collective Decision    | Approved Outcome eligibility                                             |
| Epic 04 — Petition               | Endorsement context; Petition completion eligibility for commitment path |

Platform foundations provide identity baseline, engineering methodology and UI/API standards.

Registration Gateway consumes platform identity capabilities.

Identity administration remains outside the Implementation Commitment Aggregate.

---

# Bootstrap Scope

Version 1 bootstrap planning includes:

**References**

- Initiative: `initiative-bootstrap-001`
- Collective Decision: `decision-bootstrap-001` (Completed, Approved)
- Petition: `petition-bootstrap-001` (eligible completed endorsement path)
- Implementation Commitment: `commitment-bootstrap-001`

**Frozen Policy fixture**

- representative Readiness Thresholds matching workspace and public category examples (volunteers, coordinators, translators, transportation, facilities, expertise)

**Lifecycle**

- Draft through Archived path demonstrable; primary demo path through **Active**

**Declarations**

- at least one bootstrap participant Contribution Item;
- withdrawal path demonstrable preserving history

**Derived values**

- Community Capacity, Implementation Readiness, Community Needs and Policy Satisfaction derived from bootstrap declarations

**Public Projection**

- public page and share link for bootstrap commitment

**Integration**

- navigation from Initiative → Decision → Petition → Implementation Commitment in operational and public surfaces

---

# Deferred

Future releases may introduce:

- Implementation Aggregate (Stage 7);
- Impact Aggregate (Stage 8);
- Participation Navigator platform service;
- Humanity Assistant and Policy Assistant backends;
- persistence layer;
- domain event publishing;
- coordinator-authorized withdrawal roles;
- governed Frozen Policy reference update mid-pipeline;
- Living Policy authoring workflows;
- notification systems;
- regional or organizational commitment campaigns;
- advanced readiness scoring;
- public attribution policies beyond aggregate totals.

Deferred items must not block Version 1 vertical slice completion.

---

# Risks and Controls

| Risk                                                      | Control                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Commitment created before Petition / Decision eligibility | Store and API enforce preconditions from `STATE_MACHINE.md`             |
| Petition signatures counted as capacity                   | Derivation uses Contribution Items only; Decision 03 enforced in review |
| Operational data leaks into public projection             | Dedicated projection builder; Sprint 5 and Sprint 7 review              |
| Manual readiness override                                 | Derived fields read-only at API and store layers                        |
| Workspace pressures participation                         | Workspace specification and UI guidelines enforced in Sprint 4 review   |
| Behavior duplicated in API controllers                    | Thin API pattern; rules live in behavior/store                          |
| Architecture review preconditions skipped                 | Sprint 1 includes documentation harmonization deliverables              |
| Aggregate boundary erosion                                | Reference-only integration; Sprint 6 and Sprint 7 verification          |

---

# Final Principle

Implementation follows architecture.

Architecture never follows implementation.

Epic 05 must be built as **voluntary capacity collection and derived readiness** — extending the Participation Pipeline without redesigning prior aggregates, without assigning work and without substituting engagement mechanics for civic preparedness.

Verify each layer before proceeding.

Close the Epic only through review, not assumption.
