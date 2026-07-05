# PARTICIPATION_ARCHITECTURE_FREEZE

## Humanity Union Platform

## Capability 02 — Participation

Version: 1.0

Status: Approved

---

# 1. Purpose

This document freezes the Version 1 architecture of **Capability 02 — Participation**.

Its purpose is to establish the architectural baseline for all future Participation development.

After this freeze:

- implementation must conform to the decisions recorded here;
- architectural drift requires an explicit review and approved change;
- new Aggregates, stages and experience patterns must not redefine frozen responsibilities without governance action.

This document records **architectural intent only**.

It does not define implementation.

It does not authorize new features by itself.

The Participation vertical slice through **Implementation** (Idea → Initiative → Collaborative Analysis → Collective Decision → Petition → Implementation Commitment → Implementation) is the implemented expression of this frozen architecture through Stage 7. **Impact** remains architecturally defined but is not yet implemented.

---

# 2. Capability Scope

Capability 02 — Participation governs how Humanity Union supports the complete civic lifecycle from structured proposal through collective understanding, decision, public endorsement, implementation commitment, execution and impact.

Capability 02 includes:

- Participation Aggregates and their lifecycles;
- operational Workspaces for registered participants;
- Public Projections for observers and society;
- the Collective Participation Journey;
- experience standards for orientation, recognition and guidance;
- references between Aggregates without ownership transfer.

Capability 02 does not include:

- identity administration (Capability 01);
- intelligence service implementation details;
- visual design systems;
- authentication infrastructure;
- unrelated platform capabilities.

Participation exists to support **informed, responsible civic action** — not engagement volume.

---

# 3. Participation Pipeline

The Participation Pipeline is the canonical civic lifecycle.

```
Idea                                    Architecture Approved — Implementation Complete
        │
        ▼
Initiative                              Architecture Approved — Implementation Complete
        │
        ▼
Collaborative Analysis                  Architecture Approved — Implementation Complete
        │
        ▼
Collective Decision                     Architecture Approved — Implementation Complete
        │
        ▼
Petition                                Architecture Approved — Implementation Complete
        │
        ▼
Implementation Commitment               Architecture Approved — Implementation Complete
        │
        ▼
Implementation                          Architecture Approved — Implementation Complete
        │
        ▼
Impact                                  Architecture Approved — Not Yet Implemented
```

Each stage answers a distinct civic question.

Each stage prepares the next.

No stage replaces another.

The pipeline is **presentational in experience** and **independent in architecture**.

Aggregate lifecycles do not merge.

Journey continuity does not imply aggregate ownership.

---

# 4. Aggregate Responsibilities

Each stage owns exactly one Aggregate in Version 1.

## Initiative

**Primary question:** "What exactly is being proposed?"

**Responsibility:**

- structured proposal;
- scope, objectives and expected outcomes;
- initiative metadata and stewardship reference;
- proposal lifecycle independent of later stages.

**Output:** Structured Initiative.

## Collaborative Analysis

**Primary question:** "What do we know?"

**Responsibility:**

- collaborative understanding;
- contributions and signals;
- evidence and argument collection;
- readiness assessment derived from analysis activity;
- analysis summaries for informed later stages.

**Output:** Shared understanding and readiness context.

**Does not decide.** Understanding precedes decision.

## Collective Decision

**Primary question:** "What has the community decided?"

**Responsibility:**

- ballot and participant decisions;
- decision engine application;
- decision result and outcome derivation;
- eligibility for subsequent Petition stage when outcome is Approved.

**Output:** Approved or rejected collective decision.

**Does not create Petition automatically.** Approval establishes eligibility; Petition progression remains explicit.

## Petition

**Primary question:** "Does society publicly support this decision?"

**Responsibility:**

- public endorsement after approved collective decision;
- immutable signatures during Open state;
- derived support metrics and petition outcome;
- share link for public observation and distribution;
- one signature per participant per petition.

**Output:** Verified aggregate public support.

**Does not reopen collective decision.** Endorsement follows approval; it does not replay the ballot.

## Implementation Commitment

**Primary question:** "Who is prepared to help?"

**Responsibility:**

- collect implementation commitments;
- match skills and volunteer capacity;
- coordinate readiness to act on approved direction;
- prepare implementation resources.

**Output:** Implementation-ready community.

**Status in Version 1:** Architecture Approved. Implementation Complete.

## Implementation

**Primary question:** "What is being done?"

**Responsibility:**

- coordinate execution of approved direction;
- track progress and completion;
- publish operational and public transparency during execution;
- preserve historical integrity of actions taken.

