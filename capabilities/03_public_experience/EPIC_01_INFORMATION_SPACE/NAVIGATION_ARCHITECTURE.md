# NAVIGATION ARCHITECTURE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 01 — Information Space

Version: 1.0

Status: Draft

Document Type: Navigation Architecture

---

# Purpose

Define the **navigation architecture** of Humanity Union Public Space.

This document specifies how visitors move through the public platform — by intention, destination and scope — before UI implementation, routing implementation or visual design begin.

It is a navigation architecture document — not a sitemap spreadsheet, not a component library, and not an implementation guide.

It answers:

- what primary and secondary navigation exist;
- what each destination is responsible for;
- how geographic scope affects navigation without forking architecture;
- what rules govern movement, predictability and expansion;
- how navigation relates to experience blocks and page architecture.

Reference:

- `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_INFORMATION_MAP.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/USER_JOURNEY.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_PAGE_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`

Navigation architecture is **experiential structure**.

It is independent from UI widgets, CSS, framework routing and visual layout — though implementation must conform to it.

---

# Navigation Philosophy

**Navigation serves user intentions rather than exposing internal architecture.**

Visitors think in civic questions — not in modules, aggregates, epics or backend services.

Navigation must therefore:

- map to **what visitors want to do** — explore, research, learn, verify, participate;
- hide **how the platform is built** — no aggregate names, no internal capability labels in primary chrome;
- remain **stable across geographic scope** — World, Country and Region share one navigation model;
- minimize **cognitive load** — limited primary destinations, depth over breadth;
- support **calm exploration** — no pressure path toward registration;
- preserve **explainability** — labels predict content before click.

Navigation answers:

**"Where am I, and what can I explore from here?"**

Navigation does not:

- perform civic authority;
- mutate participation state;
- substitute for public projection content;
- expose operational workspace entry as default browse destination.

Internal platform structure — Participation aggregates, projection builders, store modules — feeds navigation **datasets and destinations**.

It must not define navigation **labels or hierarchy**.

Capability 02 operational workspaces sit beyond public navigation's primary responsibility.

Registration Gateway is explicit secondary navigation — not a header destination competing with discovery.

---

# Primary Navigation

Primary navigation lives in the **header**.

It defines six stable public destinations.

Each destination owns **one civic responsibility**.

| Destination      | Visitor Intention            | Navigation Responsibility                                             | Does Not Own                                                                 |
| ---------------- | ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Home**         | Orient and enter calmly      | Platform introduction, scope context, curated civic entry             | Full initiative catalog, institutional administration, registration pressure |
| **Initiatives**  | Discover live civic activity | Public Participation projections — browse and reach initiative detail | Operational workspaces, task management, aggregate mutation                  |
| **Institutions** | Discover civic actors        | Institutional public profiles and roles                               | Participation operations, commitment or implementation recording             |
| **Media**        | Follow public communication  | Announcements, recordings, publications                               | Authoritative participation records, opinion threads                         |
| **Knowledge**    | Learn how the platform works | Guides, glossary, process explanation                                 | Live initiative state as substitute for public projections                   |
| **About**        | Evaluate platform legitimacy | Mission, governance, trust foundations                                | Initiative listings, media archives as primary home                          |

## Home

**Primary transition role:** entry hub for all personas.

Home navigation orients — it routes visitors toward Initiatives, Knowledge or About based on intention.

Home is not a duplicate of Initiatives listing.

## Initiatives

**Primary transition role:** civic activity discovery and detail entry.

Initiatives is the main path for Researcher and Future Participant journeys.

List → detail is the core Initiatives navigation pattern.

## Institutions

**Primary transition role:** contextual actor discovery.

Institutions link outward to related Initiatives and Media — not inward to operational admin.

## Media

**Primary transition role:** documented public communication discovery.

Media links to subject Initiatives and source Institutions.

## Knowledge

**Primary transition role:** comprehension layer across the platform.

Knowledge supports Learner and Verification Seeker journeys.

Cross-links to live examples — never replaces Initiatives as civic truth surface.

## About

**Primary transition role:** trust foundation.

About supports Verification Seeker journeys and informed registration decisions.

Links to Knowledge for depth — does not duplicate Knowledge's reference responsibility.

