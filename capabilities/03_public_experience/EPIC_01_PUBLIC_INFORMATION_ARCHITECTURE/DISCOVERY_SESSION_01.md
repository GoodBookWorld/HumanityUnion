# DISCOVERY SESSION 01

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 01 — Public Information Architecture

Version: 1.0

Status: Draft

Document Type: Discovery

---

# Purpose

Define the vision and scope of Humanity Union **Public Experience**.

This document establishes the **Public Information Architecture** — the structural foundation that all future Public Experience epics must follow.

This is a discovery document.

It does not define implementation.

It does not authorize features.

It records architectural intent for how society, visitors and future participants encounter Humanity Union in public — before any page, component or route is built.

Reference:

- `capabilities/02_participation/CAPABILITY_02_RETROSPECTIVE.md`

Capability 02 proved that operational workspaces and public projections must remain distinct, that public transparency must not expose individual dignity, and that future scope must be named without being partially implemented.

Capability 03 applies those lessons at the platform level — unifying how public civic information is discovered, understood and trusted across the entire Humanity Union surface.

---

# Vision

Humanity Union is **one unified public civic space**.

Society should not encounter fragmented websites, duplicate architectures or disconnected product areas when moving from global context to local action.

The public platform presents a single coherent civic environment:

- one information architecture;
- one navigation philosophy;
- one layout system;
- one widget vocabulary;
- one trust model.

**World**, **Country** and **Region** are not separate products.

They are **different filtered views of the same platform**.

A visitor at World scope sees global civic activity through the same structural patterns as a visitor at Country or Region scope — with dataset scope changing, not page architecture changing.

```
                    Humanity Union Public Platform
                              │
              ┌───────────────┼───────────────┐
              │               │               │
           World           Country          Region
              │               │               │
              └───────────────┴───────────────┘
                              │
                    Same layout · Same widgets
                    Same navigation · Same principles
                              │
                    Different filtered datasets
```

Public Experience exists so that:

- a first-time visitor can orient calmly;
- a returning observer can discover what matters;
- a future participant can understand before registering;
- civic legitimacy grows through explainable public information — not through engagement mechanics.

Humanity Union creates grounds for trust in public.

Participation aggregates remain authoritative for civic action.

Public Experience governs how that authority is **presented** to society at scale.

---

# Objectives

Epic 01 — Public Information Architecture must achieve the following objectives.

## Create a simple, calm and scalable public experience

Public surfaces must reduce cognitive load.

Navigation, hierarchy and copy must favor clarity over completeness.

Calm presentation is a civic requirement — not a visual preference.

## Support future expansion without redesign

New destinations, widgets and dataset filters must attach to one architecture.

Future Public Experience epics must extend — not fork — the information model defined here.

## Establish one public foundation for all capabilities

Participation public projections, institutional information, media, knowledge and platform explanation must share structural conventions.

Capability-specific content may differ.

Capability-specific page architectures must not multiply.

## Preserve trust through structure

Public information must be explainable, verifiable and honest.

Derived civic state from Participation must remain labeled and traceable when surfaced publicly.

Individual dignity must not be sacrificed for transparency.

## Separate discovery from participation

Public Experience orients and informs.

Registration and operational participation remain distinct entry paths with explicit transitions.

Visitors discover before they commit.

---

# Navigation Philosophy

Public navigation must answer one question at a time:

**"Where am I, and what can I explore from here?"**

## Header contains primary public destinations

The header carries the **primary civic destinations** a visitor uses to explore Humanity Union.

Header items represent major public domains — not every future feature.

Primary destinations must remain limited, stable and memorable.

## Footer contains supporting destinations

The footer carries **supporting destinations** — legal, platform, accessibility, contact, secondary resources and future expansion slots.

Footer navigation must not compete with header hierarchy.

## Navigation should minimize cognitive load

Rules:

- prefer depth through content hierarchy over breadth through menu proliferation;
- one primary navigation model across World, Country and Region;
- scope changes (World → Country → Region) must not require relearning navigation;
- labels must use civic language — not internal product names;
- every destination must have one clear responsibility;
- duplicate paths to the same meaning are forbidden.

Navigation explains structure.

It does not perform civic authority.

---

# Information Hierarchy

Public Experience follows a visitor journey from first contact to participation readiness.

This hierarchy is **experiential**, not an aggregate lifecycle.

