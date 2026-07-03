# EXPERIENCE_ARCHITECTURE

## Humanity Union Platform

Version: 1.0

Status: Draft

---

# Purpose

This document defines the Experience Architecture of Humanity Union.

Experience Architecture is the platform-wide discipline that governs how people understand, orient within and participate in civic processes across Capabilities.

It describes the human-facing layer of the platform without defining domain behavior, persistence, APIs or visual design systems.

Experience Architecture exists to ensure that every Capability presents participation as a coherent civic journey rather than as disconnected product surfaces.

This document establishes Experience Architecture as a first-class architectural concern alongside domain architecture, engineering methodology and interface guidelines.

It defines architectural intent only.

It does not define implementation.

---

# Relationship between Architecture, Experience and Interface

Humanity Union separates three complementary layers.

## Architecture

Architecture defines what the platform is.

It governs:

- Capabilities;
- Aggregates;
- lifecycles;
- boundaries;
- public projections as architectural artifacts;
- platform patterns and engineering principles.

Architecture answers:

"What exists, who owns it and how may it change?"

Architecture lives primarily in `core/`, `governance/` and Capability domain documents.

## Experience

Experience defines how people move through the platform meaningfully.

It governs:

- orientation;
- journey continuity;
- workspace philosophy;
- contextual guidance;
- recognition;
- transparency as participant experience;
- educational framing.

Experience answers:

"Where am I, what matters here and what should I understand before acting?"

Experience Architecture is platform-wide.

It applies across Capabilities while respecting aggregate independence.

## Interface

Interface defines how experience is rendered.

It governs:

- visual hierarchy;
- component reuse;
- accessibility;
- responsive layout;
- calm interaction patterns;
- progressive disclosure.

Interface answers:

"How is the experience presented clearly and consistently?"

Interface principles live in `core/UI_ARCHITECTURE_GUIDELINES.md`.

## Layer Relationship

```
Architecture

↓

Experience

↓

Interface
```

Architecture constrains experience.

Experience constrains interface.

Interface must never redefine domain meaning.

Experience must never mutate aggregate ownership or lifecycle.

The three layers remain distinct but aligned.

---

# Experience Philosophy

Humanity Union experience is designed for civic responsibility, not reactive engagement.

Participation is understood as a journey of understanding, decision, endorsement, commitment, action and impact.

The platform supports thoughtful action through clarity.

It does not optimize for volume, frequency or emotional reaction.

## Core Beliefs

Meaningful participation requires context before action.

Every stage of civic participation has a distinct purpose.

Continuity across stages matters as much as correctness within a stage.

Transparency strengthens trust when paired with responsibility.

Recognition confirms action without judging personal worth.

Guidance should reduce cognitive load, not create pressure.

## Experience Priorities

Experience Architecture prioritizes:

- understanding over speed;
- orientation over discovery;
- one meaningful next step over competing calls to action;
- calm continuity over session maximization;
- civic literacy over product familiarity;
- long-term trust over short-term activity.

## Anti-Patterns

Experience Architecture rejects:

- engagement optimization;
- urgency framing;
- gamification;
- ranking participants by worth or contribution;
- hidden civic meaning;
- collapsing distinct civic stages into one undifferentiated action;
- treating sharing, viewing and participating as equivalent acts.

---

# Participant-Centered Design

Humanity Union is participant-centered in the civic sense.

The participant is a person acting with responsibility within a collective process.

The platform orients around participant questions, not system modules.

## Primary Participant Questions

Every meaningful experience should help participants answer:

1. Where am I?
2. What is this?
3. What have I already done?
4. What can I do now?
5. What comes next?

These questions form the Workspace Standard defined in the Participation Pipeline.

They apply across operational workspaces.

## Participant Roles

Experience Architecture recognizes distinct participant roles.

Examples:

- **Participant** — registered member acting within operational workspaces;
- **Public Visitor** — observer accessing public projections without registration;
- **Steward** — participant with stewardship responsibility over a subject;
- **Observer** — civic, institutional or media reader of public information.

