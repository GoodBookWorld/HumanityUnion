# COUNTRY EXPERIENCE CONTENT ARCHITECTURE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 03 — Country Experience

Version: 1.0

Status: Draft

Document Type: Content Architecture

---

# 1. Purpose

Define the **content architecture** of Country Experience.

This document specifies the **information responsibility** of every Country Experience block while preserving the Humanity Union Public Space architecture.

Country Experience presents **one country's civic reality** through the **same architectural language** as Global Experience.

**Only the geographic scope changes.**

Content architecture governs:

- titles and Context Introductions;
- factual information displayed at country scope;
- visitor questions answered;
- narrative position and neighbour relationships.

It does not govern:

- layout, grid, spacing or responsive composition;
- components, routes, APIs or data stores;
- visual design system tokens.

Reference:

- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/EPIC_02_ARCHITECTURE_FREEZE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`

Epic 02 frozen Global Experience content responsibility at World scope.

This document frozen **content responsibility** per block at **Country scope**.

---

# Content before Layout

**Humanity Union always defines information responsibility before visual composition.**

Country Experience blocks must not receive copy invented to fit a layout.

Layouts must serve predefined content responsibility.

This discipline preserves Explainable Honesty and prevents national promotional drift during implementation.

---

# 2. Canonical Block Sequence

Version 1 **Country Experience** block sequence is frozen for content responsibility.

Global chrome precedes page composition per Epic 01.

## Global chrome (required)

| Block                 | Architectural name   | Content responsibility                               |
| --------------------- | -------------------- | ---------------------------------------------------- |
| Primary navigation    | Header               | Six frozen destinations — unchanged at country scope |
| Scope control         | Geographic Navigator | Country active; World and Region scope entry         |
| Supporting navigation | Footer               | Legal, transparency, secondary platform links        |

## Page composition (frozen order)

| Order | UI name (Country scope)         | Architectural block            | Narrative stage                |
| ----- | ------------------------------- | ------------------------------ | ------------------------------ |
| **1** | Country Identity                | Hero · Geographic Summary      | Identity                       |
| **2** | National Interactive Map        | Interactive Map                | Evidence — geographic          |
| **3** | National Statistics             | Statistics (Country scope)     | Evidence — aggregate           |
| **4** | National Participation Pipeline | Initiative Levels              | Evidence — structure           |
| **5** | Latest National Initiatives     | Latest Initiatives             | Evidence — concrete            |
| **6** | Trusted National Media          | Trusted Media Carousel         | Exploration — supporting       |
| **7** | Regional Exploration            | Exploration (scope transition) | Exploration — geographic depth |
| **8** | Join Humanity Union             | Registration Gateway           | Participation                  |
| **9** | Footer                          | Footer                         | Supporting Navigation          |

## Sequence statement

**This sequence forms the canonical Country Experience content order.**

Block order is narrative order — not optional reordering at implementation.

Optional secondary block **About Preview** from Block Library remains **deferred** — not required in Version 1 Country Experience composition.

## Block responsibility summary

| Block                               | One-sentence responsibility                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| **Country Identity**                | Name the country and orient the visitor within Humanity Union |
| **National Interactive Map**        | Show civic activity geographically within the country         |
| **National Statistics**             | Summarize observable national public participation indicators |
| **National Participation Pipeline** | Show national distribution across pipeline stages             |
| **Latest National Initiatives**     | Present concrete national initiative public examples          |
| **Trusted National Media**          | Surface verified national media supporting context            |
| **Regional Exploration**            | Prepare descent to Region scope within same architecture      |
| **Registration Gateway**            | Offer voluntary registration after national observation       |
| **Footer**                          | Provide supporting navigation and institutional transparency  |

Architectural names govern engineering and reviews.

UI names govern visitor-facing labels where permitted by canonical naming registry.

---

# 3. Country Identity

**Architectural blocks:** Hero · Geographic Summary (page context)

## Purpose

Introduce **the country** as the visitor's current civic location within Humanity Union — one primary national identity message.

Orient the visitor nationally **without separating** the country from the global public square.

## Visitor questions answered

- Where am I?
- Which country’s civic activity am I observing?
- How does this page relate to Humanity Union?

## Contains

| Element                          | Content responsibility                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| **Country name**                 | Primary Identity label — canonical from public-safe geographic metadata                      |
| **National flag**                | Optional Identity visual context — orientation only; policy-governed neutrality              |
| **Country Context Introduction** | One or two calm sentences — why national Evidence below matters within connected civic space |
| **Scope label**                  | Country scope visible — Geographic Navigator alignment                                       |
| **Humanity Union connection**    | Implicit or explicit framing that visitor remains in unified Public Space                    |

## Context Introduction (direction)

_This page shows public civic activity associated with [Country] within Humanity Union. Observation here is part of one connected global civic space._

Tone must match Epic 02 frozen Context Introduction discipline — significance without pressure.

## Information displayed

- country name and Country-scope page identity;
- optional restrained national visual Identity elements;
- Context Introduction — not statistics, initiative lists or registration demands;
- optional calm link to About for platform trust depth — not registration;
- optional Geographic Summary line clarifying national scope meaning.

## Information excluded

- national statistics, pipeline counts, initiative catalogs;
- registration demands or urgency copy;
- political endorsement, ranking or certification language;
- language implying Humanity Union is a federation of separate national platforms.

## Why this position

First narrative stage: **Country exists in Humanity Union.**

Visitor must understand **where they are nationally** before interpreting Evidence below.

## Neighbour relationships

| Neighbour                                 | Relationship                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| **Above (Header / Geographic Navigator)** | Chrome provides destinations and scope; Country Identity provides page meaning |
| **Below (National Interactive Map)**      | Identity names the country; Map shows first geographic Evidence within it      |
| **World scope**                           | Ascent to Global Experience must remain conceptually available                 |

Country Identity provides **orientation** — not **national promotion**.

---

# 4. National Interactive Map

**Architectural block:** Interactive Map (UI: National Interactive Map)

## Purpose

Show that civic activity exists **geographically within the country** and offer **regional exploration entry** — orientation through place inside national boundaries.

## Visitor questions answered

- What is happening geographically inside this country?
- Where is civic activity present at regional level?
- How can I narrow scope further within the same architecture?

## Context Introduction (required)

_Public civic activity on Humanity Union is associated with places within [Country]. The map shows where activity is visible at national scope — select a region to explore activity locally._

Context explains **significance of map Evidence** — never replaces map data.

## Information displayed

- geographic distribution of public civic activity **within country scope**;
- regional boundaries or region entry points supported by public geographic metadata;
- scope indication — Country lens active;
- honest absence where no public activity exists in a region — not hidden defaults;
- no personal data, participant locations or operational internals.

## Information excluded

- aggregate counts duplicating National Statistics primary message in same screen region;
- operational geography or private location data;
- Region pages content — map provides **entry**, not replacement.

## Why this position

Second narrative stage: **National civic activity is locatable.**

Follows Country Identity with **geographic Evidence** inside the country.

## Neighbour relationships

| Neighbour                       | Relationship                                                             |
| ------------------------------- | ------------------------------------------------------------------------ |
| **Above (Country Identity)**    | Identity names country; Map shows observable geographic presence         |
| **Below (National Statistics)** | Map shows _where_; Statistics summarize _how much_ nationally            |
| **Regional Exploration**        | Map assists same scope model as navigator — complementary, not competing |

## Context Before Evidence

**Mandatory:** Title → Context Introduction → map Evidence.

---

# 5. National Statistics

**Architectural block:** Statistics — Country scope (UI: National Statistics)

## Purpose

Summarize **aggregate public civic metrics at country scope** — national scale and presence made legible through honest numbers.

## Visitor questions answered

- How much civic activity exists in this country?
- Is structured participation visibly present nationally?

## Context Introduction

_These figures summarize public civic activity associated with [Country] on Humanity Union. Counts and indicators are computed from public records — derived values are labeled accordingly._

## Information displayed

Examples of approved public indicators at country scope:

| Indicator category                   | Content rule                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Public initiatives**               | Count of initiatives visible at country scope from public projections                                               |
| **Participants**                     | Only public-safe aggregate participant indicators where projection rules explicitly permit — never private identity |
| **Collective activity**              | High-level aggregates from Participation public statistics projection — labeled derived where applicable            |
| **Other approved public indicators** | Additional metrics defined in projection contracts — no ad hoc platform invention                                   |

Also displayed:

- scope label — Country name;
- honest zero or low-activity presentation;
- no ranking of countries, engagement scores or unverifiable totals.

## Information excluded

- initiative titles or narrative — belongs to Latest National Initiatives;
- operational workspace totals;
- comparative nationalism metrics ("most active country").

## Why this position

Third narrative stage begins: **National participation is measurable.**

Follows geographic orientation with **quantitative national summary**.

## Neighbour relationships

| Neighbour                                   | Relationship                                                    |
| ------------------------------------------- | --------------------------------------------------------------- |
| **Above (National Interactive Map)**        | Map orients geographically; Statistics quantify nationally      |
| **Below (National Participation Pipeline)** | Statistics answer _how much_; Pipeline answers _at what stages_ |

## Context Before Evidence

**Mandatory.** Derived values **labeled derived** in Evidence layer.

---

# 6. National Participation Pipeline

**Architectural block:** Initiative Levels (UI: National Participation Pipeline)

## Purpose

Show how civic activity **distributes across Participation pipeline stages** at country scope — pipeline structure visible at a glance.

## Visitor questions answered

- How is participation structured in this country?
- What stages of civic life are publicly visible here?
- What kinds of public activity are underway nationally?

## Context Introduction

_Participation on Humanity Union follows a structured civic path from proposal through collective action. This overview shows how many public initiatives are visible at each stage within [Country]._

## Information displayed

- stage labels using **Capability 02 civic vocabulary** — Initiative, Collaborative Analysis, Collective Decision, Petition, Implementation Commitment, Implementation;
- count or proportion per stage at **country scope** from Participation Pipeline Public Projection;
- optional calm link to Initiatives destination or Knowledge process explanation — not registration;
- Impact stage omitted or marked future if no public data — not fabricated;
- no gamification, league tables or urgency framing.

**Pipeline remains identical to Global Experience.**

Only **filtered public data** changes.

## Information excluded

- full initiative cards — duplicates Latest National Initiatives;
- country-vs-country comparisons;
- registration pressure.

## Why this position

Continues **National participation is measurable** — immediately after National Statistics.

## Neighbour relationships

| Neighbour                               | Relationship                                            |
| --------------------------------------- | ------------------------------------------------------- |
| **Above (National Statistics)**         | Statistics = magnitude; Pipeline = stage distribution   |
| **Below (Latest National Initiatives)** | Pipeline names path; Latest Initiatives shows instances |

## Context Before Evidence

**Mandatory.**

---

# 7. Latest National Initiatives

**Architectural block:** Latest Initiatives (UI: Latest National Initiatives)

## Purpose

Present **concrete public initiative entries** associated with the country — ideas becoming collective action through observable civic paths.

## Visitor questions answered

- What is happening specifically in this country?
- What can I explore further without registering?
- Can I see real national examples?

## Context Introduction

_These are recent public initiatives visible at national scope within [Country]. Each links to a public record of its civic path — you can read details without registering._

## Information displayed

- initiative subject title from Initiative Public Projection;
- current pipeline stage indicator — read-only, civic language;
- scope-relevant summary line — public-safe only;
- **link to Initiative public detail** — `/initiatives/public/:id` pattern;
- recency or curated ordering — transparent if curated;
- honest empty state if no initiatives at country scope.

## Information excluded

- operational fields, participant identity, private internals;
- repetition of National Statistics totals as primary message;
- create or edit actions.

## Why this position

Fourth narrative stage: **National ideas become collective action.**

Abstract metrics become **concrete national stories**.

## Neighbour relationships

| Neighbour                                                 | Relationship                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| **Above (National Participation Pipeline)**               | Pipeline explains stages; Latest Initiatives shows living examples   |
| **Below (Trusted National Media / Regional Exploration)** | Initiatives prove exploration open; supporting blocks extend context |
| **Registration Gateway**                                  | Initiatives precede invitation — narrative distance preserved        |

**Cards link to public initiative pages** — Capability 03 presentation; Capability 02 public projection source.

## Context Before Evidence

**Mandatory.**

---

# 8. Trusted National Media

**Architectural block:** Trusted Media Carousel (UI: Trusted National Media)

## Purpose

Present **verified national media resources** associated with the country — supporting public understanding through documented communication.

## Visitor questions answered

- What verified public communication relates to this country's civic context?
- Where can I find supporting media records?

## Context Introduction

_These media items are verified public communications associated with [Country]. They support understanding — they are not substitutes for participation records below._

## Information displayed

- curated or listed verified media entries from Verified Media capability public associations at country scope;
- title, source institution or publisher where public-safe;
- link to media public detail or external public reference per media policy;
- honest empty state when no verified national media exists.

## Information excluded

- participation aggregates presented as media authority;
- opinion threads or unverified sources;
- content replacing Initiative or pipeline Evidence.

## Why this position

**Exploration stage** — supports understanding after primary Participation Evidence.

Optional block — may be **omitted** when no public-safe media exists. Omission is architectural honesty.

## Content rule

**Media supports understanding.**

**Media does not replace civic evidence.**

Media is **not the narrative** — it **supports** the narrative.

## Neighbour relationships

| Neighbour                               | Relationship                                                                |
| --------------------------------------- | --------------------------------------------------------------------------- |
| **Above (Latest National Initiatives)** | Initiatives remain primary civic Evidence; media contextualizes             |
| **Below (Regional Exploration)**        | Media may reference regional subjects; exploration continues geographically |

## Context Before Evidence

**Mandatory.**

---

# 9. Regional Exploration

**Architectural block:** Exploration — geographic scope transition (UI: Regional Exploration)

## Purpose

Prepare visitors to continue from **Country Experience to Region Experience** — same architecture, finer geographic filter.

## Visitor questions answered

- How do I explore more locally within this country?
- Will Region scope change the platform or only the data?
- How do I return to national or world view?

## Context Introduction

_Regions within [Country] show civic activity at local scope on Humanity Union. The same public architecture applies — only the geographic filter changes._

## Information displayed

- explicit Region scope entry affordances — via Geographic Navigator and National Interactive Map alignment;
- named regions where public activity metadata exists;
- calm explanation that Region Experience inherits **identical block sequence**;
- reversible navigation cues — return to Country and World scope;
- honest messaging when Region Experience route not yet available — future-ready, not dead-end deception.

## Information excluded

- Region page content inlined as duplicate Country Evidence;
- separate navigation model for regions;
- registration pressure tied to regional exploration.

## Why this position

**Exploration stage** before Participation — narrows geographic context while increasing understanding.

Fulfills narrative **Regional Continuation** without forking architecture.

## Content rule

Regions inherit the **same Humanity Union architecture**.

Country Experience **opens** regional depth — it does not **isolate** the nation from local civic observation.

## Neighbour relationships

| Neighbour                    | Relationship                                                          |
| ---------------------------- | --------------------------------------------------------------------- |
| **National Interactive Map** | Shared geographic exploration intent — content responsibilities align |
| **Geographic Navigator**     | Region selection and scope label — chrome-level exploration           |
| **Registration Gateway**     | Exploration precedes invitation                                       |

## Context Before Evidence

**Mandatory** where Evidence layer presents region list or scope transition controls.

---

# 10. Registration Gateway

**Architectural block:** Registration Gateway (UI: Join Humanity Union)

## Purpose

Offer explicit, informed entry to registration **after national observation** — invitation, never requirement for reading.

## Visitor questions answered

- How do I participate if I choose to?
- Must I register to continue exploring this country’s public information?

## Context Introduction

_You can explore public civic activity in [Country] without an account. Registration allows you to take part in structured participation when you are ready._

## Information displayed

- calm invitation — what registration enables in civic terms;
- single primary registration entry action when Identity route exists; honest placeholder when not;
- no urgency, guilt, countdown or limited-access language;
- no restatement of statistics or initiative lists — invitation only;
- optional About link for trust evaluation — placeholder permitted until About ships.

## Information excluded

- national statistics, initiative catalogs, pipeline detail;
- pressure tied to country identity or flag;
- duplicate footer legal conversion.

## Why this position

Fifth narrative stage nationally: **You may participate.**

Last narrative block before Footer.

**Registration remains voluntary.**

**The same architectural principles as Global Experience apply** — narrative distance from Hero preserved.

## Neighbour relationships

| Neighbour                                          | Relationship                                          |
| -------------------------------------------------- | ----------------------------------------------------- |
| **Above (Regional Exploration / Evidence blocks)** | National observation precedes invitation              |
| **Below (Footer)**                                 | Gateway invites; Footer supports — sequential closure |

## Context Before Evidence

**Mandatory** — Context Introduction precedes registration action Evidence.

---

# 11. Footer

**Architectural block:** Footer

## Purpose

Provide **supporting navigation and transparency** — stable closure of Country Experience.

## Visitor questions answered

- Where are legal, accessibility and contact resources?
- How do I reach supporting destinations without using primary header?

## Context Introduction

_Humanity Union publishes legal, accessibility and contact information here. These links support informed use of the platform — they are not required reading to explore civic activity above._

## Information displayed

- legal and privacy links — or honest placeholders;
- accessibility statement entry;
- contact or support entry;
- platform secondary links per Navigation Architecture;
- no primary civic Evidence duplication;
- no second Registration Gateway competing with narrative order.

## Content rule

**Reuse the Humanity Union footer architecture** — identical responsibility at all geographic scopes.

Country scope does not fork footer structure.

Only link **availability** may vary during progressive platform bootstrap — placeholders must be clearly marked.

## Why this position

Persistent global chrome — page closure after narrative completion.

## Neighbour relationships

| Neighbour                        | Relationship                                                    |
| -------------------------------- | --------------------------------------------------------------- |
| **Above (Registration Gateway)** | Sequential closure — not conversion stack                       |
| **Header**                       | Primary discovery vs supporting resources — hierarchy preserved |

## Context Before Evidence

Footer Context Introduction may be brief supporting copy — Evidence layer is link list, not civic aggregates.

---

# 12. Context Before Evidence

Every Country Experience block follows:

```
Heading

