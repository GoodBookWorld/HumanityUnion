# EPIC 05 ARCHITECTURE FREEZE

## Capability 02 — Participation

### Epic 05 — Implementation Commitment

Version: 1.0

Status: APPROVED

---

# Purpose

Freeze the Version 1 architecture of the **Implementation Commitment** Aggregate before implementation begins.

This document establishes the architectural baseline for all Epic 05 engineering work.

After this freeze:

- implementation must conform to the decisions recorded here and in referenced Epic 05 architecture documents;
- architectural drift requires explicit Architecture Review or Engineering Decision;
- implementation must not redefine aggregate responsibilities, derived values or experience boundaries.

This document records **architectural intent only**.

It does not define implementation.

It does not authorize features beyond the frozen Version 1 scope.

References:

- `EPIC_05_ARCHITECTURE_REVIEW.md`
- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`
- `IMPLEMENTATION_PLAN.md`
- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`
- `STATE_MACHINE.md`
- `WORKSPACE_SPECIFICATION.md`
- `PUBLIC_PROJECTION.md`

Epic 05 architecture review concluded **READY FOR IMPLEMENTATION** with conditional documentation items.

This freeze resolves Version 1 scope for those items and locks the aggregate design for engineering.

---

# Pipeline Position

Implementation Commitment is **Stage 6** of the Capability 02 Participation Pipeline.

```
Initiative

↓

Collaborative Analysis

↓

Collective Decision

↓

Petition

↓

Implementation Commitment   ← frozen by this document

↓

Implementation

↓

Impact
```

**Primary civic question:** "Who is prepared to help?"

Implementation Commitment follows eligible prior stages.

It does not precede Petition.

It does not execute Implementation.

---

# Approved Aggregate

## Implementation Commitment

**Implementation Commitment** is the sole Aggregate Root approved for Epic 05 Version 1.

One Implementation Commitment instance:

- references one approved participation path through aggregate identifiers;
- owns commitment lifecycle state;
- owns recorded Contribution Items and Contribution Profiles within its boundary;
- references Frozen Policy by identifier — does not own policy content;
- derives Community Capacity, Implementation Readiness, Policy Satisfaction and Contribution Summary;
- preserves commitment history including withdrawals.

External systems interact through Implementation Commitment commands only.

Internal entities are not independent mutation entry points.

---

# Frozen Responsibilities

The following responsibilities are **frozen** for Version 1.

Implementation Commitment is responsible for:

- **participant commitments** — accountable human declarations of preparedness;
- **contribution profiles** — participant-scoped grouping of declarations within one commitment context;
- **contribution items** — atomic recorded declarations with type, capacity, availability and commitment status;
- **community capacity derivation** — aggregate preparedness computed from active Contribution Items;
- **implementation readiness derivation** — evaluation of Community Capacity against Frozen Policy Readiness Thresholds;
- **policy satisfaction** — derived evaluative outcome that applicable Frozen Policy conditions are met;
- **contribution summary** — presentation-oriented derived summary for workspace and public surfaces;
- **community need projection** — unsatisfied Readiness Thresholds expressed as factual civic requirements (not task assignment);
- **commitment lifecycle** — `Draft` → `Submitted` → `Active` → `Completed` / `Withdrawn` → `Archived`;
- **commitment history preservation** — withdrawal changes status; history is not erased;
- **capability matching inputs** — derived alignment between Community Need and Contribution Items for orientation only;
- **operational workspace experience** — per `WORKSPACE_SPECIFICATION.md`;
- **public projection experience** — per `PUBLIC_PROJECTION.md`.

Frozen outputs:

- declared community capacity record;
- derived implementation readiness evaluation;
- preparedness summary suitable for handoff eligibility toward Implementation when policy permits.

---

# Explicitly Excluded

The following are **explicitly excluded** from Epic 05 Version 1.

Implementation Commitment must never absorb:

- **project management**
- **task management**
- **scheduling**
- **implementation execution**
- **budgeting**
- **petition management**
- **decision management**

Additional exclusions frozen for Version 1:

- Initiative, Collaborative Analysis, Collective Decision and Petition aggregate ownership or mutation;
- Signature recording or Petition support metrics as capacity inputs;
- employment, compensation or HR relationship creation;
- manual override of derived Community Capacity or Implementation Readiness;
- in-place mutation of referenced Frozen Policy content;
- Participation Navigator service implementation;
- Humanity Assistant or Policy Assistant backend intelligence;
- Registration Gateway identity administration;
- persistence layer (deferred platform-wide);
- domain event bus (deferred unless approved by Engineering Decision);
- coordinator-authorized withdrawal unless Frozen Policy bootstrap explicitly defines it — Version 1 default: **participant-only withdrawal**;
- public exposure of participant identities, individual contribution detail or operational workspace internals;
- separate community and public aggregate or workspace variants.

Excluded responsibilities belong to other pipeline stages, platform capabilities or future epics.

---

# Frozen Derived Values

The following values are **derived only**.

They must never become manually editable source of truth.

They must never appear as lifecycle states.

## Community Capacity

Aggregates active Contribution Items into community-level preparedness indicators.

Computed from recorded human declarations — never from Petition signature counts, popularity or engagement metrics.

## Implementation Readiness

Evaluates Community Capacity against Readiness Thresholds from referenced Frozen Policy.

```
Community Capacity + Frozen Policy → Implementation Readiness
```

Readiness is not Collective Decision approval.

Readiness is not authorization to bypass governance.

## Policy Satisfaction

Reports whether evaluated Frozen Policy conditions relevant to readiness or progression are met.

Distinct from Living Policy lifecycle stage **Satisfied** at the governance layer — aggregate Policy Satisfaction is an evaluative derivation within the commitment context.

## Contribution Summary

High-level derived summary for workspace and public projection surfaces.

Version 1 uses **Contribution Summary** as the commitment-phase outcome summary.

**Commitment Outcome** language in decisions maps to Contribution Summary — not a separate editable object.

## Community Need

Projection of **unsatisfied Readiness Thresholds** and approved subject context.

Factual civic requirement display — not a task list and not work assignment.

## Derivation Rules (Frozen)

- derived values recalculate when Contribution Items are added, withdrawn or removed where permitted;
- derived values recalculate when governed Frozen Policy reference changes — not in-place policy mutation;
- derived values are read-only at API, store, workspace and public projection layers;
- Contribution Items remain authoritative source of truth over summaries.

---

# Frozen Principles

The following principles are **frozen** for Epic 05 Version 1.

## Support is not Commitment

Petition **Support** (Signatures) and Implementation Commitment **Contribution** declarations are distinct.

Signature recording does not create a commitment.

Commitment declaration does not express Petition support.

## Community Capacity is derived

Community Capacity is computed from Contribution Items.

Never manually entered.

Never imported from Petition statistics.

## Implementation Readiness is derived

Implementation Readiness is computed from Community Capacity and Frozen Policy.

Never manually set.

Never treated as a second approval vote.

## Living Policy freezes before Commitment

Only **Approved** or **Frozen** policy generations govern active commitment enforcement.

Living Policy progresses:

```
Suggested → Initial → Refined → Approved → Frozen → Satisfied
```

Referenced **Frozen Policy** is immutable in place during commitment evaluation.

Policy change requires governed reference update to a new policy generation — not PATCH of frozen content.

## Assistant never replaces judgment

Humanity Assistant and Policy Assistant may guide comprehension.

Accountable declarations remain human commands through canonical workspace surfaces.

## Operational Workspace is separate from Public Projection

| Surface               | Writable                              | Audience                            |
| --------------------- | ------------------------------------- | ----------------------------------- |
| Operational Workspace | Through operational API commands only | Registered participants             |
| Public Projection     | Read-only                             | Public visitors, observers, society |

Personal commitment state never leaks into public projection beyond approved aggregate fields.

## One Aggregate — One Responsibility

Implementation Commitment owns preparedness collection and readiness derivation only.

Implementation execution belongs to Stage 7.

Impact measurement belongs to Stage 8.

## Additional Frozen Principles

- **Human Leadership** — participants choose whether, what and when to declare;
- **Historical Integrity** — withdrawal preserves auditable record;
- **Explicit Publicity** — public surfaces expose aggregate civic meaning, not private participation detail;
- **Calm Interface** — workspace and public copy must not pressure participation;
- **One active declaration** — at most one active Contribution Item per participant per Implementation Commitment context in Version 1 unless Frozen Policy defines supersession;
- **One initiative, one commitment context** — Version 1 maps one Implementation Commitment aggregate to one approved participation path for bootstrap and production semantics unless Architecture Review approves otherwise;
- **Readiness is not Approval** — readiness reflects preparedness, not re-authorization of collective direction;
- **Commitment is not Execution** — declaration expresses preparedness, not completed work.

