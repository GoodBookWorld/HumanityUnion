# PUBLIC EXPERIENCE BLOCK LIBRARY

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 01 — Information Space

Version: 1.0

Status: Draft

Document Type: Experience Block Catalog

---

# 1. Purpose

**Public Space is assembled from reusable Experience Blocks** — not from unique page designs.

An Experience Block is an architectural unit of public presentation.

It defines:

- what civic information a visitor sees in one bounded surface;
- what responsibility that surface owns;
- where it typically appears in page composition;
- how it behaves across geographic scope;
- where its data originates — and where it does not.

Experience Blocks define **user experience**, not implementation technology.

They are not React components, CSS modules, API endpoints or database tables.

Implementation later maps blocks to interface — blocks do not prescribe framework, routing or persistence.

This document is the **authoritative catalog** of canonical Experience Blocks for Humanity Union Public Space.

Reference:

- `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_INFORMATION_MAP.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/USER_JOURNEY.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_PAGE_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/NAVIGATION_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_PRINCIPLES.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`

Page Architecture defines layouts.

Navigation Architecture defines movement.

This library defines **blocks**.

---

# 2. Design Philosophy

## Reusable Experiences

The same block appears on many pages.

Reuse reduces visitor learning cost and prevents engineering drift.

## One Experience Block — One Responsibility

Each block owns exactly one clear civic presentation responsibility.

Forbidden: orientation + conversion + statistics in one undifferentiated megablock.

## Predictable Placement

Blocks occupy consistent zones — global chrome, page context, primary content, secondary content — across pages and scopes.

Visitors predict where to find scope, navigation and depth.

## Shared Behaviour

The same block behaves identically at World, Country and Region.

Only filtered content changes — not interaction model or hierarchy.

## Filtered Data

Blocks receive scope and dataset inputs.

Geographic depth is a filter parameter — not a block fork.

## No Duplicated Responsibilities

Two blocks must not present the same civic meaning under different names on the same page.

One responsibility — one block instance per page unless architecture explicitly allows repetition (for example Related Content lists).

## Progressive Disclosure

Blocks order from orientation to depth to explicit participation entry.

Summary blocks precede detail blocks.

Registration blocks follow understanding blocks.

## Accessibility Supports Trust

Blocks must remain comprehensible across abilities and devices.

Accessibility is block-level architectural requirement — not post-implementation polish.

Public information withheld from assistive technology is a trust failure.

---

# 3. Canonical Experience Categories

Experience Blocks belong to **categories** by civic role.

Categories organize the library — they are not page types.

## Navigation

**Responsibility:** Movement, orientation within destination hierarchy and scope selection.

Navigation blocks answer: **"Where am I and where can I go?"**

They do not present primary civic content records.

## Identity

**Responsibility:** Platform and page civic framing.

Identity blocks answer: **"What is this place and why am I here?"**

They do not list full initiative catalogs or replace About depth.

## Orientation

**Responsibility:** Geographic and contextual situating of civic activity.

Orientation blocks answer: **"Where in the world does this matter?"**

They do not assign tasks or show operational dashboards.

## Participation

**Responsibility:** Civic activity discovery, pipeline visibility and explicit registration entry.

Participation blocks answer: **"What participation exists and how might I join if ready?"**

They present public projections — not operational workspaces.

## Statistics

**Responsibility:** Aggregate public metrics at current scope.

Statistics blocks answer: **"How much civic activity exists here?"**

They summarize — they do not certify truth or rank people.

## Knowledge

**Responsibility:** Educational and reference entry to platform comprehension.

Knowledge blocks answer: **"How does this work?"**

They explain — they do not replace live participation records.

## Media

**Responsibility:** Public communication artifact discovery.

Media blocks answer: **"What has been communicated publicly?"**

They document — they are not authoritative participation state.

## Institutions

**Responsibility:** Civic actor and organization public presence.

Institutions blocks answer: **"Who is involved?"**

They inform — they do not administer operations.

## Communication

**Responsibility:** Cross-linking, related context and trust copy attachment.

Communication blocks answer: **"What else should I understand nearby?"**

They connect — they do not duplicate primary destination content.

## Platform

**Responsibility:** Platform trust, mission preview and explicit society entry.