**Output:** Completed implementation record.

**Status in Version 1:** Architecture Approved. Implementation Complete.

## Impact

**Primary question:** "What changed?"

**Responsibility:**

- measure societal outcomes;
- compare expected and actual results;
- capture lessons for future participation;
- support long-term civic learning.

**Output:** Knowledge for future Initiatives.

**Status in Version 1:** Architecture Approved. Not yet implemented.

---

# 5. Aggregate Independence Rules

The following rules are frozen for Capability 02.

1. **One Aggregate — One Responsibility.** No Aggregate owns another Aggregate's domain objects or lifecycle.

2. **Aggregate References Only.** Aggregates communicate through identifiers, approved snapshots and read-only context — never through embedded operational graphs of external aggregates.

3. **No Cross-Aggregate Mutation.** A Petition must not modify an Initiative, Collaborative Analysis or Collective Decision. The reverse is equally forbidden unless an explicit future platform rule is approved through Architecture Review.

4. **No Duplicate Ownership.** Support metrics belong to Petition. Readiness belongs to Collaborative Analysis. Decision results belong to Collective Decision. Derived values are not copied into owning aggregates of another stage.

5. **Explicit Eligibility, Not Implicit Creation.** Later stages may require eligibility from earlier outcomes but must not silently instantiate or mutate earlier aggregates.

6. **One Lifecycle Per Aggregate.** Community and Public participation share one aggregate model and one lifecycle per stage. Entry path differences belong to experience, not domain forks.

7. **Historical Integrity.** Recorded participation artifacts (contributions, decisions, signatures, commitments) are immutable once recorded under applicable policy.

8. **Progressive Bootstrap.** Bootstrap data may pre-link pipeline identifiers for vertical slice verification. Bootstrap must not weaken eligibility or boundary rules in production semantics.

---

# 6. Operational Workspace vs Public Projection

Operational Workspace and Public Projection are intentionally separate surfaces.

| Surface               | Audience                            | Purpose                                     | Writable                              |
| --------------------- | ----------------------------------- | ------------------------------------------- | ------------------------------------- |
| Operational Workspace | Registered participants             | Informed participation within one Aggregate | Through operational API commands only |
| Public Projection     | Public visitors, observers, society | Transparency and civic observation          | Read-only                             |

## Operational Workspace includes

- personal participation status where applicable;
- canonical interaction surfaces (Decision Panel, Endorsement Panel, etc.);
- participant journey continuity;
- Next Meaningful Action;
- operational navigation and command paths.

## Public Projection includes

- aggregate summary in civic language;
- approved public context from referenced stages;
- aggregate public statistics;
- share reference;
- participation entry guidance (registration before accountable action where required).

## Public Projection must never include

- whether an anonymous viewer has participated;
- individual signer or voter identity lists in Version 1 default;
- operational controls;
- internal policy mechanics beyond public eligibility summary;
- another aggregate's full operational state.

A person may read Public Projection without identity.

Accountable participation requires registration and operational workspace entry where policy requires it.

Public participation in society-facing endorsement begins at the **Petition** stage.

Earlier stages may expose public projections for transparency while operational participation remains community-centered unless a future approved policy extends public entry.

---

# 7. Workspace Standard

Every operational Workspace within Capability 02 must help participants answer five questions:

1. **Where am I?**
2. **What is this?**
3. **What have I already done?**
4. **What can I do now?**
5. **What comes next?**

These questions are mandatory.

No workspace section may obscure this orientation model.

## Standard information hierarchy

```
Participation Journey Context

↓

Stage Overview

↓

Primary Subject

↓

Supporting Context

↓

Canonical Interaction

↓

Derived Results

↓

Contribution Recognition

↓

Next Meaningful Action

↓

Secondary Actions
```

Rules:

- context precedes action;
- action precedes navigation;
- one canonical interaction surface per aggregate primary civic act;
- secondary actions remain subordinate to Next Meaningful Action;
- supporting context is read-only and must not reopen completed civic questions from earlier stages.

---

# 8. Experience Architecture

Experience Architecture is the platform-wide discipline governing how people orient within and move through civic processes.

Experience is distinct from domain architecture and from interface rendering.

```
Architecture

↓

Experience

↓

Interface
```

Experience Architecture within Capability 02 is frozen around these commitments:

- **Understanding before action** — participants must understand what they are supporting or deciding before primary civic acts.
- **Calm participation** — no urgency framing, gamification or engagement manipulation.
- **Human leadership** — people choose; the platform informs and records; it never acts on their behalf.
- **Journey continuity** — participation is a continuity, not an isolated click.
- **Transparency with dignity** — public legitimacy through aggregate transparency, not exposure of private participation detail.
- **Contextual participation** — one aggregate, one lifecycle, one workspace architecture; entry path differences belong to registration and observation experience only.

Experience must never mutate aggregate ownership, lifecycle or cross-aggregate truth.

---

# 9. Participation Navigator

The **Participation Navigator** is a future platform experience service.

It is **not an Aggregate**.

## Frozen responsibilities

The Participation Navigator will:

- track participant progress across pipeline stages;
- identify current stage and eligibility;
- determine available actions from read-only aggregate state;
- present the Next Meaningful Action consistently;
- generate contextual participation prompts aligned with actual eligibility.

## Frozen boundaries

The Participation Navigator:

- reads aggregate state;
- recommends experience;
- does **not** own domain lifecycles;
- does **not** mutate aggregates;
- does **not** replace workspace domain responsibilities;
- does **not** replace public projections.

Until the Navigator exists, workspaces may compute aligned local Next Meaningful Action presentation.

Local fallback logic must remain consistent with pipeline eligibility and frozen domain decisions.

Navigator introduction must not fork workspace architecture.

---

# 10. Contribution Recognition

**Contribution Recognition** is the frozen platform standard for acknowledging participation without evaluating personal worth.

## Purpose

Recognition confirms what happened.

It does not rank, praise or diminish the person.

## Frozen principles

Recognition must:

- describe the action factually;
- confirm outcome clearly;
- remain brief and calm;
- avoid hero framing, shame language and competitive comparison;
- align with Human Leadership.

Approved examples:

- "Your signature has been recorded."
- "Your participation contributes to public support."
- "Your decision has been recorded."

Not permitted:

- moral evaluation of character;
- leaderboard or ranking framing;
- engagement bait;
- implied superiority or failure.

Recognition is informational.

It is not reputational.

Recognition applies after material participation state changes (contribution submitted, decision recorded, signature recorded, commitment declared, milestone completed).

---

# 11. Humanity Assistant

The **Humanity Assistant** is the platform's contextual guidance layer for civic participation.

It is an experience and intelligence boundary — not an Aggregate and not a substitute for human judgment.

The Humanity Assistant supports understanding within Capability 02.

It does not own lifecycle, record participation or replace canonical interaction surfaces.

## Frozen platform principles

1. **Assistant never replaces judgment.** The Assistant may clarify, summarize and orient. It must not decide, sign, vote or commit on behalf of a participant.

2. **Assistant explains before recommending.** Context and meaning precede suggested next steps. Recommendations must follow comprehension.

3. **Assistant reduces complexity, not responsibility.** The Assistant simplifies navigation and language. It does not remove accountability for civic action.

4. **Assistant is contextual.** Guidance must reflect the participant's current stage, eligibility and referenced aggregate context — not generic engagement prompts.

5. **Assistant is transparent.** The Assistant must not conceal that it is automated guidance, what data it uses at a high level, or when uncertainty remains.

## Boundaries

The Humanity Assistant:

- may read approved operational and public context to explain;
- may align with Next Meaningful Action and Participation Navigator when present;
- must not mutate aggregates;
- must not expose private participation of other participants;
- must not use moral ranking, urgency or gamification;
- must not bypass Registration Gateway or canonical interaction surfaces for accountable acts.

The Assistant supports civic literacy.

It does not optimize for session volume.

---

# 12. Living Policy Lifecycle

Participation policies — eligibility, visibility, endorsement rules, decision rules and similar governance configuration — follow a **Living Policy Lifecycle**.

Policies evolve deliberately before they become binding civic constraints.

## Stages

```
Suggested

↓

Initial

↓

Refined

↓

Approved

↓

Frozen

↓

Satisfied
```

### Suggested

A policy idea is proposed.

It has no operational force.

It exists for discussion and architectural alignment.

### Initial

A policy draft exists with enough structure to review.

It may appear in workspace or public copy as provisional.

It must not be treated as enforceable domain policy.

### Refined

A policy draft has been revised through review.

Ambiguity is reduced.

It remains non-binding until approval.

### Approved

A policy is accepted for operational use.

It may govern eligibility, visibility and participation rules within its scope.

It is not yet immutable.

### Frozen

A policy is locked for a defined civic context or lifecycle window.

Changes require explicit Architecture Review or Engineering Decision.

Frozen policy provides stable rules for derived readiness and accountable participation.

### Satisfied

A policy's purpose has been fulfilled or superseded by a later approved policy generation.

