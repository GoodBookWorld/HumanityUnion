# PUBLIC PAGE ARCHITECTURE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 01 — Information Space

Version: 1.0

Status: Draft

Document Type: Page Architecture

---

# Purpose

Define the **standard page architecture** for all Humanity Union Public Space pages.

This document specifies how public pages are structured, composed and experienced — before visual design, domain modeling or implementation begin.

It is a page architecture document — not an implementation guide and not a visual design system.

It answers:

- how public pages are assembled;
- which canonical widgets exist and what each owns;
- how standard page types compose widgets;
- how responsive behavior preserves hierarchy;
- how progressive disclosure and design principles apply uniformly.

Reference:

- `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_INFORMATION_MAP.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/USER_JOURNEY.md`

The Public Information Map defines destinations and relationships.

The User Journey defines visitor intentions and movement.

This document defines **page structure** — the reusable experience blocks that implement both.

Public Experience is composed from widgets and layouts — not from bespoke page designs.

---

# Shared Page Structure

Every public page shares one structural model.

Pages are **assembled from reusable experience blocks** — not hand-crafted as unique layouts.

```
┌─────────────────────────────────────────────────────────────┐
│  Global Chrome (persistent)                                  │
│  Header · Scope selector · Primary navigation                │
├─────────────────────────────────────────────────────────────┤
│  Page Hero / Context (page-type slot)                        │
├─────────────────────────────────────────────────────────────┤
│  Primary Content Zone                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Widget    │  │   Widget    │  │   Widget    │  ...     │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  Secondary Zone (optional)                                   │
│  Related Content · Trust footnotes · Registration Gateway    │
├─────────────────────────────────────────────────────────────┤
│  Footer (persistent)                                         │
└─────────────────────────────────────────────────────────────┘
```

## Structural layers

| Layer                    | Responsibility                                               |
| ------------------------ | ------------------------------------------------------------ |
| **Global chrome**        | Header navigation, scope context, platform orientation       |
| **Page context**         | Hero or equivalent — where am I and why does this page exist |
| **Primary content zone** | Main widgets carrying page purpose                           |
| **Secondary zone**       | Supporting widgets — related links, media, registration      |
| **Footer**               | Supporting navigation, legal, accessibility, contact         |

## Assembly rules

- pages select widgets — they do not invent new layout DNA;
- widget order follows information hierarchy — not visual novelty;
- scope (World, Country, Region) filters widget datasets — not widget structure;
- operational participation content never replaces public projection widgets in this layer;
- derived civic values always pass through honest labeling widgets or trust footnotes.

One page architecture serves all geographic levels and all primary destinations.

---

# Standard Widgets

Canonical widgets are the building blocks of Public Experience.

Each widget owns **one clear responsibility**.

Widgets accept **dataset inputs** and **scope filters** — not page-specific custom markup.

## Hero

**Responsibility:** Calm orientation — page title, civic context and primary framing copy.

The Hero answers where the visitor is and what this page is for.

It is not a marketing billboard.

It does not stack every platform claim in one view.

Used on: Home, Country, Region, About, major listing entry pages.

## Interactive Map

**Responsibility:** Geographic context and scope exploration.

The Interactive Map helps visitors understand **where** civic activity relates geographically.

It supports scope selection and regional orientation — it is not a task assignment or operational dashboard.

Map interaction changes filtered datasets — not page architecture.

Used on: Home, Country, Region — primary or secondary slot depending on page emphasis.

## Statistics

**Responsibility:** Aggregate public metrics at current scope.

Statistics summarize civic activity counts and high-level indicators suitable for public display.

All derived values must be labeled derived.

Statistics must not use engagement gamification, ranking pressure or unverifiable claims.

Used on: Home, Country, Region, About (platform scale context).

## Initiative Levels

**Responsibility:** Explain participation pipeline stage presence at a glance.

Initiative Levels show how civic activity distributes across pipeline stages in public view — Initiative, analysis context, decision, petition, commitment, implementation where applicable.

This widget orients — it does not replace initiative detail.

Stage labels use civic language from Capability 02 — not product synonyms.

Used on: Home, Country, Region, Initiatives listing entry.

## Latest Initiatives

**Responsibility:** Curated or recency-ordered public initiative previews.

Latest Initiatives surfaces initiative summary cards from public projections filtered by scope.

It invites discovery — it does not expose operational workspace internals.

Used on: Home, Country, Region, Media and Institutions pages as cross-discovery where relevant.

## Registration Gateway

**Responsibility:** Explicit entry to registration when the visitor chooses to participate.

Registration Gateway is a deliberate call-to-action — never ambient pressure on every widget.

It appears when journey context supports informed choice — not on first orientation screen by default.

It must not gate public reading.

Used on: Home secondary zone, Initiative detail, About — sparingly elsewhere.

## Trusted Media Carousel

**Responsibility:** Rotating or browsable preview of public media artifacts.

Trusted Media Carousel surfaces announcements, recordings and publications that help society follow civic activity.

"Trusted" means platform-governed public communication — not unverified external endorsement.