Platform blocks answer: **"Why should I trust this platform?"** and **"How do I join if ready?"**

They frame institution — they do not replace full About pages.

---

# 4. Canonical Experience Blocks

Each block is defined by experience architecture only.

Implementation mapping is out of scope.

---

## Navigation Blocks

### Header

| Attribute                 | Definition                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| **Purpose**               | Primary public destination access across all pages                                                |
| **Responsibility**        | Expose Home, Initiatives, Institutions, Media, Knowledge, About — one civic responsibility each   |
| **Typical Placement**     | Global chrome — top of every public page                                                          |
| **Displayed Information** | Primary navigation labels; current destination indication; scope context summary where applicable |
| **Interaction**           | Navigate to primary destinations; never mutate civic state                                        |
| **Future Extension**      | New header items require Architecture Review — not block duplication                              |

### Footer

| Attribute                 | Definition                                                      |
| ------------------------- | --------------------------------------------------------------- |
| **Purpose**               | Supporting navigation and platform obligations                  |
| **Responsibility**        | Legal, accessibility, contact, locale, reserved secondary links |
| **Typical Placement**     | Global chrome — bottom of every public page                     |
| **Displayed Information** | Secondary links; platform obligations; not primary discovery    |
| **Interaction**           | Navigate to supporting destinations                             |
| **Future Extension**      | New secondary destinations prefer footer before header          |

### Breadcrumbs

| Attribute                 | Definition                                                                        |
| ------------------------- | --------------------------------------------------------------------------------- |
| **Purpose**               | Positional hierarchy within a destination                                         |
| **Responsibility**        | Show visitor path within Initiatives, Institutions, Media, Knowledge, About depth |
| **Typical Placement**     | Above primary content on listing and detail pages                                 |
| **Displayed Information** | Destination chain in civic language — not internal module names                   |
| **Interaction**           | Navigate upward in hierarchy                                                      |
| **Future Extension**      | Same block — deeper destination trees only                                        |

### Geographic Navigator

| Attribute                 | Definition                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| **Purpose**               | Scope selection across geographic levels                                                          |
| **Responsibility**        | Filter public datasets by World, Country, Region and future levels — not switch site architecture |
| **Typical Placement**     | Global chrome or Hero-adjacent on Home-class pages                                                |
| **Displayed Information** | Current scope; available scope transitions                                                        |
| **Interaction**           | Change scope filter; preserve destination where meaningful                                        |
| **Future Extension**      | Additional scope levels attach as filter options — same block                                     |

---

## Identity Blocks

### Hero

| Attribute                 | Definition                                                                      |
| ------------------------- | ------------------------------------------------------------------------------- |
| **Purpose**               | Calm page and platform orientation                                              |
| **Responsibility**        | Frame where the visitor is and what this page is for — not marketing conversion |
| **Typical Placement**     | Page context zone — first block below global chrome                             |
| **Displayed Information** | Page title; civic framing copy; scope context on Home-class pages               |
| **Interaction**           | Read; optional single calm secondary link — not registration pressure           |
| **Future Extension**      | Copy variants per destination — same block structure                            |

### Geographic Summary

| Attribute                 | Definition                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------- |
| **Purpose**               | Scope-specific civic context headline                                                   |
| **Responsibility**        | Summarize what geographic scope means on current page — Country, Region or future level |
| **Typical Placement**     | Hero-adjacent or within Hero on Geographic Experience pages                             |
| **Displayed Information** | Scope name; honest scope framing; sparse-data acknowledgment when applicable            |
| **Interaction**           | Read; may link to Geographic Navigator                                                  |
| **Future Extension**      | Supports any future geographic label — same block                                       |

---

## Orientation Blocks

### Interactive Map

| Attribute                 | Definition                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| **Purpose**               | Geographic orientation and scope exploration                                               |
| **Responsibility**        | Show where civic activity relates geographically; support scope drill-down                 |
| **Typical Placement**     | Primary content — Home-class and Geographic Experience pages                               |
| **Displayed Information** | Geographic distribution of civic activity; scope boundaries; entry to filtered views       |
| **Interaction**           | Select geography; change scope filter; navigate to Geographic Experience at selected scope |
| **Future Extension**      | Additional map layers — not alternate map block architectures                              |

