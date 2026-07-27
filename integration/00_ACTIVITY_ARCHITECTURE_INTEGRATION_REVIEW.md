# Humanity Union Activity Architecture Integration Review

## Version 1.0

### Pre-Implementation Integration Review — Activity-Centered Product Vision vs Existing Architecture

---

# Document Purpose

Humanity Union already has a mature, reviewed, and release-gated engineering architecture (Blueprint, Validation, ADR, Engineering `00`–`11`, Canonical Event Catalogue).

A subsequent product vision proposes organizing the platform around **Activity as its central coordination object**, with a lifecycle spanning Discussion, Analysis, Proposal, Decision, Implementation, and Impact.

**This document does not redesign Humanity Union.**  
**It does not replace existing architecture.**  
**It does not create a second platform.**

It reviews how the Activity-centered product vision relates to the existing architecture and identifies the safest path to integration before implementation begins.

**Authoritative sources reviewed:**

| Layer | Documents |
|-------|-----------|
| Blueprint | Activity Engine (05), Discussion Model (06), Allies (07), Working Groups (08), Workspace (09), Activity Inbox (10), AI Facilitator (11), Decision Lifecycle (12), Institution Formation (15), Proposal Framework (17) |
| Validation | Architecture Validation Scenarios, Scenario Playbook |
| ADR | ADR-001 through ADR-010 (especially ADR-002 Activity, ADR-003 Discussion/Decision, ADR-005 AI, ADR-007 Working Groups) |
| Engineering | `00`–`11`, Canonical Event Catalogue, Release Readiness Review, Documentation Alignment Report |
| Governance | Engineering Manifesto, Blueprint authority principle |

---

# 1. Summary of Current Humanity Union Architecture

The existing architecture is a **Member-first, domain-driven, event-driven platform** decomposed into bounded contexts. Each context owns its aggregates, business rules, and persistence. Cross-context coordination uses commands, queries, integration events, and application workflows—not shared mutable state.

## 1.1 Architectural Layers

| Layer | Role |
|-------|------|
| **Blueprint** | Civic product and behavioral specification |
| **Validation** | Scenario-based proof of architectural intent |
| **ADR** | Recorded architectural decisions |
| **Engineering `00`–`11`** | Normative implementation architecture |
| **Canonical Event Catalogue** | Single source of truth for 50 domain events |
| **Application Workflows (`11`)** | Cross-context choreography without ownership violations |

Release Readiness Review (89/100) and Documentation Alignment Report confirm the stack is **implementation-ready** with Catalogue-governed event vocabulary.

## 1.2 Major Building Blocks and Their Roles

### Identity

Establishes **session access** and **verification level**. Publishes `MemberAuthenticated`, `MemberVerified`, `SessionEnded`. Distinct from Member registration (`MemberRegistered`) and from civic authority.

### Member

Represents **registered civic existence**, profile, Civic Responsibility Profile, and Social Activity Plan coordination. Publishes `MemberRegistered`, `MemberProfileUpdated`, `ResponsibilityProfileUpdated`, `MemberSuspended`. Consumes Identity events.

### Workspace

A **Member's private operational civic environment**—not a dashboard, profile page, or owner of civic truth. Initialized via `WorkspaceInitialized`. Provides operational access to Activities, Discussions, Working Groups, Allies, Tasks, Initiatives (Blueprint presentation), Activity Inbox, Search, and AI Facilitation. Blueprint explicitly states: *Workspace sits above collaboration systems as a lens on civic responsibility, not as the owner of civic truth.*

### Activity

The **immutable civic trace anchor** (ADR-002). Records meaningful participation: who acted, what happened, in what context, with what visibility. Publishes `ActivityCreated`, `ActivityRevised`, `ActivityClosed`. Every significant civic interaction is intended to create an Activity. Activities are **not** notifications, messages, comments, or Proposals.

### Discussion

Universal **deliberation framework** with typed Contributions (Comment, Question, Evidence, Suggestion). Opens from Activity (`DiscussionOpened` consumes `ActivityCreated`). Preserves dissent; does not hold decision authority.

### Working Groups

Temporary **objective-bound collaboration** structures. Publishes `WorkingGroupCreated`, `WorkingGroupClosed`. Distinct from Institutions (temporary vs continuing responsibility).

### Allies (AllyRelationship)

Bounded **pairwise trusted collaboration** within Working Groups context. Governed acceptance/decline events.

### Proposal and Member Signal

Structured path from deliberation to formal review. MemberSignal captures civic concern; Proposal enters Decision Lifecycle. Publishes `MemberSignalRecorded`, `ProposalSubmitted`, `ProposalRevised`, `ProposalWithdrawn`.

