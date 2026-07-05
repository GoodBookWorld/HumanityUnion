# PUBLIC INFORMATION MAP

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 01 — Information Space

Version: 1.0

Status: Draft

Document Type: Information Architecture Map

---

# Purpose

Define the complete **public information space** of Humanity Union.

This document maps the entire visitor experience before domain modeling begins.

It is an information map — not an architecture review, not an implementation guide, and not a visual design specification.

It answers:

- what public information exists;
- how primary destinations relate;
- how visitors enter and move through the platform;
- how geographic scope affects content without forking architecture;
- where future pages may attach without redesign.

Reference:

- `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md`
- `capabilities/02_participation/CAPABILITY_02_RETROSPECTIVE.md`

Capability 02 established that public projections must remain distinct from operational workspaces, that derived civic state must be labeled honestly, and that future scope must be named without partial implementation.

This map applies those lessons to the full public surface of Humanity Union.

---

# Public Information Space

Humanity Union is **one unified public civic space**.

Society encounters a single platform — not a collection of disconnected public sites.

All public information belongs to one information space governed by:

- one navigation tree;
- one layout system;
- one widget vocabulary;
- one visitor journey model;
- one trust and copy discipline.

Participation aggregates remain authoritative for civic action within their domains.

Public Experience governs how civic information is **organized, discovered and understood** at platform scale.

Operational participation workspaces sit beyond the public boundary.

Public projections from Capability 02 feed into this space — they do not define its navigation architecture alone.

```
┌─────────────────────────────────────────────────────────────┐
│              Humanity Union Public Information Space         │
│                                                              │
│   Orientation · Discovery · Understanding · Trust          │
│                                                              │
│   ┌─────────┐ ┌───────────┐ ┌─────────────┐ ┌─────────┐   │
│   │  Home   │ │Initiatives│ │Institutions │ │  Media  │   │
│   └────┬────┘ └─────┬─────┘ └──────┬──────┘ └────┬────┘   │
│        │            │              │             │          │
│   ┌────┴────┐       │         ┌────┴────┐   ┌────┴────┐     │
│   │Knowledge│◄──────┴────────►│  About  │◄──┤  Trust  │     │
│   └─────────┘                 └─────────┘   │  Layer  │     │
│                                              └─────────┘     │
│   Scope filter: World · Country · Region (same architecture) │
│   Boundary ──────────────────────────────► Register · Participate │
└─────────────────────────────────────────────────────────────┘
```

The public information space is **experiential**.

It orients visitors before they cross into accountable participation.

---

# Public Navigation Tree

The header defines six primary public destinations.

Each destination owns one responsibility.

Relationships show how visitors move between domains — not duplicate content ownership.

```
                              [ Scope: World | Country | Region ]
                                              │
                                            Home
                         orientation · scope · curated entry
                    ┌───────────┬───────────┼───────────┬───────────┐
                    │           │           │           │           │
                    ▼           ▼           ▼           ▼           ▼
              Initiatives  Institutions   Media    Knowledge     About
                    │           │           │           │           │
                    │           └─────┬─────┴─────┬─────┘           │
                    │                 │           │                 │
                    └────────────────►│◄──────────┘                 │
                          cross-links │                             │
                                      ▼                             │
                              Understand civic context              │
                                      │                             │
                                      └──────────► Trust ◄───────────┘
                                                      │
                                                      ▼
                                              Register (explicit)
                                                      │
                                                      ▼
                                    Participate (operational boundary)
```

## Destination map

| Destination      | Primary Question                                      | Information Owned                                                    | Relates To                                                                   |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Home**         | What is Humanity Union and where do I begin?          | Platform orientation, scope selector, curated entry                  | All destinations — as entry hub                                              |
| **Initiatives**  | What civic activity is happening?                     | Public Participation projections (Initiative through Implementation) | Institutions (context), Media (coverage), Knowledge (process), About (trust) |
| **Institutions** | Who are the civic bodies involved?                    | Institutional public profiles and roles                              | Initiatives (linked activity), About (governance), Knowledge (definitions)   |
| **Media**        | What has been communicated publicly?                  | Announcements, recordings, publications                              | Initiatives (subject context), Institutions (sources), Knowledge (reference) |
| **Knowledge**    | How does this platform work?                          | Guides, glossary, process explanation                                | All destinations — as comprehension layer                                    |
| **About**        | Why does Humanity Union exist and what does it claim? | Mission, governance, trust foundations                               | Knowledge (detail), Initiatives (evidence of purpose)                        |

