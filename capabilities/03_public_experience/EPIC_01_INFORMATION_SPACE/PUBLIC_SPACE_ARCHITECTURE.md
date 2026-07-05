# PUBLIC SPACE ARCHITECTURE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 01 — Information Space

Version: 1.0

Status: Draft

Document Type: Consolidated Architecture

---

# 1. Purpose

**Public Space** is Humanity Union's public civic environment.

It is where society — registered or not — encounters civic life on the platform before choosing accountable participation.

Public Space exists to help people **observe society before choosing to participate**.

Visitors may:

- discover what is proposed, decided, supported and underway;
- understand how the Participation pipeline organizes civic action;
- evaluate legitimacy through explainable public information;
- register and enter operational workspaces only when ready.

Public Space is **independent from Workspace** while remaining **fully connected** to it.

| Environment      | Role                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| **Public Space** | Observation, understanding, evaluation — read-only civic visibility          |
| **Workspace**    | Accountable participation — operational recording and action (Capability 02) |

Public Space presents **public projections** of Participation aggregates.

It does not serialize operational aggregates.

Workspace supports participation.

Public Space supports informed choice about participation.

Neither replaces the other.

This document consolidates Epic 01 architectural decisions into **one authoritative reference**.

Detailed specifications remain in source documents listed at the end.

This architecture synthesizes them — it does not replace them as working artifacts.

It does not define implementation.

---

# 2. Architectural Vision

Public Space is **the window into a living society**.

Society should see civic activity as it is recorded and projected publicly — structured, ongoing and geographically distributed — not as marketing narrative or engagement spectacle.

The purpose of Public Space is **not promotion**.

Its purpose is:

- **observation** — civic life visible at World, Country and Region scope;
- **understanding** — pipeline meaning, institutional context and platform process comprehensible;
- **informed participation** — registration and workspace entry as deliberate choice after comprehension.

Humanity Union **never asks people to trust**.

It creates conditions under which trust can **naturally emerge**:

- public information traceable to authorized projections;
- derived civic state labeled honestly;
- evidence presented as substantiation — not certification;
- platform boundaries visible about what is and is not claimed;
- calm presentation without urgency or manipulation.

Trust is structural — through transparency and verification — not rhetorical.

Public Space is one unified civic surface.

World, Country and Region are filtered views — not separate products.

The Global Experience (Epic 02) is the World-scoped expression of this vision — the public square, not a conventional homepage.

---

# 3. Public Space Model

Humanity Union public civic life operates across **three complementary environments** in sequence.

```
Public Space

↓

Registration

↓

Workspace
```

## Public Space

**Supports observation.**

Visitors browse without account requirement.

Public projections, experience blocks, navigation and geographic filtering compose the observable civic environment.

Public Space answers: **"What can society see?"**

## Registration

**Supports explicit transition** from observer to registered participant.

Registration Gateway is secondary navigation — not primary pressure.

Understanding precedes registration.

Registration is Capability 01 identity entry — architecturally distinct from Public Space content ownership.

## Workspace

**Supports participation.**

Operational Participation workspaces (Capability 02) support accountable civic action — proposals, analysis, decisions, petitions, commitments, implementation.

Workspace answers: **"How do participants act?"**

Public Space connects to Workspace through governed entry paths — initiative detail, Registration Gateway, share links — never through operational serialization on public pages.

```
Observer ──► Public Space ──► (optional) Register ──► Workspace
                │                                         │
                └──── public projections ◄────────────────┘
                      (read-only visibility)
```

Public Space supports observation.

Workspace supports participation.

Neither replaces the other.

---

# 4. Public Space Layers

Public Space organizes civic visibility through a **geographic hierarchy**.

```
World

↓

Country

↓

Region

↓

Future Geographic Levels
```

Each level is a **scope filter** on one architecture — not a separate platform.

## Current levels

| Level       | Scope            | Visitor Question                         |
| ----------- | ---------------- | ---------------------------------------- |
| **World**   | Global           | What is happening across Humanity Union? |
| **Country** | National         | What matters in this country?            |
| **Region**  | Local / regional | What matters near me?                    |