**Alias:** Interactive World Map (UI label at World scope) → **Interactive Map** (architectural name)

---

## Participation Blocks

### Initiative Levels

| Attribute                 | Definition                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------- |
| **Purpose**               | Pipeline stage distribution at a glance                                                 |
| **Responsibility**        | Show how civic activity distributes across Participation pipeline stages in public view |
| **Typical Placement**     | Primary content — Home-class pages; Initiatives listing entry                           |
| **Displayed Information** | Stage counts or proportions; civic stage labels from Capability 02                      |
| **Interaction**           | Read; optional filter entry to Initiatives by stage                                     |
| **Future Extension**      | Impact stage visibility when Epic authorized — same block semantics                     |

### Latest Initiatives

| Attribute                 | Definition                                                                |
| ------------------------- | ------------------------------------------------------------------------- |
| **Purpose**               | Recency-ordered civic activity entry                                      |
| **Responsibility**        | Surface initiative summary cards from public projections at current scope |
| **Typical Placement**     | Primary content — Home-class; secondary on Media and Institutions         |
| **Displayed Information** | Initiative title; stage indicator; scope-relevant summary; link to detail |
| **Interaction**           | Navigate to Initiative detail                                             |
| **Future Extension**      | Sort and filter variants — same block                                     |

**Alias:** Latest World Initiatives (UI label) → **Latest Initiatives** (architectural name)

### Related Initiatives

| Attribute                 | Definition                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| **Purpose**               | Contextual civic activity cross-links                                   |
| **Responsibility**        | Connect current page to logically related initiative public projections |
| **Typical Placement**     | Secondary zone — Institution detail, Media detail, Knowledge articles   |
| **Displayed Information** | Compact initiative cards; explicit relationship label                   |
| **Interaction**           | Navigate to Initiative detail                                           |
| **Future Extension**      | Relationship types — same block                                         |

### Registration Gateway

| Attribute                 | Definition                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------- |
| **Purpose**               | Explicit registration entry                                                           |
| **Responsibility**        | Offer informed participation entry — never ambient browse pressure                    |
| **Typical Placement**     | Secondary zone — after orientation and understanding blocks; Initiative detail; About |
| **Displayed Information** | Clear registration invitation; what registration enables; no urgency copy             |
| **Interaction**           | Navigate to registration flow — Capability 01 entry                                   |
| **Future Extension**      | Localized copy — same architectural responsibility                                    |

**Alias:** Join Humanity Union (UI label) → **Registration Gateway** (architectural name)

---

## Statistics Blocks

### Global Statistics

| Attribute                 | Definition                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Purpose**               | Aggregate metrics at World scope                                                                |
| **Responsibility**        | Summarize platform-scale public civic counts and derived indicators suitable for global display |
| **Typical Placement**     | Primary content — Global Experience (World Home)                                                |
| **Displayed Information** | Initiative counts; stage summaries; derived metrics **labeled derived**                         |
| **Interaction**           | Read; optional link to Initiatives or About for context                                         |
| **Future Extension**      | Additional metrics — same block; honest empty states required                                   |

**Alias:** Global Statistics (UI label at World) → **Statistics** block at World scope (architectural pattern)

### Geographic Statistics

| Attribute                 | Definition                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| **Purpose**               | Aggregate metrics at current geographic scope                           |
| **Responsibility**        | Same as Global Statistics — filtered to Country, Region or future scope |
| **Typical Placement**     | Primary content — Geographic Experience pages                           |
| **Displayed Information** | Scope-framed counts and derived indicators **labeled derived**          |
| **Interaction**           | Read                                                                    |
| **Future Extension**      | Any geographic level — filter only                                      |

**Architectural note:** Global Statistics and Geographic Statistics are one **Statistics** block family — scope parameter differs.

---

## Knowledge Blocks

### Knowledge Categories

| Attribute                 | Definition                                                             |
| ------------------------- | ---------------------------------------------------------------------- |
| **Purpose**               | Entry to educational content by topic                                  |
| **Responsibility**        | Organize Humanity Knowledge reference material for browse              |
| **Typical Placement**     | Primary content — Knowledge listing page                               |
| **Displayed Information** | Category titles; brief civic descriptions; article counts where honest |
| **Interaction**           | Navigate to Knowledge articles                                         |
| **Future Extension**      | New categories — same block                                            |

