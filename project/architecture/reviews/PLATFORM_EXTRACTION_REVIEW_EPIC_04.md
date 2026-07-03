# PLATFORM_EXTRACTION_REVIEW_EPIC_04

## Humanity Union Platform

Version: 1.0

Status: Draft

Review Type: Platform Concept Extraction Review

Source Epic: Capability 02 — Participation — Epic 04 — Petition

---

# Purpose

Review Epic 04 from the perspective of the entire Humanity Union platform.

This review does not evaluate the Petition Aggregate itself.

It identifies architectural concepts introduced or matured in Epic 04 that should become platform-wide standards.

The objective is to extract reusable civic participation experience patterns before they remain isolated inside one Epic.

---

# Review Scope

Epic 04 documents reviewed:

- `EPIC_04_PETITION.md`
- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`
- `STATE_MACHINE.md`
- `WORKSPACE_SPECIFICATION.md`
- `PUBLIC_PROJECTION.md`

Platform references:

- `core/PLATFORM_PATTERNS.md`
- `core/UI_ARCHITECTURE_GUIDELINES.md`
- `core/DOMAIN_MODELING_GUIDELINES.md`
- `backlog/ARCHITECTURE_BACKLOG.md`

---

# Extraction Criteria

A concept qualifies for platform extraction when it:

- solves a problem that will recur across Capabilities or Epics;
- does not belong exclusively to Petition domain semantics;
- strengthens consistency with existing platform principles;
- can be documented without binding the platform to Petition-specific vocabulary alone.

---

# Extracted Concepts

---

## 1. Workspace Standard

### Name

Operational Workspace Standard

### Origin within Epic 04

- `WORKSPACE_SPECIFICATION.md`
- `DOMAIN_DECISIONS.md` Decisions 09, 10, 11
- Epic workspace hierarchy extending platform UI Architecture Guidelines

Epic 04 matures the workspace model beyond the generic hierarchy already defined for Initiative, Collaborative Analysis and Collective Decision workspaces.

It adds:

- four participant orientation questions;
- Participation Journey Context as a first-class section;
- canonical interaction panel pattern (Endorsement Panel);
- explicit empty and completion states;
- secondary action subordination rules;
- anti-engagement prohibitions as architectural requirements.

### Problem it solves

Without a shared workspace standard, each Aggregate risks inventing its own information hierarchy, action prioritization and completion behavior.

Epic 04 demonstrates that operational workspaces must answer the same participant questions consistently while adapting content to aggregate domain.

### Platform applicability

All operational workspaces across Humanity Union:

- Initiative Workspace
- Collaborative Analysis Workspace
- Collective Decision Workspace
- Petition Workspace
- future Implementation Commitment and Governance workspaces

Applies to any Aggregate following the Platform Aggregate Pattern.

### Recommendation

Promote Epic 04 workspace conventions into `core/UI_ARCHITECTURE_GUIDELINES.md` as an **Operational Workspace Standard** section.

The standard should codify:

- the four orientation questions;
- journey context placement;
- canonical panel naming by domain action (Decision Panel, Endorsement Panel, etc.);
- empty and completion state requirements;
- secondary action subordination to one primary recommendation;
- explicit anti-engagement prohibitions.

Do not copy Petition-specific section names into the platform standard.

Extract the structural rules only.

### Status

Proposed

---

## 2. Collective Participation Journey

### Name

Collective Participation Journey

### Origin within Epic 04

- `DOMAIN_MODEL.md` — Collective Participation Journey section
- `WORKSPACE_SPECIFICATION.md` — Participation Journey Context, Participant Journey Integration
- `DOMAIN_LANGUAGE.md` — pipeline vocabulary and Participant Workspace continuity

Epic 04 names and structures the cross-stage civic path:

```
Initiative → Analysis → Decision → Petition → Implementation Commitment → Implementation → Impact
```

It requires workspaces to communicate current stage, completed stages and possible future stages without owning external aggregate state.

### Problem it solves

Participants experience the platform as disconnected screens unless the civic pipeline is visible as one continuous journey.

Without a platform concept, each workspace shows only local context and participants lose orientation across stages.

### Platform applicability

All stages of Capability 02 Participation.

Extensible to future Capabilities where multi-stage civic processes exist.

Does not apply to isolated administrative or identity-only interfaces.

### Recommendation

Accept **Collective Participation Journey** as a platform presentation concept.

Document in `core/UI_ARCHITECTURE_GUIDELINES.md` as a cross-workspace orientation model.

Define:

- journey is presentational, not an aggregate;
- stages map to independent Aggregates;
- future stages may appear as inactive placeholders;
- journey context must never mutate external aggregate lifecycle.

Defer a dedicated journey data model until Participation Navigator exists.

### Status

Approved

---

## 3. Participation Navigator

### Name

Participation Navigator

### Origin within Epic 04

- `DOMAIN_DECISIONS.md` Decision 11
- `WORKSPACE_SPECIFICATION.md` — Participation Navigator Integration
- `IMPLEMENTATION_PLAN.md` — future platform service reference

Epic 04 explicitly assigns journey interpretation and Next Meaningful Action recommendation to a future platform-level service outside any single Aggregate.

### Problem it solves

Cross-aggregate journey logic duplicated inside each workspace will diverge, contradict domain boundaries and become unmaintainable as the pipeline grows.

A navigator service centralizes state interpretation and recommendation while preserving aggregate independence.

### Platform applicability

Platform-wide participation experience layer.

Consumes read-only aggregate state.

Serves all operational workspaces and potentially Participant Workspace in Capability 01 integration.

Does not replace aggregate command APIs or domain transitions.

### Recommendation

Accept **Participation Navigator** as a deferred platform service concept.

Add to `backlog/ARCHITECTURE_BACKLOG.md` as a new accepted backlog item.

Do not define service contracts until at least Epic 04 workspace behavior is validated through architecture completion.

Until the service exists, workspaces may apply aligned local presentation rules as a temporary concern, as Epic 04 already permits.

### Status

Proposed

---

## 4. Next Meaningful Action

### Name

Next Meaningful Action

### Origin within Epic 04

- `DOMAIN_DECISIONS.md` Decision 10
- `WORKSPACE_SPECIFICATION.md` — Next Meaningful Action section and presentation rules
- `PUBLIC_PROJECTION.md` — operational-only distinction

Epic 04 elevates a single contextual recommendation from an implicit UI guideline into an explicit architectural decision with lifecycle-aware examples and anti-patterns.

### Problem it solves

Multiple equally weighted calls to action create cognitive overload and mimic engagement-optimized product design.

After meaningful participation, participants need one sensible next step tied to actual state, not a generic navigation menu.

### Platform applicability

All operational workspaces after state-changing participation events:

- contribution submitted;
- decision recorded;
- signature recorded;
- stage completed;
- registration completed from public entry.

Also applies to calm empty states where the next step is understanding rather than acting.

### Recommendation

Accept **Next Meaningful Action** as a platform UI architecture principle.

Add to `core/UI_ARCHITECTURE_GUIDELINES.md` alongside Calm Interface and Understanding Before Action.

Rules:

- one prominently recommended action;
- tied to lifecycle and participant history;
- secondary actions visually and hierarchically subordinate;
- never framed as urgency, gamification or competitive ranking;
- eventual computation may move to Participation Navigator without changing presentation rules.

### Status

Approved

---

## 5. Contextual Participation Pattern

### Name

Contextual Participation Pattern

### Origin within Epic 04

- `DOMAIN_DECISIONS.md` Decision 03 — Community and Public Participation as modes of one Aggregate
- `WORKSPACE_SPECIFICATION.md` — Community vs Public Behavior
- `STATE_MACHINE.md` — dual entry paths under one lifecycle
- `PUBLIC_PROJECTION.md` — public observation path

Epic 04 defines one aggregate, one workspace model and one canonical action surface with different entry contexts rather than forked products.

### Problem it solves

Platforms often duplicate domain models or workspaces for "internal users" versus "public users."

That duplication fractures statistics, lifecycle truth and civic meaning.

The pattern preserves one source of truth while respecting different entry experiences.

### Platform applicability

Any Aggregate that supports:

- registered community participation; and
- public observation with optional authenticated participation.

Likely future candidates:

- Implementation Commitment;
- Governance participation;
- public consultation stages beyond Petition.

Not required for aggregates with community-only participation.

### Recommendation

Add **Contextual Participation Pattern** to `core/PLATFORM_PATTERNS.md`.

Document:

- one Aggregate, one lifecycle, one operational workspace architecture;
- entry context differs, domain meaning does not;
- public projection supports observation before registration;
- canonical panel remains identical after registration;
- statistics and records derive from one participation set.

### Status

Approved

---

## 6. Contribution Recognition

### Name

Contribution Recognition

### Origin within Epic 04

- `DOMAIN_DECISIONS.md` Decision 09
- `DOMAIN_LANGUAGE.md` — Contribution Recognition vocabulary
- `DOMAIN_MODEL.md` — ContributionRecognition value object
- `WORKSPACE_SPECIFICATION.md` — Contribution Recognition Messages

Epic 04 defines participant-facing acknowledgment as action confirmation without moral evaluation, hero framing or comparative ranking.

### Problem it solves

Civic platforms frequently confuse acknowledgment with reputation, gamification or character judgment.

That undermines Human Leadership and creates unintended social pressure.

Contribution Recognition separates factual confirmation from personal evaluation.

### Platform applicability

All participant-facing completion and state-change moments across Humanity Union:

- contribution recorded;
- decision submitted;
- signature recorded;
- stewardship action confirmed;
- future governance actions.

Applies to UI copy standards and messaging architecture, not to domain aggregates unless an aggregate explicitly owns recognition messages.

### Recommendation

Accept **Contribution Recognition** as a platform communication standard.

Add to `core/UI_ARCHITECTURE_GUIDELINES.md` with approved and prohibited message examples.

Clarify in `core/DOMAIN_MODELING_GUIDELINES.md` that recognition messages are presentation concerns unless an aggregate explicitly models them as derived participant-facing output.

Do not introduce reputation, scoring or moral language in recognition copy.

### Status

Approved

---

## 7. Registration Gateway

### Name

Registration Gateway

### Origin within Epic 04

- `DOMAIN_DECISIONS.md` Decisions 04, 05
- `DOMAIN_LANGUAGE.md` — Registration Gateway definition
- `DOMAIN_MODEL.md` — RegistrationGateway value object
- `PUBLIC_PROJECTION.md` — public entry point from observation to participation
- `WORKSPACE_SPECIFICATION.md` — public entry continuity

Epic 04 positions Registration Gateway as the experiential boundary between Public Visitor observation and authenticated participation, distinct from identity administration.

### Problem it solves

Platforms blur read access, share access and accountable participation.

Without a named gateway concept, registration requirements appear arbitrary and public transparency weakens either through excessive friction or insufficient accountability.

The gateway preserves:

- public read and share without identity;
- registration only when acting;
- continuity of originating participation context after registration.

### Platform applicability

All public-facing participation entry points across Capabilities:

- Petition signing;
- future public consultations;
- open governance participation;
- any aggregate where society may observe before registering.

Requires explicit boundary with Capability 01 — Human Identity.

Identity administration remains outside participation Aggregates.

### Recommendation

Accept **Registration Gateway** as a cross-capability experience pattern.

Document in `core/PLATFORM_PATTERNS.md` as a boundary pattern between Public Projection and operational participation.

Add a cross-reference in `core/SYSTEM_ARCHITECTURE.md` defining:

- Capability 01 owns identity lifecycle;
- participation Aggregates own eligibility and action rules;
- gateway preserves originating aggregate context through registration handoff.

Resolve whether RegistrationGateway remains a domain value object or is strictly an experience concept in a future domain modeling clarification.

Do not implement gateway contracts until Capability 01 and Epic 04 architecture harmonization is complete.

### Status

Proposed

---

## 8. Public Endorsement Layer

### Name

Public Endorsement Layer

### Origin within Epic 04

- `EPIC_04_PETITION.md` — public influence model, Decision Before Support
- `DOMAIN_DECISIONS.md` Decision 02 — Petition as Public Endorsement stage
- `DOMAIN_LANGUAGE.md` — Public Endorsement definition
- `PUBLIC_PROJECTION.md` — transparency principles, aggregate-over-individual, lifecycle visibility

Epic 04 defines a civic layer that follows legitimacy established by prior decision-making and extends collective intent into society through transparent aggregate support.

### Problem it solves

Generic signature or vote-like mechanics detach public support from informed collective legitimacy.

Institutions and society cannot distinguish authorized decision from popular momentum.

The Public Endorsement Layer preserves the sequence:

decision establishes legitimacy;

endorsement demonstrates support;

implementation remains a separate civic question.

### Platform applicability

Primary home: Capability 02 Participation Pipeline after Collective Decision.

Reusable principles beyond Petition:

- Decision Before Action at civic scale;
- aggregate public statistics with protected individual identity;
- immutable participation records;
- public observation without registration;
- explicit distinction between viewing, sharing and endorsing.

Future subject types (policy, organization, institution) may reuse the layer without renaming the civic pattern.

### Recommendation

Accept **Public Endorsement Layer** as a Participation Pipeline stage pattern in `core/PLATFORM_PATTERNS.md`.

Document as a pattern, not as a generic platform feature every Capability must implement.

Codify transparency principles from Epic 04 Public Projection as reusable publicity rules for any future endorsement-class aggregate:

- aggregate over individual in public view;
- read-only public record;
- stable civic language;
- no hidden endorsement mechanics;
- historical preservation after closure.

Do not create a separate `PARTICIPATION_ENGINE.md` unless platform scope explicitly requires it.

### Status

Approved

---

# Additional Observations

Epic 04 also reinforces existing platform patterns without requiring new extraction:

- Platform Aggregate Pattern — unchanged
- Operational View vs Public View — strengthened
- Projection Pattern — strengthened
- Audience-Centered Architecture — strengthened
- Capability Pipeline Pattern — extended with endorsement stage semantics
- Derived State Pattern — Support Metrics and Petition Outcome

These reinforcements validate prior platform architecture rather than introducing new standards.

---

# Platform Standards Accepted

The following concepts are architecturally mature enough to enter the platform Architecture Library as accepted standards or principles:

| Concept | Recommended Home | Status |
|---------|------------------|--------|
| Collective Participation Journey | `core/UI_ARCHITECTURE_GUIDELINES.md` | Approved |
| Next Meaningful Action | `core/UI_ARCHITECTURE_GUIDELINES.md` | Approved |
| Contextual Participation Pattern | `core/PLATFORM_PATTERNS.md` | Approved |
| Contribution Recognition | `core/UI_ARCHITECTURE_GUIDELINES.md` | Approved |
| Public Endorsement Layer | `core/PLATFORM_PATTERNS.md` | Approved |

These concepts align with existing principles:

- Human Leadership
- Explicit Publicity
- Calm Interface
- Understanding Before Action
- Audience-Centered Architecture
- Aggregate Independence

They do not require new platform services before documentation adoption.

---

# Platform Standards Deferred

The following concepts are valid but should remain deferred until supporting platform boundaries or validation exist:

| Concept | Reason for Deferral | Target |
|---------|---------------------|--------|
| Operational Workspace Standard | Requires consolidation of Epic 01–04 workspace conventions into one platform section; Petition spec is most mature but not yet canonical across all workspaces | `core/UI_ARCHITECTURE_GUIDELINES.md` |
| Participation Navigator | Explicitly future platform service; no cross-aggregate contract yet | `backlog/ARCHITECTURE_BACKLOG.md` then future service specification |
| Registration Gateway | Requires Capability 01 boundary specification and handoff contract before platform pattern is complete | `core/PLATFORM_PATTERNS.md`, `core/SYSTEM_ARCHITECTURE.md` |
| Participant Workspace | Introduced in Epic 04 domain language but owned by cross-capability participant experience; not yet a platform document | Capability 01 integration phase |

Deferral is intentional.

It preserves Architectural Patience and prevents premature platform abstraction.

---

# Architecture Library Updates Required

The following updates should occur after this review is accepted.

No updates are required before Epic 04 architecture harmonization completes.

## Immediate documentation updates

1. **`core/UI_ARCHITECTURE_GUIDELINES.md`**
   - Add Collective Participation Journey orientation model
   - Add Next Meaningful Action principle and presentation rules
   - Add Contribution Recognition communication standard

2. **`core/PLATFORM_PATTERNS.md`**
   - Add Contextual Participation Pattern
   - Add Public Endorsement Layer as Participation Pipeline stage pattern

3. **`backlog/ARCHITECTURE_BACKLOG.md`**
   - Add Participation Navigator as accepted backlog item with Epic 04 origin reference

4. **`project/architecture/README.md`**
   - Add this review to `reviews/` navigation

## Deferred documentation updates

5. **`core/UI_ARCHITECTURE_GUIDELINES.md`**
   - Add Operational Workspace Standard after cross-Epic workspace consolidation

6. **`core/PLATFORM_PATTERNS.md`**
   - Add Registration Gateway boundary pattern after Capability 01 handoff is defined

7. **`core/SYSTEM_ARCHITECTURE.md`**
   - Document identity-to-participation gateway boundary

8. **`core/DOMAIN_MODELING_GUIDELINES.md`**
   - Clarify experience-boundary concepts versus aggregate-owned state for gateway and recognition messaging

## Not recommended at this time

- Creating `PARTICIPATION_ENGINE.md` — unnecessary; patterns belong in existing library documents
- Creating `DECISION_ENGINE.md` — out of scope for this extraction review
- Promoting Petition-specific vocabulary platform-wide — extract patterns, not Petition nouns

---

# Extraction Verdict

Epic 04 introduces substantial platform value beyond the Petition domain.

Five concepts are ready for acceptance into the Architecture Library.

Three concepts are correctly identified as platform direction but require deferral until boundary contracts and cross-Epic consolidation exist.

Epic 04 should be treated as the reference Epic for civic participation experience standards, not as an isolated Aggregate specification.

---

# Final Principle

Platform extraction exists to prevent good architectural ideas from dying inside one Epic.

Epic 04 matures Humanity Union from decision-making infrastructure into public civic participation infrastructure.

The platform should absorb the experience patterns while keeping Petition domain semantics inside Capability 02.

Consistency across the civic journey matters as much as consistency across engineering layers.