It describes how public information should be sequenced — not how domain commands mutate state.

```
Visitor

↓

Discover

↓

Understand

↓

Trust

↓

Register

↓

Participate
```

## Visitor

A person arrives without operational context.

They need orientation — what Humanity Union is and why it exists in public.

## Discover

They explore initiatives, institutions, media and knowledge through calm browse patterns.

Discovery is open — no registration required.

## Understand

They comprehend civic meaning — what is proposed, decided, supported or underway — through explainable public projections.

Understanding precedes commitment.

## Trust

They evaluate legitimacy through verifiable public information — derived indicators labeled honestly, evidence presented as substantiation not certification.

Trust is structural — not rhetorical.

## Register

They choose to become a registered participant when ready.

Registration is explicit — never implied by browsing.

## Participate

They enter operational Participation workspaces through governed entry paths.

Public Experience ends at the boundary of accountable participation.

Capability 02 established operational/public separation.

Capability 03 defines the **public side of that boundary** at platform scale.

---

# Public Levels

Public Experience operates at three geographic scopes.

| Level       | Scope            | Visitor Question                           |
| ----------- | ---------------- | ------------------------------------------ |
| **World**   | Global           | "What is happening across Humanity Union?" |
| **Country** | National         | "What matters in this country?"            |
| **Region**  | Local / regional | "What matters near me?"                    |

## One layout · One architecture · Filtered datasets

World, Country and Region share:

- the same header and footer structure;
- the same page templates and widget vocabulary;
- the same information hierarchy;
- the same trust and copy principles.

They differ only in:

- **dataset scope** — which initiatives, institutions, media and knowledge entries appear;
- **contextual labels** — geographic framing in titles and filters;
- **default scope** — sensible entry context for the visitor.

They must **not** differ in:

- navigation architecture;
- component systems;
- routing philosophy;
- public projection rules;
- widget contracts.

Implementing three separate public site architectures — one per level — is explicitly out of scope.

Scope is a **filter parameter**, not a **product fork**.

---

# Header Concept

The header defines primary public destinations.

Version 1 discovery proposes seven header destinations.

Each destination owns one civic responsibility.

## Home

**Responsibility:** Platform orientation and entry.

Home answers:

- What is Humanity Union?
- What can I explore here?
- How do World, Country and Region relate?

Home is not a dashboard of everything.

It is calm orientation and curated entry into discovery.

## Initiatives

**Responsibility:** Public discovery of civic proposals and participation paths.

Initiatives surfaces public projections from the Participation pipeline — proposals, analysis context, decisions, petitions, commitments and implementation progress where policy permits.

Initiatives connect society to civic activity without exposing operational workspace internals.

## Institutions

**Responsibility:** Public presence of governing and civic institutions on the platform.

Institutions provides structured public information about organizations, bodies and institutional roles relevant to civic life.

Institutions are informational — not operational administration surfaces.

## Media

**Responsibility:** Public civic media and documented public communication.

Media surfaces announcements, recordings, publications and platform-sanctioned public communication that help society follow civic activity.

Media supports understanding — it does not replace Participation aggregates as source of civic truth.

## Knowledge

**Responsibility:** Educational and reference material for civic comprehension.

Knowledge provides guides, glossary, process explanation and durable reference content that helps visitors understand how Humanity Union works.

Knowledge explains the platform — it does not substitute for live aggregate public projections.

## About

**Responsibility:** Platform identity, mission, governance explanation and trust foundations.

About answers why Humanity Union exists, how it governs itself publicly and how society should interpret what the platform does and does not claim.

About establishes explainable honesty at the platform level.

---

# Footer Concept

The footer carries **secondary navigation** and **supporting platform information**.

Footer destinations must not duplicate header responsibilities under different labels.

## Footer responsibilities

- legal and policy links;
- accessibility and inclusion statements;
- contact and support entry;
- language and locale preferences where applicable;
- developer or open-data references if approved in future epics;
- social or external reference links under governed policy;
- reserved slots for future secondary destinations without header proliferation.

## Future expansion

New public capabilities should prefer **footer introduction first** when they are supporting — not primary — civic destinations.

Header changes require stronger justification and Architecture Review.

Footer expansion must still conform to one layout architecture.

No footer section may introduce a parallel navigation system or alternate page template family.

---

# Widget Philosophy

Public Experience is built from **reusable widgets** on **shared layouts** with **filtered datasets**.