### Decision (includes Voting semantics)

Human **governance authority** over Proposals. Publishes `DecisionApproved`, `DecisionRejected`, `DecisionReturnedForRevision`. **Voting** is a governed Decision process (Permission Model)—distinct from Proposal Support. AI cannot Vote, Approve, or Authorize.

### Implementation

Execution of approved Decisions. Publishes `ImplementationStarted`, `ImplementationSuspended`, `ImplementationCompleted`.

### Impact (ImpactAssessment)

Documents consequences of Implementation via `ImpactRecorded`. Owned within Implementation context—not a separate civic authority layer.

### Institution

Continuing civic structures when persistent responsibility exceeds Initiatives or Working Groups (ADR-004). Provisional → reviewed lifecycle.

### Institutional Memory

Preserves reasoning and dissent (`InstitutionalMemoryAppended`, `InstitutionalMemoryCorrected`). ADR-006.

### Notification

**Derived communication** from domain events. Publishes `NotificationDelivered`, `NotificationRead`. Never creates civic authority.

### Activity Inbox

**Personal attention-management read model** derived from Activities and civic events, filtered by Civic Responsibility Profile and Social Activity Plan. Not a notification center. Not an aggregate root in the Domain Model—it is a **projection** (Notification context / read-model layer per `04`, `07`).

### Search

Permission-aware **discovery projection** over authorized public civic content. Not source of truth.

### AI Facilitation

**Advisory-only** bounded context. Publishes `FacilitationOutputProduced` (non-authoritative). Cannot mutate Decision, Institution, or Proposal authority (ADR-005).

### Civic Responsibility Profile and Social Activity Plan

Private Member configuration governing **participation scope and attention routing**. Social Activity Plan drives Inbox and Notification relevance; changes may co-occur with `ResponsibilityProfileUpdated` (no separate v1.0 domain event).

## 1.3 Core Civic Flow (Engineering)

Documented in `02_DOMAIN_MODEL.md` and `11_APPLICATION_WORKFLOWS.md` §7:

```text
Member → Activity → Discussion → (Evidence / MemberSignal) → Proposal → Decision → Implementation → Institutional Memory
                                                      ↓
                                                   Impact (ImpactAssessment)
```

Not every Activity traverses every stage. Each transition requires owning-context rules and human authority where applicable.

## 1.4 Important Architectural Fact

**Activity is already the universal starting object** in the approved architecture (ADR-002, Blueprint 05, Engineering `00`, `01`, `02`). The existing stack was designed so downstream systems—Discussion, Inbox, Workspace, Notifications, AI—**derive from** Activities rather than replace them.

---

# 2. Proposed Activity-Centered Model

The new product vision organizes the platform around Activity as the **central coordination object** for Member experience and civic lifecycle navigation.

## 2.1 Core Concepts in the Proposed Model

| Concept | Proposed Role |
|---------|---------------|
| **Activity** | Central object all civic work orbits; starting point for traceability and coordination |
| **Discussion** | Universal communication and deliberation layer on Activities |
| **Conversation** | Focused collaborative dialogue (often ally or task-oriented) |
| **Allies** | Trusted pairwise collaboration enabling restricted deliberation |
| **Activity Inbox** | Member's unified attention surface for civic work requiring awareness or action |
| **AI Facilitator** | Stage-aware assistance across the civic lifecycle |

## 2.2 Proposed Lifecycle

```text
Activity
  ↓
Discussion
  ↓
Analysis
  ↓
Proposal
  ↓
Decision
  ↓
Implementation
  ↓
Impact
```

This lifecycle expresses **product navigation and civic maturity**—how work progresses from participation through governed outcomes and documented consequences.

## 2.3 Product Intent (Inferred)

The vision de-emphasizes navigating separate functional modules and instead presents **one coherent civic thread** anchored on Activity, with Workspace and Inbox as operational surfaces rather than competing centers of truth.

---

# 3. Comparison — Fit, Overlap, and Possible Duplication

## 3.1 Where the Models Naturally Fit Together