Each role receives experience appropriate to its audience.

Roles must not be blended into one undifferentiated screen when civic clarity would be lost.

## Human Leadership

People choose to participate.

The platform structures, informs and records participation.

It never acts on behalf of participants.

Experience Architecture must preserve agency at every stage.

---

# Collective Participation Journey

The **Collective Participation Journey** is the participant-facing expression of the Participation Pipeline.

It makes one continuous civic process visible across independent Aggregates.

## Journey Stages

```
Idea
        │
        ▼
Initiative
        │
        ▼
Collaborative Analysis
        │
        ▼
Collective Decision
        │
        ▼
Petition
        │
        ▼
Implementation Commitment
        │
        ▼
Implementation
        │
        ▼
Impact
```

Each stage answers a different civic question.

The journey presents continuity of meaning, not continuity of ownership.

## Journey Properties

The Collective Participation Journey is:

- **presentational** — it is not an Aggregate;
- **cross-capability within participation** — it spans Capability 02 stages;
- **orientation-focused** — it helps participants understand position and progress;
- **non-mutating** — it must never change external aggregate lifecycle;
- **historically aware** — completed stages remain visible in context.

## Journey Responsibilities

Every operational workspace should communicate:

- current stage;
- completed stages;
- active eligibility;
- future stages not yet available;
- that the current stage has a distinct civic purpose.

Journey context appears before local interaction.

Local domain action never replaces journey orientation.

---

# Workspace Philosophy

A **Workspace** is the operational environment where registered participants understand and act within one Aggregate.

Workspaces are architectural experience surfaces defined per Aggregate.

They are not generic application pages.

## Workspace Purpose

Workspaces exist to support informed participation within one domain stage.

They combine:

- journey context;
- aggregate overview;
- primary subject;
- supporting referenced context;
- canonical interaction surface;
- derived results;
- Contribution Recognition;
- Next Meaningful Action;
- secondary navigation.

## Workspace Standard

Every Workspace within the Participation Capability answers five questions:

1. Where am I?
2. What is this?
3. What have I already done?
4. What can I do now?
5. What comes next?

This standard creates cognitive consistency across Aggregates.

## Workspace Hierarchy

Workspaces follow a consistent information hierarchy adapted to domain needs:

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

Supporting context may reference other Aggregates read-only.

The workspace must not expose another Aggregate's operational internals.

## Canonical Interaction Surfaces

Each Aggregate defines one canonical interaction surface for its primary civic act.

Examples:

- Decision Panel — Collective Decision;
- Endorsement Panel — Petition;
- Contribution surfaces — Collaborative Analysis.

Secondary actions must remain subordinate to the Next Meaningful Action.

## Empty and Completion States

Workspaces must explain absence and completion calmly.

Empty states inform without pressure.

Completion states confirm outcome and preserve continuity.

Signing, deciding or contributing must not be treated as session termination unless no further civic action exists.

## Workspace Boundaries

Workspaces must never:

- optimize for repeated visits over meaningful action;
- present multiple competing primary actions;
- reopen completed civic questions from earlier stages;
- mutate external Aggregates;
- substitute public projection for operational participation.

---

# Participation Navigator

The **Participation Navigator** is the future platform service responsible for guiding participants through the Participation Pipeline.

It is an experience coordination concept.

It is not an Aggregate.

## Purpose

The Navigator interprets participant state across Aggregates and presents consistent journey guidance.

It prevents each workspace from independently duplicating cross-stage logic.

## Responsibilities

The Participation Navigator will:

- track participant progress across pipeline stages;
- identify current stage and eligibility;
- determine available actions;
- present the Next Meaningful Action;
- generate contextual participation prompts aligned with actual state.

## Boundaries

The Navigator:

- reads aggregate state;
- recommends experience;
- does not own domain lifecycles;
- does not mutate Aggregates;
- does not replace workspace domain responsibilities;
- does not replace public projections.