## Future geographic levels

Architecture must **never depend on a fixed number of geographic levels**.

Future levels may include — subject to Architecture Review:

- District
- Municipality
- City
- Village
- Neighbourhood
- Indigenous Territory
- Other local administrative or community structures

Future levels attach as **additional scope parameters** — same navigation, same page types, same experience blocks, filtered datasets.

## Architectural rule

**Every level reuses one architecture while filtering different datasets.**

Forbidden:

- separate navigation trees per geography;
- country-specific page template families;
- region-only public product forks;
- fixed-depth geographic hierarchy encoded into routing structure.

Geographic depth is **data and filter model** — not **UI architecture multiplication**.

Interactive Map and Geographic Navigation assist scope selection — they do not create alternate public platforms.

---

# 5. Public Experience Flow

Public Space sequences visitor experience through five stages.

This is **experiential architecture** — not aggregate lifecycle or domain commands.

```
Identity

↓

Orientation

↓

Understanding

↓

Evaluation

↓

Participation
```

## Identity

**Responsibility:** Establish what Humanity Union is as a public civic institution.

The visitor learns the platform exists, serves structured civic participation and operates in public view.

Delivered through Hero framing, design tone and calm platform language — not brand hype.

## Orientation

**Responsibility:** Help the visitor know where they are and what they may explore.

Scope context, header navigation, geographic filter and first-scan block hierarchy make the public environment legible.

Orientation is legibility — not completeness.

## Understanding

**Responsibility:** Deepen comprehension of live civic activity and platform structure.

Statistics, initiative previews, pipeline stage distribution, institutional and media context, Knowledge cross-links.

Derived indicators labeled.

Evidence language honest.

## Evaluation

**Responsibility:** Enable the visitor to assess legitimacy before commitment.

Trust footnotes, About path, traceable public projections, bounded platform claims, Verification Seeker journey support.

Evaluation is **inspect and judge** — not **believe because asked**.

Humanity Union creates grounds for trust — it does not demand it.

## Participation

**Responsibility:** Offer explicit paths to registration and operational civic action.

Registration Gateway and initiative-to-workspace entry appear after sufficient public comprehension.

Participation is informed choice — not default browse outcome.

Public Space architectural ownership ends at the Participation threshold.

Workspace begins beyond it.

---

# 6. Navigation Architecture

Navigation serves **user intentions** — explore, research, learn, verify, participate — rather than exposing implementation structure, aggregate names or capability modules.

## Primary destinations

Header carries six stable destinations.

| Destination      | Intention Served     | Responsibility                                          |
| ---------------- | -------------------- | ------------------------------------------------------- |
| **Home**         | Orient               | Platform entry, scope context, curated civic highlights |
| **Initiatives**  | Discover activity    | Public Participation projections — browse and detail    |
| **Institutions** | Discover actors      | Institutional public profiles and roles                 |
| **Media**        | Follow communication | Public announcements, recordings, publications          |
| **Knowledge**    | Learn platform       | Guides, glossary, process explanation                   |
| **About**        | Evaluate trust       | Mission, governance, platform honesty boundaries        |

One responsibility per destination.

Duplicate paths to the same meaning forbidden.

Primary navigation identical at World, Country and Region.

## Secondary navigation

| Mechanism                 | Role                                                           |
| ------------------------- | -------------------------------------------------------------- |
| **Footer**                | Legal, accessibility, contact, reserved secondary destinations |
| **Breadcrumbs**           | Positional hierarchy within a destination                      |
| **Related Content**       | Cross-destination civic context links                          |
| **Registration Gateway**  | Explicit register entry — never primary header competition     |
| **Geographic Navigation** | World / Country / Region scope filter — not site switcher      |

## Navigation rules

- maximum three logical transitions between public destinations under normal browse;
- consistent placement across pages and scopes;
- predictable behavior when scope changes;
- explainable labels — civic language only;
- progressive disclosure — destinations before depth, depth before registration.

Navigation architecture is independent from UI implementation.

Routing and components conform to it — they do not redefine it.

---

# 7. Information Architecture

Public Space information is composed — not handcrafted page by page.