| Proposed Element | Existing Architecture Alignment |
|------------------|--------------------------------|
| **Activity as center** | **Strong fit.** ADR-002 and Blueprint 05 already mandate this. Engineering Domain Model places Activity as first civic object after Member registration. |
| **Discussion on Activity** | **Strong fit.** `DiscussionOpened` consumes `ActivityCreated`. Blueprint 06: Discussion renders and organizes Activities; Activity preserves truth. |
| **Allies** | **Strong fit.** Engineering Working Groups context owns AllyRelationship. Blueprint Allies integrate with Discussion visibility rules. |
| **Activity Inbox** | **Strong fit.** Blueprint 10 and Engineering `07` define Inbox as Activity-grounded attention management. |
| **Proposal → Decision → Implementation → Impact** | **Strong fit.** Engineering workflows §7–12 and Domain Model aggregates match this sequence. Impact maps to ImpactAssessment. |
| **AI Facilitator across stages** | **Partial fit.** AI already participates advisorially at Discussion, Proposal, Search, and Memory (`09`, `11` §19). Lifecycle-spanning UX is product presentation—not a new authority layer. |
| **Workspace as operational hub** | **Strong fit.** Blueprint 09 connects Activities, Discussions, Groups, Allies, Inbox, AI—explicitly **without owning** civic truth. |

## 3.2 Where Overlap Exists

| Area | Overlap Description |
|------|---------------------|
| **Activity vs everything else** | Both models treat Activity as anchor; proposed model makes this **visible in UX**, existing architecture makes it **authoritative in domain**. Overlap is intentional, not conflicting. |
| **Discussion vs Conversation** | Blueprint Discussion already includes *Working Conversation*, *Private Conversation*, and *Initiative Discussion* as **Discussion types**. Proposed "Conversation" overlaps existing Discussion taxonomy—not a new domain primitive. |
| **Analysis vs Evidence / MemberSignal** | Blueprint Contribution type *Analysis* and engineering Evidence workflow overlap the proposed "Analysis" stage. Engineering path: Evidence (`EvidenceContributed`) and MemberSignal precede Proposal—not a separate bounded context named "Analysis." |
| **Activity Inbox vs Workspace Overview** | Both surfaces show "what needs attention." Blueprint separates Inbox (attention queue) from Workspace Overview (operational summary). Overlap in content; different cognitive purpose. |
| **Initiatives vs Activity-centric navigation** | Blueprint Workspace module "My Initiatives" groups civic work; Engineering flow is Activity-first without an Initiative aggregate. **Terminology overlap** between product grouping and domain trace anchor. |
| **Notifications vs Inbox** | Both react to civic events. Engineering explicitly separates **delivery** (Notification) from **attention management** (Inbox). Proposed unified feed language could blur this if implemented carelessly. |

## 3.3 Possible Duplication (Identified, Not Resolved)

| Risk Area | Duplication Pattern |
|-----------|---------------------|
| **Initiatives as parallel root** | Treating Initiatives as a second civic anchor alongside Activity would duplicate trace ownership Blueprint assigns to Activity Engine. |
| **Conversation as separate subsystem** | A standalone Conversation module with its own persistence and lifecycle would duplicate Discussion bounded context. |
| **Analysis as separate module** | A distinct "Analysis" service owning civic reasoning would duplicate Discussion Contributions and Proposal preparation. |
| **Activity Inbox as new domain module** | Implementing Inbox as a write-owning aggregate rather than a read projection would duplicate Notification/Activity routing and violate projection boundaries in `04`. |
| **Unified notification feed** | Collapsing Inbox + Notification + Workspace Overview into one undifferentiated stream duplicates attention surfaces and violates Blueprint Inbox philosophy. |
| **AI as lifecycle orchestrator** | AI coordinating stage transitions autonomously would duplicate application workflow orchestration and violate ADR-005. |
| **Workspace owning civic state** | Workspace modules that mutate domain objects directly would duplicate bounded-context ownership. |
| **Initiative-specific workflows** | Parallel Proposal/Decision paths for Initiatives only would duplicate governance lifecycle. |
| **Voting as separate product module** | A voting feature outside Decision context would duplicate governed Decision processes in `06`. |
| **Impact as separate platform pillar** | Impact dashboards disconnected from Implementation aggregate would duplicate `ImpactRecorded` semantics. |

---

# 4. Component-by-Component Integration Review

For each component: **Remain unchanged**, **Part of Activity model (presentation/trace)**, **Specialization**, or **Supporting service**.

## 4.1 Identity

| Recommendation | **Remain unchanged** |
|----------------|----------------------|
| **Why** | Authentication and verification are access concerns, not civic coordination. Activity-centered UX must not collapse `MemberAuthenticated` into `MemberRegistered` or civic eligibility facts. Catalogue and `11` §4–15 preserve this distinction. |

## 4.2 Member

| Recommendation | **Remain unchanged** (foundational actor) |
|----------------|-------------------------------------------|
| **Why** | Activity-centered navigation still requires Member as civic actor. Profile, Civic Responsibility Profile, and Social Activity Plan **configure** how Activities surface in Inbox—they do not replace Activity. |