**Alias:** Blog (informal) → **Humanity Knowledge** capability content via Knowledge Categories block

### Related Knowledge

| Attribute                 | Definition                                                                      |
| ------------------------- | ------------------------------------------------------------------------------- |
| **Purpose**               | Contextual educational cross-links                                              |
| **Responsibility**        | Connect current page to explanatory reference without replacing primary content |
| **Typical Placement**     | Secondary zone — Initiative detail, Institution detail, Media detail            |
| **Displayed Information** | Article excerpts; glossary links; process explainers                            |
| **Interaction**           | Navigate to Knowledge destination                                               |
| **Future Extension**      | Topic tags — same block                                                         |

---

## Media Blocks

### Trusted Media Carousel

| Attribute                 | Definition                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Purpose**               | Rotating public communication preview                                                                         |
| **Responsibility**        | Surface platform-governed public media artifacts — **trusted** means governed source, not truth certification |
| **Typical Placement**     | Secondary on Home-class pages; expanded on Media listing                                                      |
| **Displayed Information** | Media title; type; date; source institution where applicable                                                  |
| **Interaction**           | Navigate to Media detail                                                                                      |
| **Future Extension**      | Featured selection rules — same block                                                                         |

### Featured Media

| Attribute                 | Definition                                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| **Purpose**               | Highlighted communication artifact                                         |
| **Responsibility**        | Present one or few editorially selected public media items for orientation |
| **Typical Placement**     | Primary or secondary — Home-class optional; Media listing                  |
| **Displayed Information** | Featured item summary; link to detail                                      |
| **Interaction**           | Navigate to Media detail                                                   |
| **Future Extension**      | Curated sets — same block                                                  |

---

## Institutions Blocks

### Institution Overview

| Attribute                 | Definition                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------- |
| **Purpose**               | Institutional public presence summary                                               |
| **Responsibility**        | Present organization civic role and public profile — not operational administration |
| **Typical Placement**     | Primary — Institutions listing cards; Institution detail header zone                |
| **Displayed Information** | Institution name; role; scope relevance; link to related initiatives                |
| **Interaction**           | Navigate to Institution detail                                                      |
| **Future Extension**      | Relationship types — same block                                                     |

---

## Communication Blocks

### Related Content

| Attribute                 | Definition                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| **Purpose**               | Cross-destination civic context links                                                              |
| **Responsibility**        | Connect logically associated public information across Initiatives, Institutions, Media, Knowledge |
| **Typical Placement**     | Secondary zone — detail pages across destinations                                                  |
| **Displayed Information** | Labeled related links; predictable relationship types                                              |
| **Interaction**           | Navigate across destinations                                                                       |
| **Future Extension**      | New relationship types — same block                                                                |

---

## Platform Blocks

### About Preview

| Attribute                 | Definition                                                             |
| ------------------------- | ---------------------------------------------------------------------- |
| **Purpose**               | Trust foundation entry                                                 |
| **Responsibility**        | Summarize platform mission and honesty boundaries — link to full About |
| **Typical Placement**     | Secondary — Home-class; Initiative detail trust zone                   |
| **Displayed Information** | Mission excerpt; governance entry; what platform does not claim        |
| **Interaction**           | Navigate to About destination                                          |
| **Future Extension**      | Section previews — same block                                          |

### Join Humanity Union

| Attribute                 | Definition                                                                    |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Purpose**               | UI-facing registration entry on Global Experience                             |
| **Responsibility**        | **Identical to Registration Gateway** — explicit informed participation entry |
| **Typical Placement**     | Secondary zone — Global Experience block order after understanding blocks     |
| **Displayed Information** | Society-facing invitation copy; registration meaning                          |
| **Interaction**           | Navigate to registration flow                                                 |
| **Future Extension**      | Copy variants only — architectural name remains Registration Gateway          |

**Architectural rule:** Join Humanity Union is a **display label** for Registration Gateway in Global Experience context — not a separate block responsibility.

---