## Relationship rules

- **Home** introduces — it does not duplicate listing pages.
- **Initiatives** is the primary live civic activity destination.
- **Knowledge** explains — it does not replace live public projections.
- **About** establishes trust foundations — it does not host initiative listings.
- **Media** documents communication — it is not the authoritative participation record.
- **Institutions** contextualize actors — they do not administer participation operations in public.

Cross-links connect related information.

They must not create alternate paths to the same primary responsibility.

---

# Visitor Entry Points

First-time visitors may enter from multiple external contexts.

Every entry point must land in the **same public architecture**.

## Primary entry points

| Entry                       | Typical Context                         | First Landing                          | Expected Next Move                             |
| --------------------------- | --------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| **Platform root**           | Direct visit, search, bookmark          | Home (default scope)                   | Discover via Initiatives or Knowledge          |
| **Shared initiative link**  | Social share, email, external reference | Initiatives → public projection detail | Understand → Trust → Register if participating |
| **Institutional reference** | Organization website, citation          | Institutions → profile                 | Initiatives or Media for related activity      |
| **Media reference**         | Publication, announcement link          | Media → item detail                    | Initiatives for subject context                |
| **Knowledge reference**     | Help link, glossary, onboarding         | Knowledge → article                    | Home or Initiatives for exploration            |
| **Scoped link**             | Country or Region specific URL          | Same page type with scope pre-filtered | Scope change without navigation change         |

## First-time visitor path

```
External entry
      │
      ▼
Landing page (Home or deep link within same architecture)
      │
      ▼
Orientation — scope visible, navigation predictable
      │
      ▼
Discover — Initiatives, Institutions, Media browse
      │
      ▼
Understand — detail pages, Knowledge cross-links
      │
      ▼
Trust — About, derived labels, verification footnotes
      │
      ▼
Register — explicit gateway (never implied by browse)
      │
      ▼
Participate — operational workspace entry (Capability 02 boundary)
```

## Returning visitor path

Returning visitors may skip orientation.

Navigation must remain stable so they can:

- return directly to Initiatives or Institutions;
- change World / Country / Region scope without losing place in the information model;
- deep-link to public projections shared from prior visits.

## Forbidden entry patterns

- separate landing architectures per geographic level;
- registration prompts before orientation on first visit;
- operational workspace URLs presented as default public entry;
- duplicate initiative detail pages under Home, Media and Initiatives with inconsistent hierarchy.

---

# World / Country / Region

World, Country and Region are **filtered views** of one public information space.

They are not separate platforms, sites or navigation trees.

## Shared across all levels

| Element             | Shared Behavior                                                  |
| ------------------- | ---------------------------------------------------------------- |
| Header destinations | Home, Initiatives, Institutions, Media, Knowledge, About         |
| Footer structure    | Legal, accessibility, contact, secondary links                   |
| Page templates      | Home, listing, detail, collection                                |
| Widget vocabulary   | Same components, same slots                                      |
| Information flow    | Visitor → Discover → Understand → Trust → Register → Participate |
| Trust rules         | Derived labels, sanitization, explainable honesty                |

## Different per level

| Element         | Filtered Behavior                                              |
| --------------- | -------------------------------------------------------------- |
| Dataset scope   | Which initiatives, institutions, media and knowledge appear    |
| Default scope   | Sensible geographic context on first visit where applicable    |
| Contextual copy | Titles and labels framed for World, Country or Region          |
| Empty states    | Honest scope-specific absence — not hidden architecture change |

## Scope selector

The scope selector is a **filter control** — not a mode switch to a different product.

Changing scope:

- preserves current destination where meaningful;
- re-filters widgets and listings;
- must not reload a different header, footer or layout family.

```
        World                Country               Region
          │                    │                     │
          └────────────────────┼─────────────────────┘
                               │
                    Same Initiatives listing layout
                               │
                    filter(initiatives, scope)
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         all initiatives   country set      region set
```