↓

Context Introduction

↓

Evidence

↓

Visitor Conclusion
```

| Layer                    | Role                                                                       |
| ------------------------ | -------------------------------------------------------------------------- |
| **Heading**              | Block title — identifies subject at country scope                          |
| **Context Introduction** | Explains why this block's Evidence matters nationally — without persuasion |
| **Evidence**             | Public projection data or public-safe configuration — read-only            |
| **Visitor Conclusion**   | Visitor judges — platform does not conclude for them                       |

**No exceptions.**

Context Introduction:

- explains significance — never persuades;
- never replaces Evidence;
- remains concise;
- matches Epic 02 tone discipline nationally.

Evidence:

- originates from responsible Capabilities through **public projections** filtered to country;
- includes **derived** values labeled derived;
- permits honest empty or sparse national states;
- never fabricates activity to appear nationally vibrant.

Registration Gateway Context Introduction precedes invitation action — not Hero.

---

# 13. Relationship with Global Experience

Country Experience **reuses the Global Experience block architecture**.

| Global Experience (World)   | Country Experience (Country)      |
| --------------------------- | --------------------------------- |
| Civic Introduction / Hero   | Country Identity                  |
| Interactive World Map       | National Interactive Map          |
| Global Statistics           | National Statistics               |
| Participation Pipeline      | National Participation Pipeline   |
| Latest Global Initiatives   | Latest National Initiatives       |
| Trusted Media (optional)    | Trusted National Media (optional) |
| Map / Navigator exploration | Regional Exploration emphasis     |
| Registration Gateway        | Registration Gateway              |
| Footer                      | Footer                            |

**Only public datasets and geographic scope change.**

| Unchanged                         | Changed                        |
| --------------------------------- | ------------------------------ |
| Block sequence and responsibility | Scope parameter — Country      |
| Header six destinations           | Identity and Context copy      |
| Projection boundary               | Filtered projection datasets   |
| Context Before Evidence           | National Context Introductions |
| Registration ethics               | Country name in calm copy      |
| Interaction philosophy            | Region entry within country    |
| Footer architecture               | None                           |

```
Global Experience + country scope → Country Experience
```

Epic 02 implementation is the **reference** for block behavior.

Epic 03 content architecture is the **national adaptation** of that reference.

---

# 14. Future Evolution

Future **Region Experience** and **Local Community Experience** at deeper geographic levels **inherit this same architectural composition**.

```
Country Experience block architecture