Carousel supports understanding — it is not the authoritative participation record.

Used on: Home, Media listing entry, Initiative detail secondary zone.

## Related Content

**Responsibility:** Cross-links to logically connected public information.

Related Content connects initiatives, institutions, media and knowledge without duplicating primary page responsibility.

Links must be predictable — related means civic context, not algorithmic engagement bait.

Used on: Initiative detail, Institutions detail, Media detail, Knowledge articles.

## Footer

**Responsibility:** Supporting navigation and platform obligations.

Footer carries legal, accessibility, contact, locale and future secondary destinations.

Footer does not compete with header hierarchy.

Footer is global chrome — identical structure across all pages.

Used on: every public page.

---

# Standard Pages

Standard pages are **compositions of canonical widgets** on the shared page structure.

Country and Region are **not separate page architectures**.

They are Home-class pages with default scope and filtered datasets.

## Home

**Purpose:** Platform orientation and curated civic entry at default or visitor-selected scope.

**Layout:** Shared page structure · Home-class composition

**Primary widgets:**

| Zone            | Widgets                                                               |
| --------------- | --------------------------------------------------------------------- |
| Page context    | Hero                                                                  |
| Primary content | Interactive Map · Statistics · Initiative Levels · Latest Initiatives |
| Secondary       | Trusted Media Carousel · Registration Gateway (non-intrusive)         |
| Global          | Header · Footer                                                       |

**Journey role:** Visitor → Discover

Home orients — it does not list everything on the platform.

## Country

**Purpose:** Same as Home with **Country scope** pre-selected.

**Layout:** Identical to Home — filtered datasets only

**Primary widgets:** Hero (country-framed) · Interactive Map · Statistics · Initiative Levels · Latest Initiatives · Trusted Media Carousel · Registration Gateway · Footer

**Journey role:** Discover at national context

No separate Country template family.

## Region

**Purpose:** Same as Home with **Region scope** pre-selected.

**Layout:** Identical to Home — filtered datasets only

**Primary widgets:** Hero (region-framed) · Interactive Map · Statistics · Initiative Levels · Latest Initiatives · Trusted Media Carousel · Registration Gateway · Footer

**Journey role:** Discover at local context

No separate Region template family.

## Initiative

**Purpose:** Public projection detail for one civic participation path.

**Layout:** Detail-class composition on shared page structure

**Primary widgets:**

| Zone            | Widgets                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Page context    | Hero (initiative subject and stage context)                                                                         |
| Primary content | Participation stage indicator · derived metric displays · public timeline sections · evidence summaries (sanitized) |
| Secondary       | Related Content · Trusted Media Carousel · Registration Gateway · trust footnotes                                   |
| Global          | Header · scope selector · Footer                                                                                    |

**Journey role:** Understand → Trust

Initiative pages surface Capability 02 public projections — not operational workspaces.

## Knowledge

**Purpose:** Educational and reference content for platform comprehension.

**Layout:** Listing-class and detail-class compositions

**Listing widgets:** Hero · knowledge excerpt list · Related Content entry points · Footer

**Detail widgets:** Hero · article body blocks · Related Content · Footer

**Journey role:** Understand (Learner persona primary)

Knowledge explains — it does not substitute live initiative public records.

## Media

**Purpose:** Public civic media discovery and item detail.

**Layout:** Listing-class and detail-class compositions

**Listing widgets:** Hero · Trusted Media Carousel (expanded listing mode) · Latest Initiatives cross-link · Footer

**Detail widgets:** Hero · media item content · Related Content · Footer

**Journey role:** Discover → Understand

## Institutions

**Purpose:** Public institutional presence — profiles and civic role context.

**Layout:** Listing-class and detail-class compositions

**Listing widgets:** Hero · institutional profile summaries · Statistics (scoped) · Footer

**Detail widgets:** Hero · institutional profile detail · Latest Initiatives · Related Content · Footer

**Journey role:** Discover → Understand

Institutions inform — they do not administer participation operations in public.

## About

**Purpose:** Platform identity, mission, governance and trust foundations.

**Layout:** About-class composition on shared page structure

**Primary widgets:**

| Zone            | Widgets                                                              |
| --------------- | -------------------------------------------------------------------- |
| Page context    | Hero                                                                 |
| Primary content | narrative sections · Statistics (platform scale) · trust foundations |
| Secondary       | Registration Gateway · Related Content (Knowledge links)             |
| Global          | Footer                                                               |

**Journey role:** Trust (Verification Seeker primary)

About establishes explainable honesty — not promotional conversion.

---

# Widget Reuse

Widgets are **reused across pages** with different datasets and slot emphasis.

```
                    ┌──────────┐
                    │   Hero   │◄──── Home · Country · Region · Initiative · About · ...
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
  │ Statistics  │ │Latest Init. │ │ Related Content │
  └─────────────┘ └─────────────┘ └─────────────┘
         │               │               │
         └───────────────┴───────────────┘
                         │
              same widget · different dataset · different slot
```

## Reuse rules