## 4.3 Workspace

| Recommendation | **Remain unchanged as personal environment; deepen Activity-centric presentation within it** |
|----------------|---------------------------------------------------------------------------------------------|
| **Why** | Blueprint 09 already defines Workspace as the Member's operational center—a **lens**, not an owner. Activity-centered product vision aligns with Blueprint principle: *Activity Engine → Collaboration Systems → Workspace.* |

### How Activity Lives Inside Workspace

| Surface | Relationship to Activity |
|---------|--------------------------|
| **Overview** | Summarizes Activities requiring attention—not a separate truth source |
| **My Initiatives** | Groups Activities, Discussions, and related artifacts by initiative scope (see §4.4) |
| **Discussions / Groups / Allies** | Navigate to Activity-anchored collaboration |
| **Activity Inbox panel** | Primary attention queue sourced from Activity projections |
| **AI Facilitator** | Invoked in context of an Activity or Discussion thread |

Workspace should **route Members to Activities**, not host parallel civic records.

## 4.4 Initiatives — Special Analysis Required

Initiatives appear prominently in Blueprint (Workspace §5, Discussion §10, Institution Formation, Proposal Framework) but **do not appear as an aggregate root** in Engineering Domain Model v1.0. Engineering civic flow is **Activity-first**; Blueprint Discussion §10 states *"Initiatives contain Discussions"* and *"Initiatives are the primary civic objects Discussions serve."*

This is the **primary terminology tension** between Blueprint product language and Engineering domain normalization.

### Option A — Initiatives Remain Independent (Product/Grouping Layer)

| Advantages | Disadvantages |
|------------|---------------|
| Matches Blueprint Workspace and Discussion narrative Members may already understand | Requires explicit mapping document: Initiative = governed **civic workstream identifier** referencing Activities, not a competing aggregate |
| Supports initiative-scoped navigation without new domain events | Risk of teams implementing Initiative as write-owning aggregate unless governed by ADR |
| Activity Engine remains authoritative trace; Initiative progress "reconstructable through Activity Engine" (Blueprint 09) | Blueprint §10 hierarchy (Initiative contains Discussion) inverts Engineering flow (Activity → Discussion) unless Initiative is modeled as **classification/metadata on Activity graph** |

### Option B — Initiatives as Specialized Activity (Classification / Civic Target)

| Advantages | Disadvantages |
|------------|---------------|
| Strong alignment with ADR-002 and Engineering `11` §7 | Departs from Blueprint language that treats Initiative as primary object Discussions serve |
| No new bounded context or duplicate lifecycle | Requires Blueprint interpretation ADR or product vocabulary ADR |
| Initiative views become **projections over Activity + Discussion + Proposal links** | "Draft initiative" and stewardship semantics need Activity type / metadata conventions |

### Option C — Initiatives as Specialized Proposal/Working Group Pattern

| Advantages | Disadvantages |
|------------|---------------|
| Uses existing governance path when initiative matures to formal change | Does not cover early exploratory initiative phase |
| Avoids third root object | Overloads Proposal or Working Group semantics |

### Review Conclusion (Initiatives)

**Do not assume the answer in implementation.** The safest near-term posture:

- **Preserve Activity as authoritative trace** (non-negotiable per ADR-002).
- Treat **Initiative as a product/workstream grouping** until an ADR resolves Blueprint §10 vs Engineering §7 hierarchy.
- **Do not create an Initiative bounded context** in v1.0 without ADR—would duplicate Activity ownership.

**Classification:** **Requires ADR / product mapping review** — not a blocker for Activity-centered UX if Initiatives are read-model groupings.

## 4.5 Discussion

| Recommendation | **Remain unchanged as bounded context; becomes the universal communication model in product presentation** |
|----------------|-------------------------------------------------------------------------------------------------------------|
| **Why** | Engineering and Blueprint already define Discussion as universal deliberation. Activity-centered vision elevates its **visibility**, not its ownership. `DiscussionOpened` ← `ActivityCreated` is the integration seam. |

**Can Discussion become the universal communication model?**  
**Yes—in product terms**, provided Conversation and Comments are **Discussion types and Contribution types**, not parallel systems.

## 4.6 Conversation

| Recommendation | **Specialization of Discussion—not an independent feature** |
|----------------|-------------------------------------------------------------|
| **Why** | Blueprint 06 defines *Working Conversation* and *Private Conversation* as Discussion types. Activity Inbox category *Conversations* is an **Inbox filter** over Activity-grounded dialogue—not a separate domain module. |

Implement Conversation as:

- Discussion subtype + visibility rules (Allies, Working Groups); and/or
- Inbox categorization over existing Activity/Discussion events.