+ region or local scope parameter

= Region / Local Experience
```

| Future scope                                                    | Inheritance                                       |
| --------------------------------------------------------------- | ------------------------------------------------- |
| **Region Experience**                                           | Identical block sequence — Region filter and copy |
| **District, Municipality, City, Village, Indigenous Territory** | Same template — scope parameter only              |

**No redesign required** for geographic depth extension.

New blocks require Block Library entry and Architecture Review.

Canonical flow sequence and Context Before Evidence **must be preserved**.

Forbidden:

- RegionPageContentArchitecture as separate standard replacing this document's structure;
- local scope introducing registration pressure patterns absent at World scope;
- geographic content fork breaking Filter Instead of Duplicate.

---

# 15. Final Statement

**Country Experience presents one country's observable civic reality using Humanity Union's unified architectural language.**

Visitors should **immediately recognize the familiar structure** — block order, Context Before Evidence, calm registration ethics, projection-backed Evidence — while **naturally understanding** that information is filtered to **one country's public civic space**.

Country content architecture does not redefine Public Space.

It **focuses** Public Space nationally.

Downstream artifacts — interaction architecture, page specification, architecture review and implementation plan — must conform to this document and frozen Epic 01 and Epic 02 documents.

**This document does not define layout.**

**This document does not define implementation.**

It defines **what Country Experience means** in public language at national scope.

---

# Data and Copy Discipline

| Rule                       | Application                                            |
| -------------------------- | ------------------------------------------------------ |
| Presentation only          | Blocks display; Capabilities own business truth        |
| Derived labeling           | Computed public indicators labeled derived in Evidence |
| No fabrication             | Empty national states honest                           |
| No persuasion              | Context Introductions explain — never sell nationalism |
| Civic vocabulary           | Capability 02 stage names — not product synonyms       |
| Public projection boundary | No operational fields in any block Evidence            |
| Scope labeling             | Country name visible on aggregate Evidence             |

Source mapping: `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md` · `CAPABILITY_02_PROJECTION_INTEGRATION.md`

---

# References

| Document                               | Path                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Discovery Session 01                   | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/DISCOVERY_SESSION_01.md`                  |
| Country Experience Vision              | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_VISION.md`             |
| Country Experience Narrative           | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_NARRATIVE.md`          |
| Epic 02 Architecture Freeze            | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/EPIC_02_ARCHITECTURE_FREEZE.md`            |
| Global Experience Content Architecture | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md` |
| Public Page Template Standard          | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`          |
| Experience Block Library               | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`        |
| Capability 02 Projection Integration   | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/CAPABILITY_02_PROJECTION_INTEGRATION.md`   |

---

# Document Status

**Draft**

Country Experience Content Architecture — Epic 03

Interaction architecture and page specification may proceed after content architecture approval.

Implementation is **not authorized** by this document.
