# PUBLIC PAGE TEMPLATE STANDARD

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 02 — Global Experience

Version: 1.0

Status: Draft

Document Type: Page Template Standard

---

# 1. Purpose

Define the **canonical architectural template** used by every Public Experience page within Humanity Union.

All public pages — Global Experience, Geographic Experience, Initiative detail, Knowledge, Media, Institutions, About — follow **one reusable page standard**.

This standard is **architectural composition** — not visual design, not CSS, not frontend components.

It establishes:

- the sequence in which civic meaning unfolds on every page;
- the questions every page must answer;
- how Experience Blocks compose within that sequence;
- how geographic scope adapts without forking architecture.

Consistency helps visitors **immediately understand where they are** and **how to continue exploring** — at World scope or any future geographic level.

Reference:

- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md`

Epic 01 frozen block catalog and page types.

This document frozen **page-level composition language** for all Public Experience pages.

Global Experience is the **first full expression** of this standard at World scope.

---

# 2. Architectural Philosophy

**Public pages communicate understanding before participation.**

Every page follows the **same architectural language** while presenting **different information**.

| Principle                              | Meaning                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------- |
| **Structure serves understanding**     | Sequence and block responsibility clarify civic meaning before action     |
| **Consistency builds trust**           | Predictable page anatomy reduces cognitive load and supports verification |
| **Observation precedes participation** | Evidence and exploration precede Registration Gateway on every page type  |
| **One template — many datasets**       | Geography and destination vary content — not architecture                 |

Public pages reveal civic reality.

They do not sell platform mythology.

Layout implementation serves this philosophy — it does not replace it.

---

# 3. Canonical Public Page Flow

Every public page follows this **canonical sequence**.

Not every page includes every stage visibly — but **no stage may appear out of order** when present.

```
Identity

↓

Context Introduction

↓

Evidence

↓

Exploration

↓

Participation

↓