**Do not** create Conversation aggregate, ConversationCreated events, or Conversation persistence separate from Discussion.

## 4.7 Analysis

| Recommendation | **Specialization within Discussion and Proposal preparation—not a separate lifecycle stage aggregate** |
|----------------|--------------------------------------------------------------------------------------------------------|
| **Why** | Blueprint Contribution type *Analysis* covers structured interpretation. Engineering workflow places Evidence (`EvidenceContributed`) and MemberSignal before Proposal. Proposed lifecycle "Analysis" is a **maturity phase** spanning Evidence-rich deliberation and signal consolidation—not a missing bounded context. |

Product may **label** a phase "Analysis" in UI while domain events remain `ContributionAdded`, `EvidenceContributed`, `MemberSignalRecorded`.

## 4.8 Proposal

| Recommendation | **Remain unchanged** |
|----------------|----------------------|
| **Why** | Formal governed change path. Activity-centered navigation should **link to** Proposals originated from Activity-linked Discussions—not embed Proposal logic in Activity aggregate. |

## 4.9 Decision and Voting

| Recommendation | **Remain unchanged; Voting stays within Decision context** |
|----------------|--------------------------------------------------------------|
| **Why** | Permission Model defines Vote as human governed authority distinct from Support. Activity-centered UX surfaces Decision state on Activity threads; it must not create a parallel voting subsystem. |

## 4.10 Implementation

| Recommendation | **Remain unchanged** |
|----------------|----------------------|
| **Why** | Execution ownership after `DecisionApproved`. Activity-centered view shows implementation progress as linked Activities and Implementation state—not as Activity subtype replacing Implementation aggregate. |

## 4.11 Impact

| Recommendation | **Remain unchanged (ImpactAssessment within Implementation context)** |
|----------------|---------------------------------------------------------------------|
| **Why** | `ImpactRecorded` already closes the civic loop. Product "Impact" stage maps to ImpactAssessment aggregate and Institutional Memory references—not a new module. |

## 4.12 Institution

| Recommendation | **Remain unchanged** |
|----------------|----------------------|
| **Why** | Institutions address **persistent responsibility** when Initiatives/Working Groups insufficient (ADR-004). Activity-centered navigation links to institution-related Activities; Institution aggregate remains separate. |

## 4.13 Working Groups

| Recommendation | **Remain unchanged** |
|----------------|----------------------|
| **Why** | Temporary objective-bound collaboration. Activity-centered Workspace surfaces group Activities; Working Group aggregate owns formation/closure. |

## 4.14 Allies

| Recommendation | **Remain unchanged; integrated via Working Groups context** |
|----------------|-------------------------------------------------------------|
| **Why** | AllyRelationship events and restricted Discussion visibility already model trusted collaboration. Activity-centered vision matches Blueprint Allies + Discussion integration. |

## 4.15 Notifications

| Recommendation | **Remain unchanged as supporting delivery service** |
|----------------|-----------------------------------------------------|
| **Why** | Notifications **alert**; they do not **organize civic work**. Engineering `07` §15.5 preserves parallel paths: Inbox projection + Notification delivery from same event stream. |

### Relation to Activity Inbox

| Mechanism | Purpose |
|-----------|---------|
| **Activity Inbox** | What civic work deserves my attention now? (Activity-grounded queue) |
| **Notification** | How should I be alerted across channels? (Derived delivery) |

**Integration rule:** Notifications may **point to** Inbox items; they must not **replace** Inbox as the responsibility-oriented queue.

## 4.16 Activity Inbox

| Recommendation | **Not a new module—a unified activity feed projection (already specified)** |
|----------------|---------------------------------------------------------------------------|
| **Why** | Blueprint 10 and Engineering `04`, `07` define Activity Inbox as **read model** built on Activity Engine + Civic Responsibility Profile + Social Activity Plan. Activity-centered product vision **is** the Inbox philosophy made primary in UX—not a second inbox system. |

Implement as:

- Event-driven projection (Search/Notification-adjacent read model)
- Categories (Work, Conversations, Comments, System) as **filters**, not domain boundaries
- No duplicate write path bypassing Activity aggregate

## 4.17 Search

| Recommendation | **Remain unchanged as supporting discovery projection** |
|----------------|---------------------------------------------------------|
| **Why** | Search indexes authorized civic content from integration events. Activity-centered UX uses Search for discovery; Activity remains trace anchor. Initiative lifecycle grouping in `08` is already a **presentation grouping** over related Activities. |

## 4.18 AI Facilitator