Historical meaning is preserved.

The policy no longer governs new participation but remains auditable.

Living Policy progression prevents accidental policy drift and separates exploration from enforceable civic rules.

---

# 13. Collective Capacity

**Collective Capacity** describes what a community can realistically contribute toward implementation — skills, volunteer availability, organizational support, regional presence and related commitment potential.

Collective Capacity is observed and recorded through participation activity.

It is not a single manually edited score owned by one screen.

## Implementation Readiness

Implementation Readiness is a **derived value**.

```
Community Capacity

+

Frozen Policy

↓

Implementation Readiness
```

### Why Readiness is derived

Implementation Readiness must not be manually entered as a substitute for truth.

If readiness were editable, the platform could claim implementation preparedness without evidence — weakening public trust and bypassing aggregate boundaries.

Readiness is therefore computed from:

- **Community Capacity** — observable community contribution potential gathered through participation stages (analysis contribution, decision participation, endorsement support, future commitment signals);
- **Frozen Policy** — approved and frozen rules defining what "ready" means for a given context (thresholds, required evidence, eligibility, governance constraints).

The derivation preserves:

- **Explicit Publicity** — observers understand readiness as an outcome of recorded activity and policy, not administrator opinion;
- **Historical Integrity** — readiness changes trace back to activity and policy state;
- **Aggregate Independence** — readiness for implementation commitment is not falsely owned by an earlier aggregate's manual field;
- **Human Leadership** — people and communities produce capacity; policy defines constraints; the platform derives readiness transparently.

Collaborative Analysis **Readiness** and **Implementation Commitment** readiness are expressions of this principle at different pipeline stages.

---

# 14. Engineering Principles

The following engineering principles are frozen for Capability 02 Version 1.

## One Aggregate — One Responsibility

Each Aggregate owns one civic purpose, one lifecycle and one primary canonical interaction.

## Aggregate References Only

Cross-stage integration uses identifiers, approved snapshots and read-only summaries.

No aggregate embeds another aggregate's operational root.

## Operational / Public Separation

Operational API and Workspace serve participants.

Public Projection serves transparency.

Distinct endpoints. Distinct DTOs. No operational leakage into public models.

## Interface follows Experience

Experience Architecture defines orientation, hierarchy and civic meaning.

Interface renders experience.

Interface must not redefine domain semantics.

## Structure → Behavior → Experience

Implementation order and dependency direction are frozen:

1. **Structure** — domain types and aggregate boundaries in `@hu/types`;
2. **Behavior** — commands, transitions, invariants and derived values;
3. **Experience** — workspace, public projection, navigator and assistant presentation.

Experience must not precede or redefine structure.

## Thin API

API validates, invokes behavior/store, maps responses.

Business rules do not live in controllers as duplicated authority.

Standard response envelope is mandatory.

## Public Projection Pattern

Public models are built by projection builders from aggregate truth.

Public routes never serialize operational aggregates directly.

## Next Meaningful Action

One primary recommendation per stable workspace state.

State-aware. Calm. Subordinate secondary navigation.

Never a competing menu of unrelated actions.

---

# 15. Change Policy

Capability 02 frozen architecture may change **only** through:

1. **Architecture Review** — formal review of domain, boundaries, pipeline position, public/operational separation or experience standards;
2. **Engineering Decision** — recorded decision for bounded implementation interpretation within frozen architecture;
3. **Architecture Freeze update** — new version of this document with explicit version increment and approval.

The following are **not** valid architecture change paths:

- implementation convenience;
- UI-only reinterpretation that alters civic meaning;
- undocumented store or API behavior;
- merging aggregates to reduce navigation;
- exposing private participation through public surfaces;
- bypassing eligibility gates between pipeline stages.

Accidental architecture evolution is forbidden.

Version 1 implementation through **Implementation** establishes precedent but does not silently extend scope to **Impact** without review.

---

# Capability 02 Architecture Status

**STABLE**

Capability 02 — Participation Version 1 architecture is approved and frozen.

The Participation Pipeline, aggregate responsibilities, independence rules, operational/public separation, workspace standard, experience architecture, navigator boundaries, contribution recognition, Humanity Assistant principles, living policy lifecycle, collective capacity model and engineering principles defined in this document constitute the architectural baseline for all future Participation development.

Implementation must conform.

Change requires governance.

---

# Final Principle

Participation is measured by a continuous journey of understanding, responsibility, collaboration and implementation — not by isolated clicks or engagement volume.

Humanity Union exists to support that journey while preserving aggregate independence, public transparency and human judgment at every stage.