# 5. Composition Rules

Pages are **compositions of Experience Blocks** on shared layouts.

Layouts define zones.

Blocks fill zones.

Pages do not invent new block types without library extension.

## Composition pattern

```
Global Chrome: Header · Geographic Navigator · Footer
Page Context:   Hero [· Geographic Summary]
Primary:        scope-specific content blocks
Secondary:      Related · Registration Gateway · About Preview · Communication blocks
```

## Example compositions

### Home (Global Experience — World scope)

| Zone          | Blocks                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Global chrome | Header · Geographic Navigator · Footer                                                              |
| Page context  | Hero                                                                                                |
| Primary       | Interactive Map · Global Statistics · Initiative Levels · Latest Initiatives                        |
| Secondary     | Trusted Media Carousel · Registration Gateway (Join Humanity Union label permitted) · About Preview |

**Alias:** Home at World scope → **Global Experience**

### Country

| Zone          | Blocks                                                                           |
| ------------- | -------------------------------------------------------------------------------- |
| Global chrome | Header · Geographic Navigator · Footer                                           |
| Page context  | Hero · Geographic Summary                                                        |
| Primary       | Interactive Map · Geographic Statistics · Initiative Levels · Latest Initiatives |
| Secondary     | Trusted Media Carousel · Registration Gateway · About Preview                    |

**Identical composition to Region** — Country scope filter and copy framing differ only.

### Region

Same block composition as Country.

Region scope filter and Geographic Summary copy differ only.

**Architectural name:** Country Page and Region Page → **Geographic Experience**

### Knowledge

| Zone          | Blocks                                 |
| ------------- | -------------------------------------- |
| Global chrome | Header · Geographic Navigator · Footer |
| Page context  | Hero                                   |
| Primary       | Knowledge Categories                   |
| Secondary     | Related Knowledge · Related Content    |

### Media

| Zone          | Blocks                                                 |
| ------------- | ------------------------------------------------------ |
| Global chrome | Header · Geographic Navigator · Footer                 |
| Page context  | Hero                                                   |
| Primary       | Featured Media · Trusted Media Carousel (listing mode) |
| Secondary     | Latest Initiatives · Related Content                   |

### Initiative

| Zone          | Blocks                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Global chrome | Header · Geographic Navigator · Footer                                                              |
| Page context  | Hero · Breadcrumbs                                                                                  |
| Primary       | Participation pipeline public projection sections · derived indicators · evidence summaries         |
| Secondary     | Related Content · Related Knowledge · Trusted Media Carousel · Registration Gateway · About Preview |

### About

| Zone          | Blocks                                                                             |
| ------------- | ---------------------------------------------------------------------------------- |
| Global chrome | Header · Geographic Navigator · Footer                                             |
| Page context  | Hero · Breadcrumbs                                                                 |
| Primary       | Platform narrative sections · Global Statistics or scope statistics where relevant |
| Secondary     | Registration Gateway · Related Knowledge                                           |

### Institutions

| Zone          | Blocks                                                     |
| ------------- | ---------------------------------------------------------- |
| Global chrome | Header · Geographic Navigator · Footer                     |
| Page context  | Hero · Breadcrumbs                                         |
| Primary       | Institution Overview (listing or detail)                   |
| Secondary     | Related Initiatives · Related Content · Latest Initiatives |

## Country and Region rule

Country and Region reuse **identical block composition**.

Only these vary:

- scope filter parameter;
- Geographic Summary copy;
- Statistics dataset scope;
- Latest Initiatives filtered rows.

Forbidden: CountryPageBlockSet vs RegionPageBlockSet as separate libraries.

---

# 6. Geographic Adaptation

Experience Blocks adapt geographically through **filtering** — not through block duplication.

## Current scope levels

| Level       | Filter behavior                           |
| ----------- | ----------------------------------------- |
| **World**   | Unscoped or globally aggregated datasets  |
| **Country** | National filter on all scope-aware blocks |
| **Region**  | Regional filter on all scope-aware blocks |

## Future scope levels

Architecture never depends on a fixed number of geographic levels.

Future levels may include:

- District
- Municipality
- City
- Village
- Neighbourhood
- Indigenous Territory
- Other local administrative or community structures