| Recommendation | **Remain bounded context; expand stage-aware invocation in application layer—not autonomous lifecycle control** |
|----------------|-------------------------------------------------------------------------------------------------------------------|
| **Why** | ADR-005 prohibits AI authority. AI already supports deliberation summarization, evidence organization, related-work discovery, and advisory recommendations (`09`, Blueprint 11). |

**Can AI support every lifecycle stage?**  
**Yes as advisory assistance** at Activity, Discussion, Proposal, Decision preparation, Implementation tracking, and Memory review—via `RequestFacilitation` → `FacilitationOutputProduced`.

**No** as:

- Stage transition authority
- Proposal submission or Decision approval substitute
- Notification policy override
- Inbox priority authority replacing Civic Responsibility Profile rules

AI remains a **supporting service** invoked in context of owning aggregates.

## 4.19 Civic Responsibility Profile and Social Activity Plan

| Recommendation | **Remain unchanged; become more prominent in Activity-centered routing** |
|----------------|--------------------------------------------------------------------------|
| **Why** | These configure **which Activities surface** in Inbox and Notifications. Activity-centered model increases their importance—it does not replace them. |

---

# 5. Platform-Wide Duplication Inventory

If the Activity-centered model were added **incorrectly**, the following duplications could emerge:

| # | Duplication Risk | Incorrect Pattern | Existing Correct Pattern |
|---|------------------|-------------------|--------------------------|
| 1 | **Duplicate civic truth** | Initiative or Conversation aggregate owning participation history | Activity aggregate (ADR-002) |
| 2 | **Duplicate communication** | Standalone Conversation/messaging module | Discussion + Contribution types |
| 3 | **Duplicate deliberation analysis** | Analysis bounded context | Discussion Contributions + MemberSignal |
| 4 | **Duplicate inbox** | New "Activity Feed" write model | Activity Inbox projection (Blueprint 10) |
| 5 | **Duplicate notifications** | Inbox items that are also Notification records with separate semantics | Notification delivery vs Inbox attention (`07` §15.5) |
| 6 | **Duplicate initiatives** | Initiative aggregate parallel to Activity | Activity classification + Workspace grouping |
| 7 | **Duplicate workflows** | Activity-lifecycle state machine owning Proposal/Decision rules | Application workflows orchestrating separate aggregates (`11`) |
| 8 | **Duplicate collaboration** | Activity-scoped chat bypassing Discussion | DiscussionOpened from ActivityCreated |
| 9 | **Duplicate voting** | Activity-level polls with governance effect | Decision aggregate + Vote permission |
| 10 | **Duplicate AI authority** | AI advancing lifecycle stages | FacilitationOutput advisory only |
| 11 | **Duplicate Workspace truth** | Workspace module mutating Proposal/Decision state | Commands to owning bounded contexts |
| 12 | **Duplicate impact tracking** | Impact dashboard with independent write path | ImpactAssessment + `ImpactRecorded` |
| 13 | **Duplicate institutional path** | Activity subtype "Institution" | Institution aggregate (ADR-004) |
| 14 | **Duplicate event vocabulary** | New lifecycle events (e.g., `AnalysisCompleted`) | Canonical Event Catalogue (50 events, ADR-governed extension) |
| 15 | **Duplicate ally model** | Activity-scoped friend lists | AllyRelationship in Working Groups context |
| 16 | **Duplicate search index** | Inbox maintaining separate searchable corpus | Search projection from integration events |
| 17 | **Duplicate member configuration** | Activity preferences replacing Civic Responsibility Profile | Member aggregate private configuration |

---

# 6. Recommended Safest Integration Strategy

## 6.1 Guiding Principles

1. **Activity remains the authoritative trace anchor** — ADR-002 is non-negotiable.
2. **No new bounded contexts without ADR** — especially Initiatives and Conversation.
3. **Product lifecycle is navigation; domain lifecycle is aggregate ownership** — UI may show Analysis; domain emits `EvidenceContributed`.
4. **Workspace and Inbox are lenses** — never write owners of civic state.
5. **Canonical Event Catalogue governs all new domain facts** — no parallel event vocabulary.
6. **Application workflows orchestrate; aggregates decide** — `11` pattern preserved.
7. **Preserve Notification vs Inbox separation** — unified UX may combine views; not domain models.

## 6.2 Phased Integration Approach

### Phase 0 — Alignment (Pre-Implementation, No Redesign)

| Action | Outcome |
|--------|---------|
| Adopt this review and Catalogue as implementation guardrails | Prevents parallel systems |
| Resolve Initiative mapping via **product ADR** (grouping vs aggregate) | Closes Blueprint §10 vs Engineering §7 gap |
| Define UX lifecycle labels mapped to existing events | Analysis → Contribution/Evidence/MemberSignal events |