Until the Navigator exists, workspaces may present aligned local guidance as a temporary presentation concern.

Local guidance must remain consistent with pipeline eligibility and domain decisions.

---

# Next Meaningful Action

The **Next Meaningful Action** is the single contextual recommendation presented after orientation and major state changes.

It is a core Experience Architecture principle.

## Purpose

After meaningful participation, people need one sensible next step tied to actual state.

Multiple equally weighted actions create cognitive overload and mimic engagement-driven product design.

## Rules

Next Meaningful Action must:

- be one prominently recommended action;
- use plain civic language;
- reflect lifecycle state and participant history;
- appear after registration, contribution, decision, endorsement or completion;
- remain calm and non-urgent;
- take precedence over secondary navigation.

Secondary actions may exist.

They must never compete visually or hierarchically with the Next Meaningful Action.

## Examples by Intent

Understanding before action:

- review supporting context;
- wait for a stage to open.

Acting when eligible:

- submit a contribution;
- record a decision;
- sign a petition.

Continuing after action:

- review public record;
- return to participant continuity;
- prepare for a future eligible stage.

The specific action depends on aggregate state.

The experience rule is platform-wide.

---

# Contribution Recognition

**Contribution Recognition** is the platform standard for acknowledging participation without evaluating personal worth.

## Purpose

Civic platforms often confuse acknowledgment with reputation, gamification or moral judgment.

Contribution Recognition confirms what happened.

It does not rank, praise or diminish the person.

## Principles

Recognition must:

- describe the action factually;
- confirm outcome clearly;
- remain brief and calm;
- avoid hero framing, shame language or competitive comparison;
- align with Human Leadership.

Approved examples:

- "Your signature has been recorded."
- "Your participation contributes to public support."
- "Your decision has been recorded."

Not permitted:

- moral evaluation of character;
- leaderboard framing;
- engagement bait;
- implied superiority or failure.

## Scope

Contribution Recognition applies wherever participation materially changes state:

- contribution submitted;
- decision recorded;
- signature recorded;
- commitment declared;
- milestone completed.

Recognition is informational.

It is not reputational.

---

# Contextual Participation

The **Contextual Participation Pattern** governs how one Aggregate supports different entry paths without forking domain meaning.

## Purpose

Community members and public visitors may enter the same civic stage through different paths.

Duplicating aggregates or workspaces for audience type fractures truth and statistics.

## Pattern

One Aggregate.

One lifecycle.

One operational workspace architecture.

Different entry context.

Examples:

- registered community participant enters directly;
- public visitor observes, registers, then continues in the same workspace;
- canonical interaction surface remains identical after registration.

## Experience Rules

Contextual Participation requires:

- public observation without registration where transparency allows;
- Registration Gateway before accountable participation where required;
- preservation of originating context after registration;
- identical civic meaning regardless of entry path;
- no separate community and public workspace variants.

Differences belong to entry experience.

Domain meaning remains unified.

Public participation in Capability 02 begins at the Petition stage for society-facing endorsement.

Earlier stages may expose public projections for transparency while operational participation remains community-centered unless future policy extends public entry.

---

# Transparency

Transparency is both an architectural principle and an experience responsibility.

## Experience Definition

Transparency means participants and observers can understand:

- what exists;
- what stage is active;
- what has been decided;
- what support or progress has been recorded;
- what action is available;
- what remains unknown or incomplete.

Transparency increases through the pipeline.

It never replaces personal responsibility for informed action.

## Operational vs Public Transparency

Experience Architecture preserves two transparency modes.

**Operational transparency** supports informed participation for registered participants within workspaces.

**Public transparency** supports societal observation through public projections.

They remain separate.

Operational participant state must not leak into public view beyond approved public fields.

Aggregate civic meaning must remain publicly understandable where the stage requires public legitimacy.

## Transparency Rules

Transparency must:

- precede pressure to act;
- distinguish viewing, sharing and participating;
- present aggregate meaning before individual exposure;
- preserve historical records after closure;
- use civic language understandable outside the platform.

Transparency must never:

- expose private participant detail by default;
- obscure the civic meaning of a stage;
- imply that observation equals endorsement;
- substitute visibility for accountability.

---

# Educational Experience

Humanity Union experience is intentionally educational.

The platform teaches civic process through structure, not through detached instructional content alone.

## Educational Intent

Every stage should help people learn:

- what kind of civic question is being asked;
- why the current stage exists;
- what informed action requires;
- how this stage relates to earlier and later stages;
- what responsibility accompanies participation.

Education is embedded in orientation, language, hierarchy and journey context.

## Understanding Before Action

Educational experience follows the sequence:

```
Context

↓

Understanding

↓

Available Options

↓

Decision

↓

Outcome

↓

Next Step
```

Participants should never be asked to act without sufficient context.

## Progressive Disclosure

Complex civic information appears progressively.

Essential meaning first.

Supporting detail on request.

Advanced information only when necessary.

Educational experience reduces overwhelm without hiding civic meaning.

## Civic Literacy

Experience Architecture favors language that strengthens public understanding:

- decision before support;
- support before implementation;
- endorsement is not re-decision;
- sharing is not signing;
- registration enables accountable participation.

The platform teaches responsible civic behavior through consistent experience structure.

---

# Long-Term Vision

Experience Architecture is intended to support Humanity Union as a long-lived civic platform.

Its long-term vision includes:

- a universal participant orientation model across Capabilities;
- a mature Participation Navigator serving the full pipeline;
- consistent workspace experience across all Aggregates;
- public projections that make civic process legible to society;
- educational continuity from first observation to impact evaluation;
- calm guidance that scales to communities, organizations and institutions;
- independence from any single political system while supporting responsible collective action.

Experience Architecture should evolve through documented platform standards, not through Epic-local improvisation.

Visual design may change.

Experience principles should remain stable.

Architecture has priority over trends.

Experience has priority over engagement metrics.

## Relationship to Other Documents

Experience Architecture complements:

- `core/UI_ARCHITECTURE_GUIDELINES.md` — interface rendering principles;
- `core/PLATFORM_PATTERNS.md` — engineering patterns including Contextual Participation and Public Endorsement Layer;
- `capabilities/02_participation/PARTICIPATION_PIPELINE.md` — civic lifecycle definition;
- Capability workspace and public projection specifications — stage-specific experience intent.

When experience concepts mature through Epic architecture, they should be extracted into this document or referenced platform patterns rather than remaining isolated in one Capability.

---

# Experience Architecture Principles

The following principles govern Experience Architecture across Humanity Union:

1. **Participant Orientation First** — every experience begins with where the participant is and why it matters.
2. **Journey Continuity** — civic participation is presented as one process across independent stages.
3. **One Meaningful Next Step** — guidance favors one Next Meaningful Action over competing menus.
4. **Recognition Without Judgment** — Contribution Recognition confirms action, not personal worth.
5. **Context Before Commitment** — understanding precedes decision, endorsement and implementation commitment.
6. **Audience Separation** — operational and public experiences serve distinct audiences deliberately.
7. **Calm Participation** — the platform reduces cognitive load and rejects engagement manipulation.
8. **Transparency With Dignity** — public meaning is visible; private participant detail is protected by default.
9. **Entry Context, Unified Meaning** — Contextual Participation preserves one civic truth across entry paths.
10. **Experience Does Not Own Domain** — journey, navigator and workspace guide; Aggregates remain authoritative.

---

# Final Principle

Architecture defines civic structure.

Experience defines civic orientation.

Interface defines civic presentation.

Together they allow Humanity Union to support a continuous journey of understanding, responsibility, collaboration and implementation without collapsing distinct civic stages into a single undifferentiated action.

Participation is not measured by a single action.

Participation is measured by a journey the platform helps people understand.

Humanity Union exists to support that journey responsibly.