| Rule                      | Meaning                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| **One widget definition** | Hero is one widget — not six page-specific heroes                                                |
| **Dataset variation**     | Latest Initiatives on Home vs Region differs only in filter                                      |
| **Slot variation**        | Registration Gateway may appear in secondary on Initiative detail but not in Hero on first visit |
| **No forked copies**      | Forbidden: `HomeStatisticsWidget` and `RegionStatisticsWidget` as separate architectures         |
| **Projection feeding**    | Participation public data feeds initiative widgets through projection builders                   |

Reuse reduces cognitive load.

Visitors who learn Statistics on Home recognize Statistics on Country immediately.

Reuse reduces engineering drift.

New pages compose existing widgets — they do not authorize new page architectures without review.

---

# Responsive Principles

Public pages maintain the **same information hierarchy** across form factors.

Responsive design changes presentation — not civic meaning or content priority.

## Desktop

- full header navigation visible;
- primary content zone may use multi-column widget arrangement;
- Interactive Map may appear at full width in primary zone;
- Related Content may sit beside primary detail;
- hierarchy: context → primary widgets → secondary widgets → footer.

## Tablet

- header navigation remains primary — no hamburger-only loss of destination clarity unless space truly requires collapse;
- widgets reflow to fewer columns — order preserved;
- Interactive Map remains usable — not hidden by default;
- Registration Gateway remains explicit — not sticky-interruptive.

## Mobile

- single-column flow following same hierarchy as desktop;
- Hero and primary civic meaning appear before secondary widgets;
- scope selector remains accessible in chrome — not buried;
- Related Content follows primary content — never precedes page purpose;
- Footer remains complete — legal and accessibility links accessible.

## Responsive rules

- never reorder hierarchy to prioritize registration over understanding on mobile;
- never hide derived-value labeling or trust footnotes on small screens;
- never introduce mobile-only page architectures;
- never show operational workspace controls in public responsive layouts.

Consistency of hierarchy across breakpoints supports Trust and Calmness design principles.

---

# Progressive Disclosure

Pages reveal deeper information **naturally** — without overwhelming first-time visitors.

## Page-level disclosure

| Level            | What the visitor sees                                          |
| ---------------- | -------------------------------------------------------------- |
| **First screen** | Hero context — where am I, what is this page for               |
| **Primary scan** | Summary widgets — statistics, latest items, stage distribution |
| **Engaged read** | Detail sections, full initiative projection, article body      |
| **Scrutiny**     | Derived labels, trust footnotes, evidence substantiation copy  |
| **Choice**       | Registration Gateway when informed participation is desired    |

## Widget-level disclosure

- **Statistics** show summary first — detail on interaction if architecturally required;
- **Initiative detail** shows stage and headline derived state before full timeline depth;
- **Interactive Map** starts at current scope — deeper geographic drill-down optional;
- **Related Content** appears after primary comprehension — not before;
- **Registration Gateway** appears in secondary zone — not as Hero replacement.

## Cross-page disclosure

Home discloses breadth.

Initiative detail discloses depth.

Knowledge discloses process.

About discloses trust foundations.

Visitors may enter at any page via deep link — each page must orient locally without requiring Home first.

Progressive disclosure aligns with User Journey principles: Discover → Understand → Trust → Register.

---

# Design Principles

These principles govern page architecture — interface visual design implements them later.

## Consistency

One shared page structure, one widget vocabulary, one hierarchy model across World, Country, Region and all destinations.

## Calmness

No urgency framing, no engagement pressure, no visual competition between widgets for attention.

Pages breathe — whitespace and limited primary actions are architectural choices.

## Clarity

One responsibility per widget, one primary purpose per page, civic language over internal names.

Visitors predict content from labels and structure.

## Trust

Derived values labeled, evidence as substantiation, platform boundaries visible, no certification overclaim.

Trust footnotes attach to widgets that present civic state — not buried in footer alone.

## Scalability

New pages compose existing widgets.

New datasets attach to existing widgets.

New scopes filter — they do not fork page architecture.

Future capabilities extend composition — they do not multiply template families.

---

# Final Statement

**Public Experience is composed from reusable experience blocks rather than unique page designs.**

Humanity Union Public Space pages share:

- one structural model;
- one canonical widget set;
- one information hierarchy across responsive form factors;
- one progressive disclosure ethic;
- one trust and calmness discipline.

Home, Country and Region differ in scope — not in architecture.

Initiative, Knowledge, Media, Institutions and About differ in purpose — not in compositional rules.

Implementation, visual design and domain modeling must conform to this page architecture.

No public page may be built as a one-off layout outside this document without Architecture Review and map update.

Widgets compose pages.

Pages serve journeys.

Journeys respect visitors.

This document does not define implementation.

---

# References

| Document               | Path                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Discovery Session 01   | `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md` |
| Public Information Map | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_INFORMATION_MAP.md`             |
| User Journey           | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/USER_JOURNEY.md`                       |

---

# Document Status

**Draft**

Public Page Architecture — Information Space Epic 01

Visual design specifications and implementation guides must align with this document before build begins.