---

# Information Flow

Public information follows a visitor journey from arrival to participation readiness.

This flow is **experiential sequencing** — not a domain command pipeline.

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

## Stage map

| Stage           | Visitor State                         | Primary Destinations                              | Information Goal                              |
| --------------- | ------------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| **Visitor**     | First contact, no operational context | Home, About                                       | Orient — what is this platform?               |
| **Discover**    | Exploring openly, no account required | Initiatives, Institutions, Media                  | Find civic activity and actors                |
| **Understand**  | Reading detail, comparing context     | Initiative detail, Knowledge, cross-links         | Comprehend civic meaning before judgment      |
| **Trust**       | Evaluating legitimacy                 | About, derived indicators, verification footnotes | Verify through explainable public information |
| **Register**    | Choosing to participate               | Registration gateway (explicit entry)             | Become registered participant                 |
| **Participate** | Accountable civic action              | Operational workspaces (Capability 02)            | Cross public boundary                         |

## Flow rules

- no stage may be skipped by architecture — but visitors may enter at any stage via deep link;
- Discover and Understand require no registration;
- Trust must not rely on marketing language — structural explainability only;
- Register is always explicit — browsing never implies enrollment;
- Participate is outside Public Experience information ownership — entry only.

Capability 02 retrospective confirmed: **public transparency must not expose individual dignity**.

Information flow ends at Register on the public side.

Participate belongs to operational experience with its own workspace standard.

---

# Widget Architecture

Public pages compose **reusable widgets** on **shared layouts** fed by **filtered datasets**.

No destination may introduce a duplicate page architecture when an existing layout suffices.

## Reusable widgets

Widgets are the atomic units of public information presentation.

| Widget Category                   | Purpose                         | Scope Behavior                               |
| --------------------------------- | ------------------------------- | -------------------------------------------- |
| **Scope selector**                | World / Country / Region filter | Global chrome — persists across destinations |
| **Orientation hero**              | Calm entry and context          | Home primary; optional on listings           |
| **Initiative summary card**       | Public projection preview       | Filtered by scope                            |
| **Participation stage indicator** | Pipeline position label         | Read-only; honest stage naming               |
| **Derived metric display**        | Support, readiness, progress    | Always labeled derived                       |
| **Institutional profile summary** | Organization public presence    | Filtered by scope                            |
| **Media item preview**            | Communication artifact          | Filtered by scope                            |
| **Knowledge excerpt**             | Educational reference           | Often global; may be scoped                  |
| **Trust footnote**                | Verification and honesty copy   | Attached to derived or evidence widgets      |
| **Registration gateway CTA**      | Explicit participate entry      | Gated — not on every widget                  |

Widget rules:

- accept scope as input;
- render identically at every geographic level;
- never expose operational fields or participant identity by default;
- never present derived values as manually authored authority.

## Shared layouts

| Layout Type           | Used By                                                                          | Slot Pattern                                                      |
| --------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Home layout**       | Home                                                                             | Orientation → curated widgets → scope-aware highlights            |
| **Listing layout**    | Initiatives, Institutions, Media, Knowledge indexes                              | Filters → list/grid widgets → pagination                          |
| **Detail layout**     | Initiative public projection, institution profile, media item, knowledge article | Header context → primary content → related links → trust footnote |
| **Collection layout** | Themed groupings, curated sets                                                   | Intro → grouped widgets → cross-links                             |
| **About layout**      | About, governance pages                                                          | Narrative sections → trust foundations                            |

Layouts define slots.

Widgets fill slots.

Pages do not define new layout families without Architecture Review.

## Filtered datasets

Data feeding widgets is scoped — not forked.

```
Public projection / public content source
              │
              ▼
       scope filter (World | Country | Region)
              │
              ▼
         widget render
              │
              ▼
    same widget · same layout · different rows
```

Filtering belongs to query and projection layers.

UI must not duplicate components per scope.

## No duplicated page architecture

Forbidden:

- `InitiativesWorldPage` and `InitiativesRegionPage` as separate template hierarchies;
- institution detail pages with different hierarchy than initiative detail pages where shared detail layout suffices;
- Media and Knowledge each inventing unrelated listing patterns;
- Capability-specific public shells outside this map.

Capability 02 **Public Projection Pattern** applies platform-wide:

builders and projections feed widgets — public pages do not serialize operational aggregates.

---

# Navigation Principles

## Consistency

One header, one footer, one scope model, one layout vocabulary across the entire public information space.

A visitor who learns Initiatives at World scope must recognize Initiatives at Region scope immediately.

## Low cognitive load

Limit primary header destinations.

Prefer depth within destinations over breadth in navigation.

One clear responsibility per menu item.

## Predictable navigation

Labels describe civic meaning.

Visitors predict content before clicking.

Current destination, scope and page type remain visible in hierarchy.

## Progressive disclosure

Home orients before listing everything.

Listings precede detail depth.

Knowledge and About provide comprehension without blocking discovery.

Derived indicators expand explanation — they do not overwhelm first view.

## Future scalability

New information attaches through:

- new widgets in existing layouts;
- new listing rows or detail sections;
- footer slots for secondary destinations;

—not through parallel navigation systems or alternate public architectures.

---

# Future Expansion

Future public pages must attach to this map without redesign.

## Header expansion (high bar)

Header changes require Architecture Review.

Potential future primary destinations — **not authorized here** — must justify header-level civic importance:

| Reserved Concept       | Likely Relationship                      | Expansion Path                                                            |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| **Events**             | Time-based public civic gatherings       | Footer first → header only if primary discovery need proven               |
| **Impact**             | Stage 8 public outcome surfaces          | Initiatives detail extension and widgets before new top-level destination |
| **Observatory / Data** | Public aggregate transparency dashboards | Footer or Knowledge extension first                                       |

## Footer expansion (default path)

Supporting destinations should land in footer before header:

- privacy and terms;
- accessibility;
- contact and support;
- open data / developer references;
- language and locale;
- careers or foundation links if approved;
- newsletter or subscription if governed separately from Media.

## Widget expansion

New widgets attach to existing layouts:

- impact summary widget (future Epic);
- institution relationship widget;
- timeline widget for public participation journey;
- comparison widget for policy context;
- map widget for geographic context within Region scope.

## Layout expansion

New layout types require map update — not ad hoc pages:

- **Search results layout** — cross-destination discovery;
- **Guide layout** — long-form Knowledge paths;
- **Legal layout** — footer-linked static governance text.

## Domain expansion without navigation explosion

Capability 02 Participation stages surface primarily through **Initiatives** public projections.

Future Capability domains should integrate as:

- filtered dataset sources;
- detail page sections;
- related link widgets;

—not as new header items per aggregate.

```
Future capability public data
            │
            ▼
    projection builder
            │
            ▼
   existing widget + layout
            │
            ▼
   Initiatives · Institutions · Media · Knowledge
   (not new header per capability)
```

---

# Final Statement

This document is the **foundation of all Public Experience architecture** for Humanity Union.

It maps:

- one unified public civic information space;
- six primary header destinations and their relationships;
- visitor entry points and movement paths;
- World, Country and Region as filtered views of one architecture;
- the visitor-to-participant information flow;
- widget, layout and dataset composition rules;
- navigation principles and controlled future expansion.

Domain modeling, visual design and implementation for Capability 03 must conform to this map.

No public page, route or component family may be designed outside this information space without updating this document through governance review.

Humanity Union public experience must remain calm, consistent and trustworthy — so visitors can discover civic life, understand it honestly and choose participation deliberately.

This document does not define implementation.

It defines the complete public information space before domain modeling begins.

---

# References

| Document                          | Path                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Discovery Session 01              | `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md` |
| Capability 02 Retrospective       | `capabilities/02_participation/CAPABILITY_02_RETROSPECTIVE.md`                                      |
| Experience Architecture           | `project/architecture/experience/EXPERIENCE_ARCHITECTURE.md`                                        |
| Participation Architecture Freeze | `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`                              |

---

# Document Status

**Draft**

Public Information Map — Information Space Epic 01

Downstream domain language, domain model and architecture freeze documents must align with this map before implementation.