Future levels attach as **additional scope filter values** on:

- Geographic Navigator
- Geographic Summary
- Interactive Map
- Statistics block family
- Latest Initiatives
- Institution Overview
- scope-aware Media and Knowledge where applicable

## Adaptation rule

```
Experience Block + scope parameter → filtered presentation
```

Same block.

Same placement.

Same behaviour.

Different rows.

Forbidden: `LatestInitiativesRegionBlock` as separate architectural entity.

---

# 7. Canonical Naming Registry

Use **Architectural Name** in governance, reviews and implementation planning.

Use **User Interface Name** in visitor-facing copy where clarity benefits society.

| User Interface Name      | Architectural Name         | Notes                                                    |
| ------------------------ | -------------------------- | -------------------------------------------------------- |
| Home                     | Global Experience          | World-scoped Home-class composition                      |
| Country Page             | Geographic Experience      | Home-class · Country scope                               |
| Region Page              | Geographic Experience      | Home-class · Region scope                                |
| Blog                     | Humanity Knowledge         | Knowledge capability content — not a separate block type |
| Join Humanity Union      | Registration Gateway       | Display label only                                       |
| Interactive World Map    | Interactive Map            | World-scope UI label                                     |
| Latest World Initiatives | Latest Initiatives         | World-scope UI label                                     |
| Global Statistics        | Statistics (World scope)   | Statistics block family                                  |
| Country Statistics       | Statistics (Country scope) | Geographic Statistics pattern                            |
| Region Statistics        | Statistics (Region scope)  | Geographic Statistics pattern                            |
| Trusted Media            | Trusted Media Carousel     | Governed source — not truth claim                        |
| Featured Story           | Featured Media             |                                                          |
| Related Articles         | Related Knowledge          |                                                          |
| Platform Intro           | About Preview              |                                                          |
| Sign Up                  | Registration Gateway       | Forbidden urgency label — use calm registration copy     |
| Main Menu                | Header                     |                                                          |
| Site Footer              | Footer                     |                                                          |
| You Are Here             | Breadcrumbs                |                                                          |
| Change Location          | Geographic Navigator       |                                                          |
| Civic Activity Map       | Interactive Map            |                                                          |
| Pipeline Overview        | Initiative Levels          |                                                          |
| Recent Activity          | Latest Initiatives         |                                                          |

**Governance rule:** New UI names require registry entry before use in architecture or copy freeze.

Synonym drift without registry entry is an architecture defect.

---

# 8. Data Responsibility

Experience Blocks own **presentation only**.

Business data always originates from the **responsible Capability**.

Blocks never own business logic, aggregate mutation or derivation authority.

| Experience Block              | Data source                                          | Capability / domain                                |
| ----------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Latest Initiatives            | Public initiative projections                        | Capability 02 — Participation                      |
| Related Initiatives           | Public initiative projections + relationship context | Capability 02 — Participation                      |
| Initiative Levels             | Aggregated public projection stage counts            | Capability 02 — Participation                      |
| Initiative detail sections    | Public Participation projections                     | Capability 02 — Participation                      |
| Global Statistics             | Aggregated public projection metrics                 | Capability 02 — Participation (public projections) |
| Geographic Statistics         | Scope-filtered public projection metrics             | Capability 02 — Participation (public projections) |
| Interactive Map               | Geographic activity distribution from public data    | Capability 02 + geographic model                   |
| Registration Gateway          | Registration entry metadata                          | Capability 01 — Identity / Registration            |
| Join Humanity Union           | Same as Registration Gateway                         | Capability 01 — Identity / Registration            |
| Knowledge Categories          | Reference catalog                                    | Humanity Knowledge capability (future)             |
| Related Knowledge             | Reference articles                                   | Humanity Knowledge capability (future)             |
| Trusted Media Carousel        | Verified public media artifacts                      | Verified Media capability (future)                 |
| Featured Media                | Selected public media artifacts                      | Verified Media capability (future)                 |
| Institution Overview          | Institutional public profiles                        | Institutions capability (future)                   |
| About Preview / About content | Platform governance copy                             | Platform / Capability 03                           |
| Hero / Geographic Summary     | Page framing copy + scope context                    | Capability 03 presentation layer                   |
| Header / Footer / Breadcrumbs | Navigation structure                                 | Capability 03 — Public Experience                  |
| Geographic Navigator          | Scope model                                          | Capability 03 — Public Experience                  |
| Related Content               | Cross-capability link resolution                     | Capability 03 presentation orchestration           |