Supporting Navigation
```

## Identity

**Responsibility:** Introduce the current civic space — where the visitor is in Humanity Union public environment.

Identity names the place without promoting it.

Examples: Humanity Union (World), a Country, a Region, an Initiative, Knowledge, Media, an Institution, About.

Typically delivered by **Hero** and global chrome context.

## Context Introduction

**Responsibility:** Help visitors correctly interpret information that follows.

Explains significance — never persuades, never replaces evidence, remains concise.

Precedes every Evidence block per **Context Before Evidence**.

## Evidence

**Responsibility:** Present observable civic reality from responsible Capabilities.

Maps, statistics, initiatives, knowledge, media, institutional information — factual public presentation.

Humanity Union presents evidence; visitors form conclusions.

## Exploration

**Responsibility:** Help visitors continue learning naturally without navigation overload.

Related Initiatives, countries, regions, knowledge, media, institutions — cross-links that extend understanding.

Exploration is optional depth — not mandatory path completion.

## Participation

**Responsibility:** Offer participation only after sufficient page context.

Registration Gateway — optional, calm, after observation on pages where participation entry is appropriate.

Participation never precedes Evidence on landing experience.

## Supporting Navigation

**Responsibility:** Platform orientation, legal obligations, transparency resources — without distracting from primary civic content.

Footer, related platform links, accessibility and legal entry.

Persistent closure — not primary discovery competition.

## Mapping to Information Architecture Flow

| Page flow stage       | Information Architecture Flow                  |
| --------------------- | ---------------------------------------------- |
| Identity              | Identity                                       |
| Context Introduction  | Orientation (page-level) + block-level context |
| Evidence              | Understanding · Evaluation                     |
| Exploration           | Understanding · Evaluation                     |
| Participation         | Participation                                  |
| Supporting Navigation | Supporting chrome                              |

---

# 4. The Five Visitor Questions

Every public page should naturally answer:

| #     | Question                      | Architectural responsibility                                         |
| ----- | ----------------------------- | -------------------------------------------------------------------- |
| **1** | **Where am I?**               | Identity — Hero, breadcrumbs, scope context, header destination      |
| **2** | **Why does this matter?**     | Context Introduction — page and block level                          |
| **3** | **What is happening here?**   | Evidence — primary content blocks                                    |
| **4** | **Where can I explore next?** | Exploration — Related Content, map, header, Related blocks           |
| **5** | **How can I participate?**    | Participation — Registration Gateway where appropriate; never forced |

These questions define **architectural responsibility of every page** — not copy checklist alone.

A page may emphasize different questions by type:

- **Home / Global Experience** — balances all five with Evidence weight;
- **Initiative detail** — emphasizes Question 3 and 4;
- **About** — emphasizes Questions 2 and trust evaluation;
- **Knowledge article** — emphasizes Questions 2 and 3 with lighter Participation.

All five must remain **answerable** without registration on public reading paths.

---

# 5. Identity

## Purpose

Introduce the **current civic space** — the visitor's location in Humanity Union Public Space.

Identity identifies the place **without promoting it**.

## Identity examples by page type

| Page type                           | Identity subject                                   |
| ----------------------------------- | -------------------------------------------------- |
| **Global Experience**               | Humanity Union — World public square               |
| **Geographic Experience (Country)** | Named country — civic activity at national scope   |
| **Geographic Experience (Region)**  | Named region — civic activity at local scope       |
| **Initiative**                      | Initiative subject — public projection context     |
| **Knowledge**                       | Topic or article — educational reference space     |
| **Media**                           | Media item or listing — public communication space |
| **Institution**                     | Institution name — civic actor public profile      |
| **About**                           | Humanity Union — platform identity and governance  |

## Architectural rules

- one primary identity message per page Hero;
- identity copy excludes statistics, initiative catalogs and registration demands;
- scope label visible where geographic Identity applies;
- internal capability names forbidden in Identity layer.

**Primary block:** Hero · **Supporting:** Header destination indication · Breadcrumbs on depth pages

---

# 6. Context Introduction

## Purpose

Help visitors **correctly interpret** the information that follows.

## Architectural rules

Context Introduction:

- **explains significance** — why the next evidence matters;
- **never persuades** — no urgency, guilt or conversion framing;
- **never replaces evidence** — context is not a substitute for data;
- **remains concise** — one or two short sentences below block or page title.

**Context precedes evidence.**

Every Experience Block with Evidence layer includes Context Introduction per `GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md`.

Page-level Context Introduction may appear in Hero subordinate copy — distinct from block-level Context Introductions below.

---

# 7. Evidence

## Purpose

Present **observable civic reality** — public information from responsible Capabilities.

## Evidence types

Evidence may include — by page type and block:

| Evidence type                 | Typical blocks                                 | Source                                  |
| ----------------------------- | ---------------------------------------------- | --------------------------------------- |
| **Maps**                      | Interactive Map                                | Geographic public activity distribution |
| **Statistics**                | Statistics block family                        | Aggregated public projections           |
| **Initiatives**               | Latest Initiatives, initiative detail sections | Capability 02 public projections        |
| **Knowledge**                 | Article body, Knowledge Categories             | Humanity Knowledge capability           |
| **Media**                     | Featured Media, Trusted Media Carousel         | Verified Media capability               |
| **Institutional information** | Institution Overview                           | Institutions capability                 |

## Architectural rules

- derived values **labeled derived**;
- honest empty and sparse states;
- no operational aggregate serialization;
- no participant identity by default;
- evidence supports **independent judgment** — Humanity Union presents evidence rather than conclusions.

Evidence layer is the **primary content zone** of every page.

---

# 8. Exploration

## Purpose

Help visitors **continue learning naturally** — extend understanding without increasing complexity.

## Exploration examples

| Exploration link type | Architectural block                                      |
| --------------------- | -------------------------------------------------------- |
| Related Initiatives   | Related Initiatives · Related Content                    |
| Related Countries     | Interactive Map · Geographic Navigator · Related Content |
| Related Regions       | Interactive Map · Geographic Navigator · Related Content |
| Related Knowledge     | Related Knowledge · Related Content                      |
| Related Media         | Related Content · Trusted Media Carousel                 |
| Related Institutions  | Related Content · Institution Overview links             |
| Primary destinations  | Header navigation                                        |

## Architectural rules

- exploration follows primary Evidence — not before Identity;
- cross-links use **civic relationship labels** — not engagement bait;
- exploration must not duplicate primary page Evidence as Related Content under alternate names;
- three-step navigation rule from Navigation Architecture preserved.

Exploration extends understanding **rather than increasing complexity**.

---

# 9. Participation

## Purpose

Offer participation **only after understanding** on pages where registration entry is appropriate.

## Architectural rules

- **Participation is always optional** on public pages;
- **Registration follows observation** — Registration Gateway in Participation stage, not Identity;
- **Invitation replaces pressure** — calm copy; Join Humanity Union label permitted;
- public reading never gated behind Registration Gateway;
- Initiative detail may include Registration Gateway in Participation stage after initiative Evidence.

**Primary block:** Registration Gateway

Not all page types require visible Registration Gateway — Knowledge listing may omit; About may include; Global Experience includes after Evidence and Exploration weight.

Omission is architectural choice — not absence of Participation stage on platform.

---

# 10. Supporting Navigation

## Purpose

Provide orientation and platform obligations **without distracting** from primary civic experience.

## Supporting Navigation includes

| Element                    | Responsibility                                                 |
| -------------------------- | -------------------------------------------------------------- |
| **Footer**                 | Legal, accessibility, contact, secondary links                 |
| **Related links**          | Platform and destination cross-reference where footer-adjacent |
| **Legal information**      | Privacy, terms                                                 |
| **Transparency resources** | Accessibility, governance entry                                |
| **Platform navigation**    | Footer secondary — not header duplication                      |

Supporting Navigation is **persistent global chrome** — Footer on every page.

Breadcrumbs are positional Supporting Navigation within destination depth — not primary discovery.

Supporting Navigation closes the page — it does not reopen primary Evidence narrative.

---

# 11. Geographic Adaptation

The **same architectural template** applies at all geographic scopes.

## Current scopes

- **World**
- **Country**
- **Region**

## Future scopes

Architecture remains identical — only filtered datasets change.

Future geographic levels may include:

- District
- Municipality
- City
- Village
- Neighbourhood
- Indigenous Territory
- Additional administrative or community structures

## Adaptation rule

```
Public Page Template + scope parameter → filtered Evidence and Exploration datasets
```

Forbidden:

- CountryPageTemplate vs RegionPageTemplate as separate architectural standards;
- geographic scope changing canonical flow sequence;
- scope-specific Participation pressure patterns.

**Global Experience** = template at World scope.

**Geographic Experience** = same template at Country or Region scope.

Identity and Evidence content filter — template does not.

---

# 12. Experience Block Composition

Each page composes from reusable **Experience Blocks** defined in `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`.

## Block internal sequence

Every block with civic Evidence follows:

```
Heading