### Phase 1 — Activity-Centered Surfaces (Presentation)

| Action | Outcome |
|--------|---------|
| Workspace routes all modules through Activity detail views | Single coordination entry point |
| Activity Inbox as primary Member landing (Blueprint-aligned) | Attention-first UX |
| Discussion types expose Conversation UX without new domain | Specialized presentation |
| AI Facilitator contextual panels per lifecycle stage | Advisory only |

### Phase 2 — Projections and Grouping (Read Models)

| Action | Outcome |
|--------|---------|
| Initiative views as Activity graph groupings + Search facets | No Initiative aggregate required for MVP |
| Lifecycle progress indicators from aggregate states + events | No new lifecycle aggregate |
| Unified Activity thread UI linking Proposal, Decision, Implementation | Traceability preserved |

### Phase 3 — Governed Extensions (ADR Required)

| Action | Trigger |
|--------|---------|
| Initiative aggregate (if ever) | Only if ADR proves Activity classification insufficient |
| Social Activity Plan domain event | Release Readiness OQ-3 — future ADR |
| Moderation domain events | Catalogue v1.0 exclusion — future ADR |

## 6.3 What Must Not Change

- 17 bounded contexts and 18 aggregate roots (Engineering `02`)
- 50 canonical domain events and ownership map
- AI non-authority (ADR-005)
- Decision/Vote human authority (ADR-003, `06`)
- Institutional Memory immutability (ADR-006)
- Member/Identity event distinctions
- Event-driven cross-context coordination

---

# 7. Final Conclusion

## The Activity-centered model **can be integrated** into the existing Humanity Union architecture.

**A larger architectural redesign is not required.**

### Reasoning

1. **The proposed vision largely restates approved architecture.** ADR-002 already declares Activity the universal starting object. Blueprint 05 requires every collaboration feature to rely on the Activity Engine. Engineering Release Readiness and Documentation Alignment confirm this stack is coherent and implementation-ready.

2. **The proposed lifecycle matches Engineering workflows** with one vocabulary difference: "Analysis" is a **product phase label**, not a missing bounded context. Evidence, Contributions, and MemberSignal cover this space domain-wise.

3. **Activity Inbox, Workspace, Discussion, Allies, and AI Facilitator are already designed as Activity-derived or Activity-contextual systems.** The product vision primarily requires **re-centering UX and navigation**, not inventing new domain modules.

4. **The main integration work is terminological and presentational**, centered on Initiatives and Conversation—not structural. Initiatives need an ADR-level mapping decision (grouping layer vs future aggregate), not a platform rewrite.

5. **Duplication risks are identifiable and avoidable** by adhering to existing bounded contexts, projections, and Catalogue governance.

### When Would Redesign Be Required?

Redesign would become necessary **only if** product requirements demand:

- A second civic truth anchor independent of Activity;
- Conversation or Initiative as write-owning aggregates with parallel event vocabularies;
- AI with decision or lifecycle transition authority;
- Collapsed Notification/Inbox/Workspace into one authoritative domain model.

None of these are implied by a well-scoped Activity-centered **integration**—they would represent **architectural violation**, not the stated product vision.

---

# Executive Summary

Humanity Union's approved architecture **already centers on Activity** as the immutable civic trace anchor (ADR-002, Blueprint 05, Engineering Domain Model). The new Activity-centered product vision aligns with this foundation: it emphasizes **navigation, attention management, and lifecycle visibility** rather than a new domain structure.

Integration is **feasible without redesign** if:

- Activity remains authoritative;
- Discussion absorbs Conversation as type/presentation;
- Analysis is treated as deliberation phase, not new aggregate;
- Activity Inbox stays a projection, not a module;
- Notifications stay delivery, not organization;
- Initiatives are mapped via ADR as grouping over Activity graphs (pending decision);
- AI stays advisory across lifecycle stages.

Primary risk is **accidental duplication**—especially Initiatives, Conversation, and unified feeds—if implementation treats product concepts as new bounded contexts.

---

# Architecture Compatibility Score

## **86 / 100**

| Dimension | Score | Notes |
|-----------|-------|-------|
| Activity centrality | 95 | Already normative; vision strengthens UX emphasis |
| Lifecycle alignment | 88 | Analysis label vs domain events is minor gap |
| Discussion / Conversation | 82 | Blueprint types exist; product must not fork |
| Inbox / Notification | 90 | Well-separated in architecture; UX merge risk only |
| Initiatives | 70 | Blueprint vs Engineering hierarchy needs ADR |
| AI integration | 92 | Lifecycle advisory fits; authority boundaries clear |
| Governance path | 93 | Proposal → Decision → Implementation intact |
| Event / domain integrity | 95 | Catalogue-governed; no new events required for integration |