## Reusable widgets

Widgets are composable public information units — not page-specific one-offs.

Examples of widget categories (conceptual — not implementation):

- scope selector (World / Country / Region);
- initiative summary card;
- participation stage indicator;
- derived metric display with honest labeling;
- institutional profile summary;
- media item preview;
- knowledge article excerpt;
- trust and verification footnote;
- registration gateway call-to-action.

Widgets must:

- accept dataset scope as input;
- render consistently across levels;
- respect public projection sanitization rules;
- label derived values as derived;
- remain readable without operational context.

## Shared layouts

Page types — home, listing, detail, collection — use shared layout templates.

Layout defines hierarchy slots.

Widgets fill slots.

Pages must not invent bespoke layout architectures per destination.

## Filtered datasets

The same widget on World and Region pages differs only in filtered content — not in structure.

Filtering logic belongs to data and projection layers — not to duplicated UI forks.

## No duplicated UI architecture

Forbidden patterns:

- separate component libraries per geographic level;
- separate header/footer implementations per capability;
- separate routing models for the same page type;
- copy-paste page templates with divergent hierarchy.

Capability 02 learned that early projection discipline prevents expensive retrofitting.

Capability 03 applies that lesson to the entire public shell.

---

# Public Experience Principles

The following principles govern all Public Experience work — including future epics beyond Epic 01.

## Consistency

One navigation model, one layout system, one widget vocabulary across World, Country and Region.

Visitors must not relearn the platform when scope changes.

## Simplicity

Prefer fewer destinations, fewer widgets and fewer decisions per page.

Calm civic presentation is a feature.

Completeness must not overwhelm first understanding.

## Explainable Navigation

Every header and footer destination must have one clear responsibility.

Labels must describe civic meaning — not internal module names.

Visitors should predict what they will find before they click.

## Trust Through Verification

Public information must be traceable to authoritative sources where applicable.

Participation-derived indicators must remain explainable from underlying public projections.

The platform creates grounds for trust — it does not claim omniscient verification.

## Future Extension Without Present Complexity

Reserved destinations, widgets and footer slots may be named in architecture.

They must not be partially implemented before need and review.

Naming future scope prevents silent drift — it does not authorize premature build.

---

# Risks

Epic 01 must explicitly guard against the following failure modes.

## Navigation overload

Too many header items destroy calm orientation.

Every new destination request will pressure the header.

Architecture must defend primary destination limits.

## Too many menu items

Header and footer proliferation creates cognitive fragmentation.

Prefer content depth and widget reuse over menu expansion.

## Duplicate pages

The same civic meaning must not appear under multiple destinations with inconsistent presentation.

One responsibility — one primary destination.

## Multiple architectures

The highest-risk failure is implementing World, Country or Region as separate public products.

Separate architectures guarantee redesign cost and trust inconsistency.

Capability 02 retrospective warns against overbuilding early and losing operational/public separation.

Capability 03 adds: **do not lose unified public architecture across geographic scope**.

---

# Conclusion

Epic 01 — Public Information Architecture establishes the **architectural foundation of all Public Experience work** on Humanity Union.

It defines:

- one unified public civic space;
- World, Country and Region as filtered views — not separate platforms;
- header and footer navigation philosophy;
- visitor-to-participant information hierarchy;
- widget and layout reuse discipline;
- public experience principles aligned with Capability 02 learnings.

Future Public Experience epics — page templates, scope filtering, institutional surfaces, media libraries, knowledge bases and registration entry — must conform to this discovery before implementation begins.

Implementation follows discovery.

Architecture follows need.

Humanity Union public experience must remain calm, explainable and scalable — so society can discover civic life on the platform without confusion, overload or trust erosion.

This document does not define implementation.

It authorizes the next discovery and architecture artifacts for Capability 03 — not code.

---

# References

| Document                                                               | Relevance                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `capabilities/02_participation/CAPABILITY_02_RETROSPECTIVE.md`         | Operational/public separation, public projection pattern, trust principles, deferral discipline |
| `project/architecture/experience/EXPERIENCE_ARCHITECTURE.md`           | Platform-wide experience layer relationship to architecture and interface                       |
| `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md` | Participation public projection boundaries and pipeline context                                 |

---

# Document Status

**Draft**

Discovery Session 01 — Public Information Architecture

Changes require Capability 03 governance review before downstream epics treat this document as frozen baseline.