## Primary navigation diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Header — Primary Navigation                                      │
│  Home · Initiatives · Institutions · Media · Knowledge · About   │
└──────────────────────────────────────────────────────────────────┘
         │              │              │         │          │
         ▼              ▼              ▼         ▼          ▼
    orientation    civic activity   actors   comms    reference  trust
```

Primary items remain fixed across World, Country and Region.

Changing scope does not change header destinations.

---

# Secondary Navigation

Secondary navigation supports orientation, context and explicit choice — without competing with header hierarchy.

## Footer

**Role:** supporting destinations and platform obligations.

Footer carries:

- legal and privacy links;
- accessibility statements;
- contact and support;
- language and locale where applicable;
- reserved slots for future secondary destinations.

Footer navigation is **supporting** — not primary discovery.

New low-frequency destinations should land in footer before header consideration.

## Breadcrumbs

**Role:** positional orientation within a destination hierarchy.

Breadcrumbs answer:

**"Where am I within this destination?"**

Typical patterns:

- Initiatives → initiative detail;
- Institutions → institution profile;
- Media → media item;
- Knowledge → article;
- About → sub-section.

Breadcrumbs reflect **visitor path** — not internal module graphs.

They must not expose aggregate or capability internal names.

## Related Content

**Role:** contextual cross-navigation between destinations.

Related Content is a **secondary navigation block** — defined in the Public Experience Block Library — connecting logically associated public information.

Examples:

- initiative detail → related institutions, media, knowledge;
- media item → related initiative;
- institution profile → related initiatives.

Related Content navigates by **civic context** — not engagement optimization.

It must not duplicate primary destination responsibility under alternate labels.

## Registration Gateway

**Role:** explicit transition from public to registrant.

Registration Gateway is **secondary navigation** — never a primary header item.

It appears when journey context supports informed participation choice.

It must not interrupt first orientation or gate public reading.

Registration Gateway navigates **across the public boundary** — into Capability 01 registration flow and eventually Capability 02 operational workspaces.

## Geographic Navigation

**Role:** scope selection without architecture change.

Geographic navigation controls **World · Country · Region** filter context.

It lives in global chrome — alongside or integrated with header — not as a separate site switcher.

Changing geographic scope:

- preserves current destination where applicable;
- re-filters datasets;
- must not navigate to a different header set or footer structure.

Geographic navigation is **filter control** — not product mode selection.

---

# Navigation Rules

All public navigation conforms to the following rules.

## Maximum three logical transitions to reach any public destination

From any primary header destination, a visitor must reach any other public destination within **three logical transitions**.

Logical transitions count intentional navigation steps — not pagination, scroll sections or in-page anchors.

Examples (logical steps):

| From      | To                  | Steps                                                   |
| --------- | ------------------- | ------------------------------------------------------- |
| Home      | Initiatives listing | 1 — primary nav                                         |
| Home      | Initiative detail   | 2 — Initiatives → detail                                |
| Media     | About               | 2 — header cross-nav, or 1 via footer where appropriate |
| Knowledge | Initiative detail   | 2 — related content or Initiatives → detail             |

Deep links may reduce steps on entry — architecture must still support three-step reach from any header item when browsing normally.

Forbidden: hiding primary destinations behind chains longer than three logical steps without Architecture Review.

## Consistent placement

- primary navigation always in header;
- footer always at page bottom with supporting links;
- geographic scope control always in global chrome;
- breadcrumbs always above primary content when hierarchy depth warrants them;
- Registration Gateway always in secondary zone — never replacing Hero on first contact.

Placement is architectural — not per-page invention.

## Predictable behaviour

- selecting a header item always reaches the same destination type;
- changing scope never changes header labels or order;
- back navigation and breadcrumbs reflect hierarchy honestly;
- external entry deep links land in same architecture as browse entry;
- empty scoped results show honest scope-specific empty state — not silent redirect to different destination.

## Explainable navigation

- labels use civic language;
- each destination name predicts content;
- no internal codenames in navigation chrome;
- derived-state pages include trust context near navigation context — not hidden after excessive clicks.

## Progressive disclosure

- primary nav exposes destinations — not every sub-page;
- listing before detail;
- detail before registration;
- secondary nav (Related Content, footer) reveals depth after primary comprehension;
- geographic drill-down optional after scope selection — not forced on first visit.

Navigation depth follows User Journey sequence:

Discover → Understand → Trust → Register → Participate

---

# Geographic Navigation

Geographic navigation models **scope** — not separate public products.

```
World
  │
  ▼