↓

Context Introduction

↓

Evidence
```

| Layer                    | Block responsibility              |
| ------------------------ | --------------------------------- |
| **Heading**              | Block title — identifies subject  |
| **Context Introduction** | Why this block's evidence matters |
| **Evidence**             | Observable public information     |

## Page composition

Pages arrange blocks across canonical page flow stages:

```
Identity blocks (Hero)
  → Evidence blocks (Statistics, Map, Initiative Levels, Latest Initiatives, detail sections…)
    → Exploration blocks (Related Content, Related Initiatives…)
      → Participation block (Registration Gateway)
        → Supporting Navigation (Footer)
```

**Every block owns one responsibility.**

Megablocks merging Identity, Evidence and Participation violate template standard.

## Global Experience reference composition

| Page flow stage       | Blocks                                                                |
| --------------------- | --------------------------------------------------------------------- |
| Identity              | Hero                                                                  |
| Evidence              | Interactive Map · Statistics · Initiative Levels · Latest Initiatives |
| Participation         | Registration Gateway                                                  |
| Supporting Navigation | Footer                                                                |

Detailed content responsibility: `GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md`.

Other page types substitute Evidence blocks — template unchanged.

---

# 13. Relationship with Public Experience Principles

This standard **implements** frozen Epic 01 principles:

| Principle                                            | Template implementation                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| **Public Space is the window into a living society** | Evidence stage presents observable civic activity                   |
| **Observation precedes participation**               | Participation stage follows Evidence and Exploration                |
| **Public Space never persuades. It reveals.**        | Context Introduction and Evidence without conversion copy           |
| **Trust Through Verification**                       | Evidence traceable; Exploration links to detail and About           |
| **Explainable Honesty**                              | Derived labeling; no conclusion substitution                        |
| **Context Before Evidence**                          | Mandatory block and page sequence                                   |
| **One Experience Block — One Responsibility**        | Block composition rules Section 12                                  |
| **Navigation serves intentions**                     | Exploration and Supporting Navigation — not implementation exposure |

Template standard is **practical enforcement** of principles at page level.

Principles govern — template composes.

---

# 14. Future Evolution

Future capabilities **extend this template without replacing it**.

## Permitted extension

- new Experience Blocks slotted into Evidence or Exploration stages;
- additional Evidence types from new capabilities;
- new Exploration relationship types;
- additional geographic scope parameters;
- optional blocks in Exploration stage per page type.

## Extension rules

- canonical flow sequence **Identity → Context Introduction → Evidence → Exploration → Participation → Supporting Navigation** preserved;
- Five Visitor Questions remain answerable;
- Context Before Evidence preserved in every new block;
- new blocks require Block Library entry and Architecture Review;
- no new page template family without freeze version increment.

Additional blocks may be introduced **only when they preserve the canonical visitor flow**.

Future page types — search results, observatory — compose existing stages — not invent parallel templates.

---

# 15. Final Statement

**Every Humanity Union Public Experience page speaks the same architectural language.**

Visitors should always know:

- **where they are** — Identity;
- **why it matters** — Context Introduction;
- **what is happening** — Evidence;
- **where they can continue** — Exploration;
- **how they may participate** — Participation, optionally and calmly.

**The architecture remains stable while the information evolves.**

Geography filters datasets.

Destinations vary Evidence blocks.

Principles govern tone and honesty.

Template governs sequence.

Global Experience is the first complete instance.

Country, Region, Initiative, Knowledge, Media, Institutions and About are variations on one standard — not separate public products.

This document does not describe layout implementation.

This document does not describe CSS or components.

It defines **architectural composition** for all Public Experience pages.

Implementation follows this standard.

The standard does not follow implementation convenience.

---

# References

| Document                               | Path                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Epic 01 Architecture Freeze            | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`            |
| Public Space Architecture              | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`              |
| Experience Block Library               | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`        |
| Global Experience Vision               | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`               |
| Global Experience Narrative            | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_NARRATIVE.md`            |
| Global Experience Content Architecture | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md` |
| Public Page Architecture               | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_PAGE_ARCHITECTURE.md`               |

---

# Document Status

**Draft**

Public Page Template Standard — Epic 02 Global Experience

Applies platform-wide to all Public Experience pages.

Layout specifications and implementation must conform before build proceeds.
