# IMPLEMENTATION_GUIDE_06_PUBLIC_PROJECTION

## Capability 02 — Participation

### Epic 04 — Petition

Guide 06 of 7

Version: 1.0

Status: Draft

---

# Purpose

Define how the Petition Public Projection should be implemented.

The Public Projection provides a transparent, read-only civic view of a Petition for Public Visitors and society.

It allows any visitor to:

- understand the Petition;
- understand the related Collective Decision;
- share the Petition;
- register before signing.

It must never expose participant-only operational information.

This guide references:

- `PUBLIC_PROJECTION.md`
- `IMPLEMENTATION_GUIDE_04_API.md`
- `project/architecture/experience/EXPERIENCE_ARCHITECTURE.md`
- `capabilities/02_participation/PARTICIPATION_PIPELINE.md`

It does not redefine architecture.

It does not discuss CSS or frontend implementation.

It does not generate implementation code.

---

# Prerequisites

Guide 04 API must define the public route surface.

Guide 03 store must provide authoritative aggregate state for projection building.

Guide 06 focuses on projection types, builder behavior and public read semantics.

Public consumers depend on the public API endpoint defined in Guide 04.

---

# Scope

This guide includes:

- purpose and responsibilities;
- relationship to operational workspace;
- public information model;
- public read model;
- Registration Gateway behavior;
- Share Link behavior;
- public statistics;
- privacy boundaries;
- read-only expectations;
- error handling;
- verification checklist.

This guide does not include:

- public web page composition;
- CSS or visual presentation;
- Workspace implementation;
- authentication implementation details;
- Participation Navigator service;
- database persistence design.

---

# Public Projection Responsibilities

The Public Projection is responsible for:

- exposing approved public information about one Petition;
- presenting aggregate endorsement context after an approved Collective Decision;
- communicating public lifecycle meaning;
- exposing aggregate support statistics;
- exposing Share Link for observation and distribution;
- presenting participation entry guidance for registration before signing;
- including approved summaries of related Collective Decision and subject context;
- preserving civic transparency without operational leakage.

The Public Projection is not responsible for:

- Signature submission;
- lifecycle mutation;
- participant signed status for anonymous visitors;
- workspace navigation logic;
- identity administration;
- engagement analytics;
- external aggregate mutation;
- replacing operational API or workspace.

The projection builder transforms aggregate state into a dedicated public read model.

It does not serialize the operational aggregate directly.

---

# Relationship to Operational Workspace

Operational Workspace and Public Projection serve different audiences and purposes.

| Surface               | Purpose       | Audience                            | Writable                |
| --------------------- | ------------- | ----------------------------------- | ----------------------- |
| Operational Workspace | participation | registered participants             | through operational API |
| Public Projection     | transparency  | Public Visitors, observers, society | no                      |

Operational workspace includes:

- personal signing status;
- Endorsement Panel;
- participant journey continuity;
- Next Meaningful Action;
- operational navigation.

Public projection includes:

- aggregate petition summary;
- approved decision context in public terms;
- aggregate support statistics;
- share reference;
- registration entry guidance.

Public projection must never show:

- whether the current anonymous viewer has signed;
- participant workspace state;
- individual Signature records in Version 1;
- internal policy mechanics beyond public eligibility summary;
- operational controls.

A person may read the Public Projection without identity.

A person must register before signing.

Registered participants may review the public record after signing, but operational participation still belongs to the workspace and operational API.

---

# Public Information Model

Implement a dedicated public read model aligned with `PUBLIC_PROJECTION.md`.

Conceptual structure:

```
PublicPetitionProjection

├── petitionIdentity
├── petitionSummary
├── petitionLifecycleStatus
├── petitionSubject
├── approvedDecisionContext
├── publicSupportStatistics
├── petitionOutcome
├── shareReference
└── participationEntryGuidance
```

Rules:

- built from aggregate state plus approved referenced summaries;
- independent shape from operational DTO;
- stable public field names;
- civic language consistent with Domain Language;
- no embedded operational internals.

---

# Public Read Model

## Deliverables

Create public projection type:

```
packages/types/src/domain/public-petition.ts
```

Create projection builder and public route handler module assets:

```
apps/api/src/modules/petition/public-petition.projection.ts
apps/api/src/modules/petition/public-petition.routes.ts
```

Export public type from `@hu/types`.

Register public route:

```
GET /api/v1/public/petitions/:petitionId
```

As defined in `IMPLEMENTATION_GUIDE_04_API.md`.

## Public Type Fields

Version 1 public read model may expose:

### petitionIdentity

- public petition identifier;
- public title or subject title;
- Support Status in public summary terms;
- lifecycle state expressed in public terms.

### petitionSummary

- concise Public Endorsement purpose;
- statement that Petition follows an approved Collective Decision;
- publication timing where relevant.

### petitionSubject

- subject title;
- subject summary;
- subject type, Version 1: Initiative.

### approvedDecisionContext

- supporting Collective Decision reference in public terms;
- approved outcome summary;
- decision summary sufficient for informed public understanding;
- concise Initiative and analysis context approved for public display.

### publicSupportStatistics

- Support Count;
- aggregate participation indicators;
- threshold status in public terms when applicable;
- active or final support state depending on lifecycle.

### petitionOutcome

- public endorsement outcome when lifecycle permits;
- final support summary;
- public meaning of outcome.

### shareReference

- permanent Share Link URL;
- public observation identity.

### participationEntryGuidance

- explanation that registration is required to sign;
- registration entry availability;
- signing availability according to lifecycle;
- clear distinction between viewing, sharing and signing.

## Builder Responsibilities

Implement projection builder equivalent to:

```
toPublicPetitionProjection(petition, approvedContext?)
```

Builder must:

- load aggregate from store;
- map only approved public fields;
- translate lifecycle into public meaning;
- include aggregate statistics already derived by persistence layer;
- attach approved referenced context summaries where required;
- exclude operational and participant-private fields;
- fail cleanly when petition is not public by lifecycle policy.

Builder must not:

- compute alternate business outcomes independently of aggregate truth;
- expose Signature arrays;
- expose participant identifiers;
- mutate store state.

---

# Registration Gateway Behavior

Registration Gateway is an experience entry boundary, not a projection data field.

Public projection presents gateway entry guidance.

Identity administration remains outside Petition.

## Public Projection Role

The projection must communicate:

- Public Visitors may read and share without registration;
- registration is required before signing;
- when Petition is Open, registration enables path toward signing;
- originating Petition context must remain visible after registration handoff.

## Gateway Presentation Rules

Include in `participationEntryGuidance`:

- registrationRequired: true for signing;
- signingAvailable: based on lifecycle `Open`;
- observationAvailable: from `Published` onward;
- entryIntent: observe, share, register, begin participation path.

The projection does not perform registration.

It describes entry conditions only.

## Handoff Expectation

After registration from public entry:

- participant continues into operational Petition Workspace;
- public projection remains available as public record;
- workspace becomes authoritative for participant signed status and Endorsement Panel.

Gateway behavior aligns with `EXPERIENCE_ARCHITECTURE.md` Contextual Participation Pattern.

---

# Share Link Behavior

Share Link is part of public transparency.

## Projection Responsibilities

Expose stable share reference when public visibility applies.

Include:

- Share Link URL;
- statement that sharing increases visibility but does not imply endorsement.

## Lifecycle Rules

Share Link behavior by lifecycle:

| Lifecycle | Share Link |
| --------- | ---------- |
| Draft     | not public |
| Ready     | not public |
| Published | active     |
| Open      | active     |
| Closed    | active     |
| Archived  | active     |

Version 1 default:

- Share Link activates at publication;
- remains stable across Published, Open, Closed and Archived;
- does not change silently after activation.

## Sharing Semantics

Public projection must clearly state:

- viewing is not signing;
- sharing is not signing;
- registration is required before support is recorded.

Share Link enables observation and distribution.

It does not record endorsement.

---

# Public Statistics

Public statistics are aggregate and derived.

## Included Metrics

Version 1 may expose:

- Support Count;
- total signatures;
- threshold progress in public terms;
- active or final support indicators;
- high-level trend summaries approved for public display.

## Rules

Public statistics must:

- derive from immutable Signature records through aggregate persistence layer;
- never be manually edited in projection builder;
- remain understandable without operational knowledge;
- avoid ranking individuals or groups;
- answer "How much support exists?" not "Who signed?" in Version 1.

Exclude from public statistics:

- registration funnel analytics;
- individual share counts;
- participant conversion metrics;
- internal engagement measurements.

SupportMetrics from operational aggregate may feed projection builder after public-field filtering.

Projection builder must not invent statistics.

---

# Privacy Boundaries

Version 1 preserves aggregate transparency and participant privacy.

## Public by Design

- petition existence from public lifecycle onward;
- subject context;
- approved decision context;
- aggregate support;
- public outcome;
- share reference;
- participation entry guidance.

## Private by Default

- participant identity;
- individual signature records in public view;
- personal participation history;
- operational workspace state;
- anonymous viewer signed status;
- internal policy structures;
- moderation and audit diagnostics.

## Version 1 Rule

No individual signer identity lists on public projection.

No per-participant Signature timestamps in public view.

Aggregate totals only.

Future public attribution policies require architectural review before projection changes.

---

# Read-Only Expectations

Public projection is read-only.

## API Expectations

- public route supports GET only in Version 1;
- no POST, PATCH or DELETE under `/api/v1/public/petitions`;
- no signing through public endpoint;
- no lifecycle mutation through public endpoint;
- no manual override of derived public statistics through public route.

## Semantic Expectations

Public projection:

- observes and reports;
- supports informed observation;
- supports share reference exposure;
- supports registration entry guidance;
- does not replace operational command paths.

The only path to Signature recording remains operational API through registered participation flow.

Public projection must not imply that reading or sharing mutates civic records.

---

# Lifecycle Visibility

Public projection availability follows Petition lifecycle per `PUBLIC_PROJECTION.md`.

## Draft and Ready

Version 1 default:

- not publicly available;
- public route returns not found or not public response;
- Share Link not exposed publicly.

## Published and Later

Public projection available.

Share Link active.

Observation and sharing permitted.

Registration Gateway guidance available.

Signing guidance reflects whether Petition is Open.

## Open

Aggregate statistics reflect active endorsement.

Registration and signing entry guidance indicate participation path through registration and workspace.

## Closed

Signing unavailable.

Final public statistics and outcome visible.

Active endorsement language removed.

## Archived

Read-only historical public record remains available.

Public meaning preserved.

No active endorsement invitation.

---

# Cross-Projection Relationships

Public Petition Projection may reference related public records navigationally.

Examples:

- Public Initiative;
- Public Collaborative Analysis;
- Public Collective Decision.

Rules:

- use approved public summaries or links only;
- do not embed operational data from other aggregates;
- each projection remains its own public model;
- related Collective Decision context helps visitor understand decision before support.

Approved decision context inside Petition public projection must be enough for informed public understanding without requiring operational cross-navigation, though links may still be offered.

---

# Error Handling

Public projection errors must be explicit, deterministic and safe.

## Expected Errors

| Condition                                     | Expected behavior                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| petition not found                            | not found response                                                                                  |
| petition exists but not public yet            | not found or not public response                                                                    |
| corrupted or incomplete bootstrap public data | fail safely without partial leakage                                                                 |
| referenced public context unavailable         | return projection with explicit unavailable context marker, not silent omission of decision meaning |
| builder receives archived or closed petition  | still return valid historical public projection                                                     |

## Error Rules

- do not expose store internals;
- do not expose stack traces in normal responses;
- do not leak participant-private data in error messages;
- use civic domain language in messages;
- maintain platform response envelope from Guide 04.

Example messages:

- "Public Petition not found."
- "Public Petition not available."
- "Approved decision context unavailable."

---

# Relationship to Participation Pipeline

Public projection represents the society-facing stage of Public Endorsement in the Participation Pipeline.

It must communicate:

- Petition follows Collective Decision;
- support is not re-decision;
- implementation commitment is a future stage, not current public action;
- public participation begins at Petition for society-facing endorsement entry.

Pipeline stage presentation belongs to public summary and decision context sections.

It must remain presentational.

---

# Transparency Principles

Public projection implementation must preserve Explicit Publicity principles from `PUBLIC_PROJECTION.md`.

## Decision Before Support

Approved Collective Decision context visible enough for informed public understanding.

## Aggregate Over Individual

Public legitimacy through transparent totals, not exposed private participation detail.

## Stable Public Meaning

Public fields use civic language understandable to non-members.

## Historical Preservation

Closed and Archived petitions remain publicly understandable.

## No Hidden Endorsement Mechanics

Thresholds and outcomes appear in public terms.

Internal policy structures remain private.

---

# Engineering Principles

Preserve:

- Explicit Publicity;
- Operational View Separation;
- Derived State;
- Historical Integrity;
- Thin API;
- Aggregate Independence;
- Contextual Participation;
- Transparency With Dignity from `EXPERIENCE_ARCHITECTURE.md`.

Public projection must never weaken Version 1 privacy defaults to increase apparent engagement.

---

# Verification

Confirm:

- public type exists in `@hu/types`;
- projection builder excludes operational fields;
- public GET endpoint returns projection DTO only;
- draft and ready petitions are not publicly exposed in Version 1 default;
- Share Link exposed from Published onward;
- aggregate statistics appear without individual signer identity;
- approved decision context appears in public model;
- participation entry guidance distinguishes view, share and sign;
- public route is read-only;
- operational endpoint remains separate;
- archived and closed petitions remain publicly understandable;
- error cases behave deterministically.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Verification Checklist

Guide 06 is complete when all items below are satisfied.

## Types and Builder

- [ ] `PublicPetitionProjection` type defined
- [ ] projection builder implemented
- [ ] builder maps approved public fields only
- [ ] operational fields excluded
- [ ] Signature records excluded from public view in Version 1
- [ ] participant identity excluded from public view in Version 1

## Public API

- [ ] `GET /api/v1/public/petitions/:petitionId` registered
- [ ] public route uses projection builder
- [ ] public route is read-only
- [ ] platform response envelope preserved

## Public Information Model

- [ ] petition identity exposed appropriately
- [ ] petition summary exposed
- [ ] petition subject exposed
- [ ] approved decision context exposed
- [ ] public support statistics exposed as aggregate only
- [ ] petition outcome exposed when lifecycle permits
- [ ] share reference exposed when public visibility applies
- [ ] participation entry guidance exposed

## Visitor Capabilities

- [ ] visitor can understand the Petition from public read model
- [ ] visitor can understand related Collective Decision context
- [ ] visitor can obtain Share Link for sharing
- [ ] visitor can see registration is required before signing
- [ ] visitor cannot sign through public endpoint

## Lifecycle and Privacy

- [ ] Draft and Ready not public in Version 1 default
- [ ] Published, Open, Closed and Archived public rules respected
- [ ] Share Link stable after publication
- [ ] privacy boundaries preserved
- [ ] no participant-only operational information exposed

## Errors

- [ ] not found handled deterministically
- [ ] not public yet handled deterministically
- [ ] missing referenced context handled safely

## Scope Discipline

- [ ] no CSS discussed or required
- [ ] no frontend page implementation included in this guide
- [ ] Guide 07 not started until checklist complete

---

# Out of Scope

Deferred to later guides:

| Guide                           | Responsibility                                                   |
| ------------------------------- | ---------------------------------------------------------------- |
| Guide 07 — Platform Integration | bootstrap public path, cross-projection wiring, entry continuity |
| Epic architecture review        | final verification                                               |
| future frontend public page     | consumes public API separately when implemented                  |

---

# Final Principle

The Petition Public Projection makes collective endorsement visible to society without exposing participant-only operational detail.

Implementation succeeds when any visitor can understand, share and begin responsible participation entry from the public read model alone, while privacy and aggregate independence remain intact.

Transparency serves civic legitimacy.

Privacy preserves participant dignity.

Both are required in the projection layer.