Country
  │
  ▼
Region
  │
  ▼
Future geographic levels (reserved)
```

## World

Default or explicit global scope.

Visitor question: **"What is happening across Humanity Union?"**

All primary destinations available with unfiltered or globally aggregated datasets per page rules.

## Country

National scope filter.

Visitor question: **"What matters in this country?"**

Same destinations, same page architecture, country-filtered datasets.

URL or state may reflect country context — navigation chrome unchanged.

## Region

Local or regional scope filter.

Visitor question: **"What matters near me?"**

Same destinations, same page architecture, region-filtered datasets.

Interactive Map block may assist region selection — map is navigation aid, not alternate architecture.

## Future geographic levels

Additional levels — municipality, district, custom civic geography — may be reserved for future Architecture Review.

Future levels must:

- attach as **filter parameters** on existing navigation;
- reuse header, footer and primary destinations;
- not introduce parallel navigation trees or site forks.

## Filtering — not forking

```
                    Geographic scope parameter
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           World          Country         Region
              │               │               │
              └───────────────┴───────────────┘
                              │
              Same Initiatives nav · Same Institutions nav
                              │
                    filter(datasets, scope)
```

Geographic navigation adapts **what appears** — not **how navigation works**.

Forbidden:

- separate header per country;
- region-only footer legal structure;
- World Initiatives page vs Region Initiatives page as different template families;
- geographic mode switch that reloads different primary navigation set.

---

# Future Expansion

New navigation destinations must attach without redesigning primary architecture.

## Expansion hierarchy

| Priority | Expansion path                                 | Review bar                          |
| -------- | ---------------------------------------------- | ----------------------------------- |
| **1**    | Related Content and in-destination depth       | Standard epic scope                 |
| **2**    | Footer secondary links                         | Low — supporting destinations       |
| **3**    | New experience blocks in existing destinations | Medium — block library update       |
| **4**    | New primary header destination                 | High — Architecture Review required |

## Adding footer destinations

Preferred path for:

- legal additions;
- open data references;
- newsletter or subscription;
- careers or foundation links;
- developer documentation entry.

Footer expansion must not introduce alternate primary navigation systems.

## Adding header destinations

Requires proven civic-level importance.

Candidate future primary destinations — **not authorized here**:

- **Impact** — likely extends Initiatives detail and widgets before header promotion;
- **Events** — footer or Media extension first;
- **Observatory / Public Data** — Knowledge or footer extension first.

New header items must:

- own one clear responsibility not already owned;
- satisfy three-step reach rule for all destinations;
- work identically at World, Country and Region;
- not expose internal capability structure.

## Adding geographic levels

Extend scope parameter model.

Update Interactive Map and filter logic.

Do not fork navigation architecture.

## Capability integration without navigation explosion

Future capabilities integrate through:

- dataset sources for existing destinations;
- Related Content cross-links;
- detail page sections and block library widgets;

—not through one header item per backend module.

```
Future capability
       │
       ▼
public projection / public content
       │
       ▼
existing destination (usually Initiatives)
       │
       ▼
same primary navigation
```

Navigation architecture scales by **attachment** — not by **multiplication**.

---

# Final Statement

**Navigation Architecture is independent from UI implementation.**

This document defines:

- primary header destinations and responsibilities;
- secondary navigation roles — footer, breadcrumbs, related content, registration gateway, geographic scope;
- rules for reach, placement, predictability and progressive disclosure;
- geographic filtering without architectural fork;
- controlled future expansion.

UI renders navigation.

Framework routes implement navigation.

Visual design styles navigation.

None of them redefine navigation responsibilities.

Implementation must conform to this architecture.

Visitors must encounter one calm, predictable, intention-serving navigation model across all Public Space pages — at every geographic scope — without exposure to internal platform structure.

Navigation serves people.

It does not serve engineering convenience.

This document does not define implementation.

---

# References

| Document                        | Path                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Discovery Session 01            | `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md` |
| Public Information Map          | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_INFORMATION_MAP.md`             |
| User Journey                    | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/USER_JOURNEY.md`                       |
| Public Page Architecture        | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_PAGE_ARCHITECTURE.md`           |
| Public Experience Block Library | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`    |

---

# Document Status

**Draft**

Navigation Architecture — Information Space Epic 01

Routing specifications, UI components and implementation guides must align with this document before build begins.