## Presentation orchestration rule

Capability 03 may **orchestrate, filter and sanitize** presentation of upstream public data.

It must not:

- redefine Participation aggregate meaning;
- recompute derived civic state as authority;
- expose operational fields blocked by public projection rules;
- substitute presentation orchestration for missing upstream capability data.

When upstream capability is future — blocks appear with honest empty or preview states — not fabricated business data.

---

# 9. Relationship with Public Experience Flow

Two complementary flow models exist **intentionally**.

They describe different architectural layers — not conflicting requirements.

## Information Architecture Flow

Governance and block composition sequencing:

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

**Used for:** block ordering on pages, architecture reviews, Epic governance, consolidated architecture (`PUBLIC_SPACE_ARCHITECTURE.md`).

| Stage         | Block examples                                                                         |
| ------------- | -------------------------------------------------------------------------------------- |
| Identity      | Hero                                                                                   |
| Orientation   | Geographic Navigator · Interactive Map · Geographic Summary                            |
| Understanding | Statistics · Initiative Levels · Latest Initiatives · Knowledge · Media · Institutions |
| Evaluation    | About Preview · derived labels · trust footnotes · About destination                   |
| Participation | Registration Gateway                                                                   |

## Visitor Journey Flow

Visitor experience and copy analytics labeling:

```
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

**Used for:** user journey docs, persona paths, analytics event naming, copy governance (`USER_JOURNEY.md`).

| Stage       | Mapping to Information Architecture Flow           |
| ----------- | -------------------------------------------------- |
| Discover    | Orientation (+ entry Identity)                     |
| Understand  | Understanding                                      |
| Trust       | Evaluation                                         |
| Register    | Participation (threshold)                          |
| Participate | Operational Workspace — beyond Public Space blocks |

## Harmonization rule

Both models remain valid.

Neither supersedes the other.

Implementation and reviews use **Information Architecture Flow** for block placement.

Visitor-facing documentation and analytics use **Visitor Journey Flow**.

The mapping table above is **binding** for Epic 01 onward.

---

# 10. Future Evolution

New Experience Blocks may be introduced **without redesign** of existing pages or blocks.

## Extension rules

| Action                      | Permitted pattern                                             |
| --------------------------- | ------------------------------------------------------------- |
| Add block                   | Extend library; compose into existing layouts                 |
| Extend block data           | New fields from new capability public projections             |
| Add scope level             | Extend Geographic Navigator filter — same blocks              |
| Add destination page        | Compose from existing blocks                                  |
| Change block responsibility | Architecture Review required — not implementation convenience |

## Stability rule

Existing blocks should remain **stable**.

Breaking responsibility changes require library version increment and Architecture Review.

## Capability growth

Future capabilities extend the library:

- Impact summary block (future Participation stage)
- Public observatory metrics block
- Events preview block
- Institutional relationship block

They compose into existing destinations — preferably before new header items.

Future capabilities **extend the library** — they do not replace it.

---

# 11. Final Statement

**Experience Blocks form the reusable vocabulary of Humanity Union Public Space.**

Public Space grows by **composing trusted experiences** — not by creating isolated pages.

Every public page is a composition.

Every composition uses this library.

Every block owns one responsibility.

Every dataset belongs to its Capability.

Geographic depth is filtering — not forking.

Two flow models serve two layers — harmonized, not competing.

**This document is the authoritative reference for all Public Experience blocks.**

Page Architecture defines layouts.

Navigation Architecture defines movement.

Public Space Architecture defines the whole.

This library defines the blocks between them.

Implementation follows this catalog.

Architecture never follows ad hoc page invention.

This document does not define implementation.

---

# Document Status

**Draft**

Public Experience Block Library — Epic 01 Information Space

Closes architecture review remediation item: missing block catalog.

Downstream freeze and Epic 02 Global Experience specifications must align with this library before implementation proceeds.
