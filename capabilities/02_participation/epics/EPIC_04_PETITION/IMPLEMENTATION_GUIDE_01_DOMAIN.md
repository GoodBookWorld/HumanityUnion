# IMPLEMENTATION_GUIDE_01_DOMAIN

## Capability 02 — Participation

### Epic 04 — Petition

Guide 01 of 7

Version: 1.0

Status: Draft

---

# Purpose

Implement the Petition Aggregate domain foundation.

This guide defines how developers implement the Petition domain model as shared types and documents the domain rules that later Store, API and integration layers must enforce.

Guide 01 establishes domain language in code.

It does not introduce runtime behavior, persistence, endpoints or user interface.

---

# Architecture References

Implement against approved Epic 04 architecture:

- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`
- `STATE_MACHINE.md`

Follow platform standards:

- `project/architecture/core/DOMAIN_MODELING_GUIDELINES.md`
- `project/architecture/core/ENGINEERING_METHODOLOGY.md`
- `project/architecture/core/PLATFORM_PATTERNS.md` — Platform Aggregate Pattern, Derived State Pattern
- `capabilities/02_participation/PARTICIPATION_PIPELINE.md`

Do not restate those documents.

Conform to them.

---

# Scope

This guide includes:

- aggregate root definition;
- entity types;
- value object types;
- domain invariants;
- validation expectations;
- repository expectations for Guide 02;
- domain event expectations;
- naming and boundary rules;
- domain implementation checklist.

This guide does not include:

- Store;
- API;
- Workspace;
- Public Projection;
- Platform Integration;
- Registration Gateway behavior;
- Participation Navigator;
- Contribution Recognition messaging;
- bootstrap wiring;
- business rule execution.

---

# Guide Deliverables

Create domain types under:

```
packages/types/src/domain/petition/
```

Expected files:

```
petition.ts
signature.ts
petition-subject.ts
petition-policy.ts
share-link.ts
support-metrics.ts
petition-outcome.ts
petition-lifecycle.ts
index.ts
```

Update:

```
packages/types/src/domain/index.ts
```

Export all new Petition domain types.

Types contain data definitions only.

No methods.

No runtime logic.

Per Domain Modeling Guidelines, the shared types layer defines structure; Store owns behavior in Guide 02.

Public projection types belong to Guide 05, not Guide 01.

---

# Aggregate Responsibilities

The **Petition** Aggregate is the Public Endorsement stage of the Participation Pipeline.

It is responsible for:

- maintaining Petition lifecycle;
- owning Signature records;
- owning Petition Policy;
- owning immutable Petition Subject presentation after publication;
- owning Share Link reference;
- deriving Support Metrics;
- deriving Petition Outcome;
- preserving endorsement history;
- exposing eligibility context through references to approved Collective Decision and Initiative subject.

Petition transforms approved collective legitimacy into transparent public support.

It does not decide, analyze or implement.

---

# Aggregate Boundaries

## Petition Owns

- Signatures;
- Petition Policy;
- Petition lifecycle state;
- Petition Subject presentation snapshot;
- Share Link;
- Support Metrics;
- Petition Outcome;
- participation history within endorsement.

## Petition References

- `CollectiveDecisionId` — eligibility source;
- `InitiativeId` — subject reference through Petition Subject.

References are identifiers and approved presentation snapshots.

They are not embedded aggregate roots.

## Petition Never Owns

- Initiative;
- Collaborative Analysis;
- Collective Decision;
- Implementation Commitment;
- identity administration;
- Registration Gateway;
- Participation Navigator;
- journey presentation logic.

## Boundary Rules

- One approved Collective Decision reference per Petition in Version 1.
- Petition never modifies external aggregate state.
- Collective Decision does not create Petition automatically.
- Eligibility is a precondition checked at creation and transition time in Guide 02.
- Community Participation and Public Participation share one Aggregate, one Signature model and one lifecycle.

---

# Domain Invariants

All layers must preserve invariants from `STATE_MACHINE.md`.

| ID | Invariant |
|----|-----------|
| PI-001 | One approved Collective Decision reference per Petition |
| PI-002 | One Petition lifecycle per approved decision subject path in Version 1 |
| PI-003 | One Signature per Participant per Petition |
| PI-004 | Signatures recorded only during `Open` in Version 1 |
| PI-005 | Recorded Signatures are immutable |
| PI-006 | Petition Policy structure immutable after `Published` |
| PI-007 | Petition Subject presentation immutable after `Published` |
| PI-008 | Support Metrics are always derived, never manually authored |
| PI-009 | Petition Outcome is always derived, never a lifecycle substitute |
| PI-010 | Archived Petitions are immutable |
| PI-011 | Petition never modifies Initiative, Collaborative Analysis or Collective Decision |
| PI-012 | Community and Public Participation share the same Signature rules and lifecycle states |

Derived concepts are not lifecycle states:

- Support Count
- Support Metrics
- Petition Outcome
- Contribution Recognition
- Next Meaningful Action

---

# Aggregate Root

## Petition

Implement the Aggregate Root with the following conceptual structure.

### Identity

- `petitionId`
- `collectiveDecisionId`
- `createdAt`
- `updatedAt`

### Lifecycle

- `status` — one of `Draft`, `Ready`, `Published`, `Open`, `Closed`, `Archived`

Use a dedicated lifecycle type in `petition-lifecycle.ts`.

Do not encode derived outcomes as lifecycle states.

### Owned Composition

- `subject` — `PetitionSubject`
- `policy` — `PetitionPolicy`
- `shareLink` — optional until publication; required once `Published` or later
- `signatures` — collection of `Signature`
- `supportMetrics` — derived `SupportMetrics`
- `outcome` — derived `PetitionOutcome`, meaningful from `Closed` onward

### External References

- `collectiveDecisionId`
- subject contains `initiativeId`

No ownership transfer.

No embedded Collective Decision aggregate graph.

### Aggregate Root Rules

- Petition is the consistency boundary for Signatures and lifecycle transitions.
- Child entities do not mutate external aggregates.
- Aggregate root fields that become immutable must be modeled so Store can enforce immutability after publication transitions.

---

# Entities

Entities possess identity and participate in Petition lifecycle.

## Signature

Represents one participant endorsement.

### Fields

- `signatureId`
- `petitionId`
- `participantId`
- `signedAt`
- `visibility` — operational visibility policy for the signature record
- `status` — active domain status; withdrawal only through explicit future policy action, not silent mutation

### Rules

- belongs to exactly one Petition;
- one Signature per Participant per Petition;
- append-only once recorded;
- no in-place edits;
- Version 1 records signatures only while Petition is `Open`.

Optional future field:

- `participationMode` — `Community` or `Public` as entry context metadata only; does not change civic meaning.

## PetitionSubject

Represents the approved decision subject as presented by the Petition.

### Fields

- `decisionId`
- `initiativeId`
- `title`
- `summary`

### Rules

- immutable after Petition reaches `Published`;
- snapshot presentation, not live Initiative mirror;
- does not own Initiative lifecycle.

---

# Value Objects

Value objects have no independent identity.

Implement as immutable data structures.

## PetitionPolicy

Defines participation rules.

Include:

- eligibility rules for signing;
- visibility rules;
- signature policy;
- withdrawal policy for Version 1 scope;
- publication rules;
- endorsement period rules where applicable.

Rules:

- structurally immutable after `Published`;
- policy interpretation enforced in Guide 02 Store.

## ShareLink

Represents permanent public reference.

### Fields

- `url`
- `createdAt`

Rules:

- activated at publication;
- stable across `Published`, `Open`, `Closed`, `Archived`;
- never silently changed after activation.

## SupportMetrics

Derived endorsement statistics.

Include Version 1 fields aligned with architecture:

- `totalSignatures`
- `participantSignatures`
- `dailyActivity` summary where modeled
- additional operational counters only if endorsement-relevant

Exclude from domain metrics unless explicitly approved later:

- engagement funnel analytics;
- ranking data;
- reputational scoring.

Rules:

- derived only from Signatures and lifecycle activity;
- never manually edited;
- recomputed by Store when Signatures or lifecycle change.

## PetitionOutcome

Derived public endorsement result.

Examples:

- `Active`
- `ThresholdReached`
- `Closed`
- `Archived`

Rules:

- not a lifecycle state;
- derived during and after `Closed`;
- describes endorsement achievement, not implementation readiness.

---

# Out of Scope for Domain Types

The following appear in architecture documents but are **not** Petition Aggregate domain types in Guide 01.

## RegistrationGateway

Experience boundary between Public Visitor observation and authenticated participation.

Belongs to platform identity and experience integration, not Petition aggregate state.

Guide 06 handles cross-capability boundary.

## ContributionRecognition

Participant-facing acknowledgment messaging.

Belongs to Experience Architecture and Workspace layer.

Not aggregate-owned domain state.

## Next Meaningful Action

Journey guidance belongs to Experience Architecture and future Participation Navigator.

Not Petition domain state.

Do not model these as Petition value objects.

---

# Domain Services

Guide 01 defines no domain services.

Petition domain behavior is intentionally concentrated in Guide 02 Store for Version 1, consistent with Epic 01–03 vertical slice practice.

The Store acts as the domain execution layer for:

- lifecycle transitions;
- eligibility verification against referenced approved decision;
- signature recording;
- derived metrics and outcome calculation;
- immutability enforcement.

If a dedicated domain service layer is introduced later, it must not weaken aggregate boundaries or duplicate Store responsibilities without architectural review.

---

# Domain Events

Guide 01 defines no event transport or handlers.

Domain events are documented here as audit and integration expectations for Guide 02 and Guide 06.

Recommended event names for future Store emission:

| Event | When |
|-------|------|
| `PetitionCreated` | Petition enters `Draft` with approved decision reference |
| `PetitionPrepared` | Transition `Draft → Ready` |
| `PetitionPublished` | Transition `Ready → Published`; Share Link activated |
| `PetitionOpened` | Transition `Published → Open` |
| `SignatureRecorded` | Immutable Signature appended during `Open` |
| `PetitionClosed` | Transition `Open → Closed` |
| `PetitionArchived` | Transition `Closed → Archived` |

Event payloads should include:

- `petitionId`
- lifecycle timestamp
- aggregate version or revision marker if introduced later
- minimal reference ids only; no external aggregate mutation instructions

Events support audit, integration and future projection refresh.

They do not replace Store as source of truth.

Guide 01 does not implement event types unless platform-wide event conventions are adopted later.

---

# Repository Expectations

Guide 01 does not implement a repository.

Guide 02 Store fulfills repository responsibility for Version 1.

The Store must support the following conceptual operations.

## Read

- get Petition by `petitionId`
- list Petitions
- get Petition by `collectiveDecisionId` for integration lookup
- get Petition by `initiativeId` where appropriate for integration lookup
- get Signatures for a Petition
- determine whether a Participant already signed a Petition

## Write

- create Petition in `Draft` only when approved Collective Decision eligibility is satisfied
- update preparatory fields in `Draft` and `Ready`
- execute lifecycle transitions in allowed order only
- append Signature during `Open` only
- recompute derived `SupportMetrics` and `PetitionOutcome`
- archive without mutating historical Signatures

## Persistence Characteristics

Version 1 uses in-memory bootstrap storage per Progressive Bootstrap Pattern.

Repository interface must:

- preserve aggregate consistency boundary;
- protect immutability after publication;
- use deep-copy protection where shared references exist;
- treat derived fields as computed, not authoritative input fields.

No repository operation may modify Collective Decision, Initiative or Collaborative Analysis records.

---

# Validation Rules

Validation is specified here and enforced in Guide 02 Store.

Guide 01 types should make invalid states difficult to represent, but Store owns rejection behavior.

## Creation Validation

Reject creation when:

- referenced Collective Decision Outcome is not `Approved`;
- required subject snapshot fields are missing;
- duplicate Version 1 Petition already exists for the same approved decision subject path if platform policy forbids duplicates.

## Lifecycle Validation

Allow only:

```
Draft → Ready → Published → Open → Closed → Archived
```

Reject all invalid transitions listed in `STATE_MACHINE.md`.

Reject:

- signature recording outside `Open`;
- policy structural mutation after `Published`;
- subject presentation mutation after `Published`;
- transitions from `Archived`;
- backward transitions from `Closed` or `Open`.

## Signature Validation

Reject signature submission when:

- Petition is not `Open`;
- Participant is not authenticated as a registered participant;
- Participant already has a Signature on the Petition;
- Petition Policy eligibility rules fail;
- payload attempts to modify an existing Signature.

Accept signature submission when:

- all invariants pass;
- append new immutable Signature only.

## Derived Data Validation

Reject manual writes to:

- `SupportMetrics` as authoritative input;
- `PetitionOutcome` as lifecycle substitute.

Recompute derived values from Signatures and lifecycle state.

## Reference Validation

Petition creation and progression may consult Collective Decision read models for eligibility.

Petition must treat external read results as reference checks only.

Never write back to Collective Decision from Petition validation or commands.

---

# Forbidden Responsibilities

The Petition domain must never:

- recalculate or replace Collective Decision results;
- reopen ballot questions;
- create Petition for rejected decisions;
- modify Initiative, Collaborative Analysis or Collective Decision state;
- accept anonymous signatures;
- edit or delete recorded Signatures silently;
- manually set Support Metrics or Petition Outcome;
- absorb Implementation Commitment responsibilities;
- own identity registration or authentication;
- own Participation Navigator logic;
- expose individual signer identity through aggregate public statistics in Version 1 domain defaults;
- treat sharing or viewing as signing;
- optimize for engagement volume in domain rules;
- introduce vote, ballot or poll terminology for Signatures.

---

# Relationship with Collective Decision

Collective Decision and Petition are sequential pipeline Aggregates with independent lifecycles.

## Division of Responsibility

Collective Decision answers:

"What has the community decided?"

Petition answers:

"Does society publicly support this decision?"

## Reference Model

Petition references:

- `collectiveDecisionId`
- approved Outcome eligibility

Petition consumes approval.

It does not consume decision-making authority.

## Creation Relationship

- Collective Decision never creates Petition.
- Approved Outcome creates eligibility only.
- Petition creation is an explicit later action in Guide 02.
- Rejected Outcome produces no Petition eligibility.

## Lifecycle Independence

- Collective Decision may be `Closed` or `Archived` while Petition progresses.
- Petition lifecycle states are independent from Collective Decision lifecycle states.
- Petition Subject snapshot preserves decision context for endorsement presentation.
- Petition must not re-adjudicate Participant Decisions.

## Integration Expectation

Guide 06 Platform Integration reads Collective Decision Outcome to verify eligibility.

Petition domain types store reference ids only.

Cross-aggregate reads occur outside the aggregate root mutation boundary.

---

# Relationship with Implementation Commitment

Petition and Implementation Commitment are separate future pipeline stages.

## Division of Responsibility

Petition answers:

"Does society support this decision?"

Implementation Commitment answers:

"Who is prepared to participate in implementation?"

## Boundary

- Petition ends at endorsement finalization.
- `Closed` and `Archived` describe endorsement completion.
- Petition Outcome describes public support achievement, not implementation readiness.
- Transition to `Closed` does not create Implementation Commitment.
- Successful Petition may enable future eligibility for Implementation Commitment through pipeline integration, not through Petition state mutation of a future aggregate.

## Domain Modeling Rule

Do not embed Implementation Commitment entities, statuses or volunteer matching fields inside Petition domain types.

Pipeline handoff remains reference and eligibility based.

---

# Naming Rules

Use approved ubiquitous language from `DOMAIN_LANGUAGE.md`.

Required terms:

- `Petition`
- `Signature`
- `PetitionSubject`
- `PetitionPolicy`
- `ShareLink`
- `SupportMetrics`
- `PetitionOutcome`
- `CollectiveDecisionId`
- `InitiativeId`
- `ParticipantId`

Lifecycle states:

- `Draft`
- `Ready`
- `Published`
- `Open`
- `Closed`
- `Archived`

Do not introduce:

- `Vote`
- `Ballot`
- `PollResult`
- `PetitionResult` — use `PetitionOutcome`
- `SupportStatus` as a lifecycle state — it is public-facing summary language, not a substitute for lifecycle modeling

Community Poll remains Collective Decision mechanism vocabulary.

Petition uses endorsement vocabulary only.

---

# Engineering Principles

Preserve platform principles without redefining them:

- Domain First
- Human Leadership
- Explicit Publicity
- Historical Integrity
- Derived State
- Progressive Bootstrap
- Aggregate Independence
- Mechanism Independence

Petition-specific consequence:

Signatures are human endorsements recorded by the platform, never generated by the platform on behalf of participants.

---

# Verification

Confirm:

- all domain types compile;
- exports resolve from `@hu/types`;
- aggregate structure matches `DOMAIN_MODEL.md`;
- lifecycle type matches `STATE_MACHINE.md`;
- no runtime behavior exists in Guide 01;
- no API, Store, Workspace or projection code was introduced;
- out-of-scope experience concepts were not modeled as domain types.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Domain Implementation Checklist

Guide 01 is complete when all items below are satisfied.

## Architecture Alignment

- [ ] Domain types conform to `DOMAIN_MODEL.md`
- [ ] Lifecycle states conform to `STATE_MACHINE.md`
- [ ] Boundaries conform to `DOMAIN_DECISIONS.md`
- [ ] Ubiquitous language conforms to `DOMAIN_LANGUAGE.md`
- [ ] Pipeline position conforms to `PARTICIPATION_PIPELINE.md`

## Aggregate Structure

- [ ] `Petition` aggregate root defined
- [ ] `Signature` entity defined
- [ ] `PetitionSubject` entity defined
- [ ] `PetitionPolicy` value object defined
- [ ] `ShareLink` value object defined
- [ ] `SupportMetrics` value object defined
- [ ] `PetitionOutcome` value object defined
- [ ] `petition-lifecycle` status type defined

## Boundary Discipline

- [ ] External references modeled as ids and snapshots only
- [ ] No Collective Decision, Initiative or Analysis ownership modeled
- [ ] No RegistrationGateway domain type introduced
- [ ] No ContributionRecognition domain type introduced
- [ ] No Implementation Commitment fields introduced

## Type Layer Discipline

- [ ] Types only; no methods
- [ ] No Store, repository, API or UI code
- [ ] No business rule execution in types package
- [ ] Exports updated in `packages/types/src/domain/index.ts`

## Quality Gate

- [ ] `pnpm typecheck` passes
- [ ] Guide 02 not started until this checklist is complete

---

# Out of Scope

Deferred to later guides:

| Guide | Responsibility |
|-------|----------------|
| Guide 02 — Petition Store | lifecycle enforcement, signatures, derived metrics, repository behavior |
| Guide 03 — Petition API | REST exposure |
| Guide 04 — Petition Workspace | operational experience |
| Guide 05 — Public Petition Projection | public read model types and builder |
| Guide 06 — Platform Integration | Collective Decision eligibility reads, Initiative references |
| Guide 07 — Architecture Review | epic verification |

---

# Final Principle

Petition domain types express Public Endorsement, not generic signature collection.

The domain language must preserve the distinction between decision, endorsement and implementation before any Store, API or experience layer is built.

Guide 01 succeeds when the type model makes aggregate independence and historical integrity unavoidable for every subsequent guide.