---

# Frozen Lifecycle

Aggregate lifecycle states are frozen per `STATE_MACHINE.md`.

## Primary path

```
Draft → Submitted → Active → Completed → Archived
```

## Alternate branch

```
Active → Withdrawn → Archived
```

## Frozen commands

- Create Commitment
- Submit Commitment
- Activate Commitment
- Update Contribution Profile
- Add Contribution Item
- Remove Contribution Item
- Withdraw Commitment
- Complete Commitment
- Archive Commitment

Forbidden transitions defined in `STATE_MACHINE.md` remain frozen.

Individual Contribution Item withdrawal does not automatically move the aggregate to **Withdrawn** unless aggregate-level withdrawal is commanded.

---

# Frozen Policy Contract

Frozen Policy is **referenced**, not owned, by Implementation Commitment.

Version 1 frozen contract:

- `frozenPolicyId` references a read-only Frozen Policy fixture or external policy module;
- commitment store and behavior read policy thresholds and eligibility rules through this reference;
- commitment commands must not mutate policy content in place;
- bootstrap Frozen Policy includes representative Readiness Thresholds for vertical slice verification.

Public policy context in Version 1 is carried through **Community Needs**, **Implementation Readiness** copy and public-safe threshold labels — not full internal policy mechanics.

---

# Frozen Experience Surfaces

## Operational Workspace

Canonical information hierarchy is frozen per `WORKSPACE_SPECIFICATION.md`:

1. Initiative Context
2. Current Implementation Readiness
3. Community Capacity
4. Frozen Policy
5. Participant Commitment
6. Contribution Profile
7. Community Needs
8. Next Meaningful Action
9. Humanity Assistant
10. Related Navigation

**Canonical declaration surface name (frozen):** **Contribution Declaration Panel**

All accountable contribution recording flows through this surface and operational API commands.

## Public Projection

Public information hierarchy is frozen per `PUBLIC_PROJECTION.md`:

1. Initiative
2. Collective Decision
3. Petition
4. Community Capacity
5. Implementation Readiness
6. Community Needs
7. Share
8. Registration Gateway

Public visitors may read, understand and share.

Creating or modifying a commitment requires registration and operational workspace entry.

---

# Humanity Assistant

Humanity Assistant boundaries are frozen for Epic 05 operational and public surfaces.

Assistant is an experience guidance layer — not an Aggregate.

## Assistant may

- **explain** — stage meaning, readiness, policy and journey context;
- **summarize** — Frozen Policy requirements and aggregate state in plain civic language;
- **recommend** — one contextual next step aligned with Next Meaningful Action and Community Needs;
- **highlight unmet policy requirements** — factual Pending threshold and Community Need gaps.

Policy Assistant may additionally help comprehend policy drafts — it does not approve or freeze policy.

## Assistant may never

- **create commitments**
- **approve commitments**
- **modify commitments**
- **make decisions**

Additional frozen prohibitions:

- persuade through urgency, ranking or moral pressure;
- record Contribution Items on behalf of participants;
- withdraw declarations autonomously;
- set or override Implementation Readiness or Community Capacity;
- mutate any Aggregate;
- bypass Registration Gateway or Contribution Declaration Panel for accountable acts;
- conceal automated guidance nature or material uncertainty.

Assistants reduce complexity — not responsibility.

---

# Frozen Eligibility

Version 1 **Create Commitment** eligibility is frozen:

- referenced Collective Decision Outcome must be **Approved**;
- eligible prior pipeline context must exist including completed Petition stage path where Version 1 policy requires;
- Petition eligibility for bootstrap vertical slice: Petition in **Closed** or architecture-approved bootstrap equivalent demonstrating completed endorsement path — bootstrap data may pre-link identifiers under Progressive Bootstrap rules without weakening production eligibility semantics;
- no duplicate Implementation Commitment for the same approved path where Version 1 uniqueness applies;
- Collective Decision and Petition must not auto-create Implementation Commitment — explicit creation or bootstrap seeding only.

---

# Frozen Bootstrap

Version 1 bootstrap identifiers are frozen for vertical slice verification:

| Entity                    | Bootstrap ID               |
| ------------------------- | -------------------------- |
| Initiative                | `initiative-bootstrap-001` |
| Collective Decision       | `decision-bootstrap-001`   |
| Petition                  | `petition-bootstrap-001`   |
| Implementation Commitment | `commitment-bootstrap-001` |

Bootstrap links prior stages to Stage 6 for end-to-end pipeline verification.

Bootstrap must not weaken aggregate independence or eligibility rules in production semantics.

---

# Engineering Freeze

Implementation must follow, in order:

1. `DOMAIN_MODEL.md`
2. `DOMAIN_DECISIONS.md`
3. `STATE_MACHINE.md`
4. `WORKSPACE_SPECIFICATION.md`
5. `PUBLIC_PROJECTION.md`
6. `IMPLEMENTATION_PLAN.md`

Engineering sequence is frozen:

```
Domain → Behavior → Store → API → Workspace → Public Projection → Platform Integration → Review
```

Platform standards frozen for Epic 05:

- Domain First — types before behavior;
- Thin API — rules in behavior/store, not controllers;
- Derived State — capacity and readiness computed, not edited;
- Progressive Bootstrap — in-memory store before persistence;
- Explicit Publicity — projection builder, not aggregate serialization;
- Aggregate Independence — reference-only cross-stage integration;
- Standard response envelope;
- Operational/public route separation.

**No implementation may redefine architecture.**

The following are invalid change paths:

- UI-only reinterpretation that alters civic meaning;
- store convenience that merges aggregates;
- public fields that expose private participation;
- signature counts or engagement metrics as readiness inputs;
- task or project semantics inside commitment domain;
- undocumented lifecycle transitions.

Valid architecture change requires:

1. **Architecture Review**, or
2. **Engineering Decision** for bounded interpretation within frozen architecture, or
3. **New version of this freeze document** with explicit version increment and approval.

---

# Architecture Review Resolution

Cross-cutting items from `EPIC_05_ARCHITECTURE_REVIEW.md` are resolved for Version 1 as follows:

| Item                                          | Frozen Resolution                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Community Need / Capability Matching modeling | Community Need is a derived projection of unsatisfied Readiness Thresholds; Capability Matching is derived orientation only — no auto-assignment |
| Invariant wording                             | One active declaration per participant per **Implementation Commitment context**; Version 1: one commitment per approved participation path      |
| Frozen Policy ownership                       | External read-only reference via `frozenPolicyId`; no in-place mutation                                                                          |
| Commitment Outcome naming                     | **Contribution Summary** is Version 1 outcome summary                                                                                            |
| Public policy context                         | Community Needs + readiness copy carry Version 1 public-safe policy context                                                                      |
| Canonical declaration surface                 | **Contribution Declaration Panel**                                                                                                               |
| Petition eligibility gate                     | Approved Decision + completed Petition path; bootstrap uses Closed Petition or approved bootstrap equivalent                                     |
| Implementation plan                           | `IMPLEMENTATION_PLAN.md` approved — Status Ready                                                                                                 |
| Document status                               | This freeze supersedes Draft ambiguity for engineering baseline                                                                                  |
| Bootstrap linkage                             | `commitment-bootstrap-001` linked to bootstrap pipeline IDs                                                                                      |

No aggregate redesign was required.

These resolutions are binding for Version 1 implementation.

---

# Deferred (Not Frozen for Version 1)

The following remain architecturally defined but **not implemented** in Epic 05 Version 1:

- Implementation Aggregate (Stage 7);
- Impact Aggregate (Stage 8);
- Participation Navigator platform service;
- Humanity Assistant / Policy Assistant backends;
- persistence layer;
- domain event publishing;
- coordinator-authorized withdrawal beyond bootstrap policy exception;
- governed mid-pipeline Frozen Policy reference update workflow;
- public contributor identity attribution;
- notification and moderation systems.

Deferred items must not block Epic 05 closure.

They must not silently enter Version 1 scope without Architecture Review.

---

# Architecture Status

**FROZEN**

Version 1 architecture of the **Implementation Commitment** Aggregate is approved and locked.

Implementation may begin.

All engineering work must conform to this freeze and referenced Epic 05 architecture documents.

Change requires governance — not implementation convenience.

---

# Final Principle

Implementation Commitment records **voluntary capacity**.

It never assigns work.

This freeze exists so engineering preserves the distinction between **support**, **preparedness** and **execution** throughout Version 1 implementation.

Implementation follows architecture.

Architecture never follows implementation.