## Reusable Experience Blocks

Atomic public information units from the Public Experience Block Library — Hero, Interactive Map, Statistics, Initiative Levels, Latest Initiatives, Registration Gateway, Related Content, Footer and extensions.

Blocks accept **dataset inputs** and **scope filters**.

## Shared layouts

Page types — Home, listing, detail, About — define hierarchy slots.

Blocks fill slots.

Pages do not invent layout families without Architecture Review.

## Filtered datasets

Public projections and public content feed blocks.

Geographic scope filters rows — not structure.

```
Source data → scope filter → experience block → shared layout → page
```

## No duplicated page architecture

Forbidden: parallel template hierarchies per geography, capability or page whim.

## One Experience Block — One Responsibility

Each block owns exactly one clear civic presentation responsibility.

Blocks compose pages.

Pages do not absorb block boundaries into undifferentiated surfaces.

Information architecture implements **Filter Instead of Duplicate** and **Unified Public Space** principles at composition level.

---

# 8. Standard Public Pages

Standard pages are **compositions of blocks on shared structure**.

Responsibilities only — not visual or routing specification.

## Home

World-scoped platform orientation and curated civic entry.

Public square — observation first, registration last.

## Country

**Specialized filtered experience** — Home architecture with Country scope default and filtered datasets.

Not a separate platform architecture.

## Region

**Specialized filtered experience** — Home architecture with Region scope default and filtered datasets.

Not a separate platform architecture.

## Initiative

Public projection detail for one Participation path.

Pipeline stage context, derived indicators, evidence summaries, related links.

Operational workspace excluded.

## Knowledge

Educational and reference content.

Process explanation — not substitute for live initiative records.

## Media

Public civic communication discovery and item detail.

Supports understanding — not authoritative participation record.

## Institutions

Institutional public presence and civic role context.

Informational — not operational administration.

## About

Platform identity, governance and trust foundations.

Evaluation stage primary destination.

Country and Region are **scope variants of the same page responsibilities** — principally Home-class and listing-class patterns — not independent public products.

Epic 02 Global Experience implements **Home at World scope** per Global Experience Vision.

---

# 9. Architectural Principles

The following principles govern all Public Space architecture.

Violations require Architecture Review — not implementation convenience override.

## We create grounds for trust

Trust emerges from aligned public information — not from claims, certification language or engagement metrics.

## Public Space is the window into a living society

Civic activity visible as structured public life — not as promotional narrative.

## Public Space never persuades. It reveals.

Observation and honest presentation — never urgency, manipulation or conversion pressure.

## Observation precedes participation

Public reading open.

Registration explicit.

Workspace beyond informed choice.

## Navigation serves intentions

Civic questions — not internal modules — define primary destinations.

## Explainable Navigation

Labels predict content.

One responsibility per destination.

Visitors know where they go before they click.

## Explainable Honesty

Derived state labeled.

Evidence as substantiation.

Platform boundaries visible.

No omniscient authority overclaim.

## Transparent Progress

Collective civic advancement visible without exposing private operational detail or individual dignity.

## Trust Through Verification

Public summaries traceable to underlying public projections and recorded civic truth.

Verification is structural — not rhetorical.

## Reusable Experiences

Blocks and layouts compose pages — bespoke page architectures forbidden when reuse suffices.

## One Experience Block — One Responsibility

No merged orientation-conversion-trust megablocks.

## Unified Public Space

One navigation model, one composition discipline, one trust ethic — all scopes.

## Filter Instead of Duplicate

Geography, capability data and content type vary through filtering — not template multiplication.

## Future Extension Without Present Complexity

Reserved scope named in architecture — not partially built before need and review.

## Accessibility builds trust

Public information reachable across abilities and devices — architectural requirement, not overlay.

## Respect human attention

Low cognitive load, calm hierarchy, no overload — attention is civic dignity.

## Progressive disclosure

Identity and orientation before depth.

Understanding and evaluation before registration.

Completeness on demand — not on first screen.

Capability 02 retrospective validated operational/public separation, public projection discipline and derived-state honesty.

These principles extend that foundation to platform-scale Public Space.

---

# 10. Future Evolution