---

# Potential Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Initiative implemented as competing aggregate | **High** | ADR before Initiative write model; Activity remains trace |
| Conversation module bypassing Discussion | **High** | Enforce Discussion types; no separate persistence |
| Inbox implemented as notification feed | **Medium** | Follow Blueprint 10 + `07` §15.5 separation |
| UX lifecycle driving new domain events | **Medium** | Map UI stages to Catalogue events only |
| Workspace mutating domain state | **Medium** | Commands to owning contexts only |
| AI orchestrating stage transitions | **Medium** | ADR-005 enforcement in application layer |
| Blueprint §10 "Initiative contains Discussion" confusing teams | **Medium** | Product ADR clarifying grouping vs ownership |
| Analysis stage implying new bounded context | **Low** | Document Contribution/Evidence mapping |
| Over-unifying surfaces (Inbox + Overview + Notifications) | **Low** | Combined view OK; separate projections required |

---

# Components Requiring Review

| Component | Review Needed | Reason |
|-----------|---------------|--------|
| **Initiatives** | **Yes — ADR required** | Blueprint product object vs Engineering Activity-first flow |
| **Conversation** | **Yes — product mapping** | Confirm Discussion subtype + Inbox category only |
| **Analysis (lifecycle label)** | **Yes — UX mapping doc** | Map to Contribution types and MemberSignal path |
| **Social Activity Plan event** | **Optional future ADR** | Release Readiness OQ-3 |
| **Initiative Search grouping** | **Light review** | Ensure projection-only (`08` pattern) |

---

# Components Safe To Preserve

| Component | Status |
|-----------|--------|
| Identity / Member / Workspace aggregates | ✓ Preserve |
| Activity aggregate and ADR-002 | ✓ Preserve |
| Discussion bounded context | ✓ Preserve |
| Working Groups / Allies | ✓ Preserve |
| Proposal / MemberSignal | ✓ Preserve |
| Decision / Vote semantics | ✓ Preserve |
| Implementation / ImpactAssessment | ✓ Preserve |
| Institution / Institutional Memory | ✓ Preserve |
| Notification bounded context | ✓ Preserve |
| Activity Inbox as projection | ✓ Preserve (elevate in UX) |
| Search / Analytics projections | ✓ Preserve |
| AI Facilitation (advisory) | ✓ Preserve |
| Civic Responsibility Profile / Social Activity Plan | ✓ Preserve |
| Canonical Event Catalogue (50 events) | ✓ Preserve |
| Application Workflows (`11`) | ✓ Preserve |
| Permission Model (`06`) | ✓ Preserve |

---

# Recommended Integration Strategy

**Integrate by elevation, not duplication.**

1. Make **Activity detail + Activity Inbox** the primary Member entry surfaces in Workspace.
2. Render **lifecycle progress** as read-model navigation over existing aggregates and Catalogue events.
3. Implement **Conversation** as Discussion type and Inbox filter.
4. Treat **Analysis** as deliberation phase UI tied to Evidence and MemberSignal workflows.
5. Hold **Initiative** implementation until a short ADR defines it as Activity graph grouping (recommended) or justifies a future aggregate.
6. Invoke **AI Facilitator** contextually at each stage without granting transition authority.
7. Keep **Notification delivery** separate from Inbox attention management.
8. Anchor all implementation to **Catalogue + `11` workflows**—no new domain events for integration.

---

# Recommendation

## **GO** — Proceed with Activity-centered product integration

**Condition:** Complete Initiative mapping ADR and Conversation/Analysis product mapping **before** writing Initiative or Conversation domain code.

## **REVIEW AGAIN** — Only if:

- Product requires Initiative or Conversation as **write-owning aggregates** with new domain events; or
- Product requires AI to **advance lifecycle stages** or **approve** civic outcomes; or
- Product requires **replacing** Activity Inbox projection with a new authoritative inbox module.

These conditions would indicate **architectural scope change**, not integration—and would trigger full ADR review, not this integration path.

---

**Document:** Activity Architecture Integration Review  
**Version:** 1.0  
**Status:** Pre-Implementation Integration Analysis  
**Date:** 2026-07-21  
**Does not modify:** Blueprint, Validation, ADR, Engineering `00`–`11`, Canonical Event Catalogue  
**Next recommended artefact:** ADR — Initiative Product Mapping (Activity graph grouping vs aggregate)