Public Space is **expected to grow**.

Growth must **extend architecture — not replace it**.

## Extension paths

| Extension                          | Attachment model                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| **Additional geographic levels**   | New scope filter parameters — same pages and blocks                              |
| **Additional public destinations** | Footer first; header only with Architecture Review                               |
| **New Experience Blocks**          | Block library extension — existing layouts unchanged                             |
| **New public datasets**            | Feed existing blocks and detail sections                                         |
| **Future civic capabilities**      | Public projections into Initiatives, Institutions, Media — not header per module |

## Epic 02 and beyond

Global Experience implements World entry.

Country and Region experiences reuse Home architecture.

Future epics — institutional surfaces, media libraries, knowledge bases, localized defaults — attach to this foundation.

## Forbidden evolution

- parallel public architectures per geography or capability;
- registration gating on public reading;
- operational workspace content on public pages;
- partial implementation of reserved concepts before review;
- navigation proliferation exposing internal structure.

Future civic capabilities — Impact public surfaces, observatory dashboards, events — integrate through blocks and datasets.

They do not redefine Public Space axiom.

---

# 11. Relationship to Participation

Capability 02 and Capability 03 are **complementary** — not overlapping.

| Capability                            | Question                    | Owns                                                                              |
| ------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| **Capability 02 — Participation**     | How society acts            | Aggregates, lifecycles, operational workspaces, public projection **sources**     |
| **Capability 03 — Public Experience** | How society becomes visible | Public Space architecture, navigation, experience blocks, geographic presentation |

Capability 02 answers: **"How society acts."**

Participation aggregates record civic truth.

Operational workspaces support accountable action.

Public projection builders sanitize aggregate meaning for society.

Capability 03 answers: **"How society becomes visible."**

Public Space organizes discovery, understanding and evaluation at platform scale.

Neither capability depends on **implementation details** of the other.

Capability 03 consumes **public projections and public content** through defined boundaries.

Capability 02 must not embed Public Space navigation architecture.

Capability 03 must not mutate Participation aggregates or replace workspaces.

```
Capability 02                    Capability 03
Participation aggregates         Public Space presentation
        │                                │
        ▼                                ▼
 public projection builders ──► experience blocks
        │                                │
        └──────── read-only ─────────────┘
```

Journey continuity is presentational.

Aggregate independence is architectural.

Share links, Related Content and Registration Gateway connect the capabilities — they do not merge them.

---

# 12. Final Statement

**Public Space is the window into a living society.**

Humanity Union enables people to:

- **observe** civic life in public;
- **understand** structured participation before acting;
- **evaluate** legitimacy through transparent, verifiable information;
- **freely choose** whether to register and participate.

Trust is **earned through transparency** — not **requested through persuasion**.

This document is the **primary architectural reference** for all future Public Experience work.

Epic 01 source documents provide detail.

This architecture provides coherence.

Implementation, visual design, domain modeling and Epic 02 Global Experience engineering must conform to this foundation.

When documents conflict, resolve upward to the principles in Section 9 and the axiom above.

Architecture precedes implementation.

Public Space precedes pressure.

Observation precedes participation.

This document does not define implementation.

---

# Source Documents

This architecture synthesizes — does not replace — the following:

| Document                        | Path                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Discovery Session 01            | `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md` |
| Public Information Map          | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_INFORMATION_MAP.md`             |
| User Journey                    | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/USER_JOURNEY.md`                       |
| Public Page Architecture        | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_PAGE_ARCHITECTURE.md`           |
| Public Experience Block Library | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`    |
| Navigation Architecture         | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/NAVIGATION_ARCHITECTURE.md`            |
| Public Experience Principles    | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_PRINCIPLES.md`       |
| Global Experience Vision        | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`           |
| Capability 02 Retrospective     | `capabilities/02_participation/CAPABILITY_02_RETROSPECTIVE.md`                                      |

---

# Document Status

**Draft**

Public Space Architecture — Epic 01 Information Space

Authoritative consolidated reference for Capability 03 Public Experience foundation.

Architecture freeze and downstream epics must align with this document before implementation proceeds at scale.
