# REGION EXPERIENCE NARRATIVE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 04 — Region Experience

Version: 1.0

Status: Draft

Document Type: Narrative Architecture

---

# Purpose

Define the **narrative architecture** of Region Experience.

This document explains how visitors **progressively understand one region's civic activity** within Humanity Union Public Space.

Region Experience tells the story of **one region's participation within its country and Humanity Union** — not the story of a region standing apart from either.

Narrative architecture governs **copy direction, emotional progression and block sequencing at region scope**.

It does not govern visual design, component APIs, routing or Capability 02 implementation.

Reference:

- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/EPIC_03_ARCHITECTURE_FREEZE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`

Epic 03 defined the **national civic story** at Country scope.

Epic 04 defines the **regional civic story** — same architectural language, region-filtered meaning, country parent context preserved.

**Narrative supports understanding rather than promotion.**

Implementation must serve the narrative.

Promotional, administrative boosterism or conversion-first copy must not replace it at build time.

---

# 1. Purpose

Region Experience narrates **one region's observable place in its country's and Humanity Union's public civic life**.

The visitor arrives — from Country Experience, Regional Exploration, a shared link, or geographic navigation — seeking **regional civic context** within the same institution they already know at Country and World scope.

The narrative answers:

- this region exists as a **participating place within its country** in Humanity Union;
- civic activity associated with this region is **visible and structured**;
- regional participation can be **understood** through public projections — not asserted through rhetoric;
- exploration may continue **toward communities, nationally, globally, or into initiative detail** — calmly;
- participation remains **voluntary** after observation.

Region Experience tells the story of **one region's civic activity as part of its country and Humanity Union**.

The narrative supports **understanding**.

It never substitutes **promotion**.

It does not tell a tourism story, an administrative prestige story, or a registration funnel story.

It tells a **civic observation story** — localized within national and global context.

---

# 2. Narrative Philosophy

Region Experience should answer the following guiding questions — in order, across the page — without forcing the visitor through a tutorial.

## What characterizes this region?

**Not:** regional exceptionalism, ranking against other regions, or competition with neighbouring places.

**But:** what **public civic activity** is associated with **this named region within this country** within Humanity Union — honestly, including sparse or emerging activity.

Character is **observable civic presence and context** — not administrative boosterism.

## What civic activity is taking place here?

**What structured participation is visible at regional scope?**

Statistics, pipeline distribution, map presence and initiatives show **activity as measurable public records** — derived values labeled, empty states honest.

Activity is **revealed** — not scored or celebrated by the platform.

## How does this region contribute to the country?

**How does structured participation appear as part of national civic life?**

Regional Evidence situates local activity **within the country that contains the region** — not as isolation from national context.

Contribution is **locatable regional participation** — not a league table of regions.

## Which communities are active here?

**Not:** an exhaustive administrator-defined directory.

**But:** which **participant-created communities** have **public civic activity associated with this regional context** — honestly, including sparse association.

Communities are **discovered through participation** — Region narrative **prepares** Community Experience; it does not **replace** Find Your Community.

## How can visitors continue exploring?

**Where does the story continue?**

Communities within regional context, initiative public detail, header destinations, ascent to Country and World scope.

Exploration is **curiosity-driven** — not path completion enforced by the UI.

These questions implement the Five Visitor Questions from `PUBLIC_PAGE_TEMPLATE_STANDARD.md` at **region scope** — with Community preparation as the primary geographic descent narrative.

---

# 3. Narrative Flow

Region Experience follows a **canonical narrative sequence**.

Each step carries **one primary narrative responsibility**.

Steps align with Experience Blocks and page template stages — narrative order must not invert template order.

```
Region Identity

↓

Regional Context

↓

Observable Civic Activity

↓

Participation Pipeline

↓

Regional Initiatives

↓

Community Discovery

↓

Voluntary Participation
```

## Region Identity

**Responsibility:** Name the region as the visitor's current civic location **within its country** within Humanity Union.

**Message:** You are observing **this region** in the public square — not leaving Humanity Union or its parent country.

**Block alignment:** Hero · Geographic Navigator · Identity layer

**One Screen — One Message:** _Where am I within this country in Humanity Union?_

## Regional Context

**Responsibility:** Help the visitor interpret what follows — why regional civic activity matters in this connected public space **within national context**.

**Message:** This region's public participation exists within **this country** and a **shared global civic context**.

**Block alignment:** Context Introduction below Hero and block-level Context Introductions

**One Screen — One Message:** _Why does regional civic information below matter?_

## Observable Civic Activity

**Responsibility:** Present **measurable public activity** at region scope — geography and aggregates before abstraction collapses into slogans.

**Message:** Civic activity here is **real and locatable** — honest at regional scale.

**Block alignment:** Regional Interactive Map · Regional Statistics · Evidence layer opening

**One Screen — One Message:** _What can be observed about civic activity in this region?_

## Participation Pipeline

**Responsibility:** Show **how participation is structured** regionally — stage distribution across the frozen Participation pipeline vocabulary.

**Message:** Regional civic life follows the **same structured path** as national and global civic life — visible at region scope.

**Block alignment:** Initiative Levels · Regional Participation Pipeline block

**One Screen — One Message:** _How is participation structured in this region?_

## Regional Initiatives

**Responsibility:** Connect structure to **concrete civic subjects** — named initiatives on public paths visitors may read without registering.

**Message:** Ideas here become **observable collective action** — instances, not only counts.

**Block alignment:** Latest Initiatives · Exploration entry to public detail

**One Screen — One Message:** _What specific civic activity is happening here?_

## Community Discovery

**Responsibility:** Prepare **deeper local civic context** — participant-named communities within regional association — without implementing Community search or Community blocks on the Region page.

**Message:** Regional understanding can **yield to community context** — same architecture, participant-named local relevance; Region is geographic filter, Community is civic context created through participation.

**Block alignment:** Community Exploration · Interactive Map · Geographic Navigator · Exploration layer

**One Screen — One Message:** _Where can I discover communities active in this regional context?_

**Note:** Find Your Community remains Community Experience primary entry — Region narrative **routes toward** Community; it does not **host** community search.

## Voluntary Participation

**Responsibility:** Offer **informed registration entry** after regional observation — invitation, not requirement.

**Message:** You may participate when ready — **reading never required an account**.

**Block alignment:** Registration Gateway · Participation stage

**One Screen — One Message:** _How may I participate if I choose?_

Optional supporting block **Trusted Regional Media** — if included in later content architecture — may extend Exploration between Regional Initiatives and Community Discovery; omission when no public-safe media exists is honest — not failure. It must not displace Community Discovery narrative position or substitute for Participation Evidence.

---

# 4. Regional Context

Regional Context establishes **orientation** — not regional promotion or administrative advocacy.

## Region name

**Narrative role:** primary Identity label — the region named clearly in Hero and navigator **within named country context**.

**Narrative constraint:** canonical naming from public-safe geographic metadata — consistent across scopes and links; country name visible so region is never floating without national anchor.

## Representative image

**Narrative role:** optional visual anchor in Identity layer — landscape, cityscape or regional landmark signals **which regional scope is active**.

**Narrative constraint:** atmospheric orientation — not tourism marketing, regional campaign imagery or territorial symbolism implying political endorsement by Humanity Union.

## Region Context Introduction

**Narrative role:** one or two calm sentences explaining **why regional Evidence below matters** within this country and Humanity Union.

**Narrative constraint:** significance without persuasion; no urgency; no certification; tone discipline aligned with Epic 02 and Epic 03 Context Introduction standards.

**Example narrative direction (not mandatory copy):**

_This page shows public civic activity associated with [Region] within [Country] in Humanity Union — one regional place in a connected national and global civic space._

**Identity provides orientation rather than regional promotion.**

Identity and Context provide **orientation**.

They do not **replace Evidence**.

They do not **pressure participation**.

They do not **collapse Region into Community**.

Regional context is **welcoming and precise** — not promotional or politically performative.

---

# 5. Observable Civic Activity

Visitors **first observe measurable regional participation** — before interpreting initiatives as stories, discovering communities, or considering registration.

Observable activity is **Evidence** — originating from Capability 02 public projections filtered to region scope.

## Regional statistics

Aggregate indicators at region scope — counts and derived metrics **labeled derived**.

Answers: _How much public civic activity is visible regionally?_

## Participation indicators

Pipeline-related aggregates and geographic presence within the region — structure becoming legible.

Answers: _Is participation structured and present at regional scale?_

## Public trends

Where architecture permits honest temporal presentation — **transparent aggregation only**; no predictive or moral framing.

Humanity Union presents **observable public information**.

Visitors form **their own conclusions**.

| Rule                                       | Application                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| **No imposed conclusions**                 | Platform does not declare regional success, failure or administrative performance |
| **Honest sparsity**                        | Low or zero activity shown truthfully                                             |
| **Derived labeling**                       | Computed values never presented as raw civic truth                                |
| **Verification path**                      | Statistics lead toward initiative detail — not slogans                            |
| **Evidence without directing conclusions** | Platform presents facts — visitor judges independently                            |

Observable Civic Activity implements **Public Space reveals — it does not persuade**.

---

# 6. Participation Narrative

Regional initiatives demonstrate how **civic participation develops within the region** — moving from regional aggregates to **named civic paths**.

## Pipeline remains identical to Country and Global Experience

The Participation pipeline vocabulary is **frozen** — Initiative, Collaborative Analysis, Collective Decision, Petition, Implementation Commitment, Implementation.

Region scope **filters counts and examples** — it does not **rename, reorder or shorten** the civic path for regional marketing.

**The Participation Pipeline remains identical to Country and Global Experience.**

## Regional participation story

```
Structure visible regionally (Pipeline)

↓

Concrete examples visible regionally (Initiatives)

↓

Detail verifiable publicly (Initiative public projection pages)
```

**Regional Participation Pipeline block** answers: _How is participation distributed across stages in this region?_

**Latest Regional Initiatives block** answers: _What living examples exist on that path here?_

Together they narrate: **structured civic life is observable regionally** — not abstract nationally only.

Initiatives demonstrate how **ideas become measurable public action at regional depth** — instances visitors may trace to public detail without registering.

No gamification.

No league tables comparing regions.

No urgency.

No administrative scorekeeping.

---

# 7. Community Discovery

Community Discovery introduces **Community Experience** as the next narrative chapter — without building Community pages inside Region Experience.

## Introduce Community Experience

Community Experience presents **community-scoped public civic activity** — filtered projections associated with **participant-created or participant-named Community records**.

Region narrative explains:

- **Region is geographic/administrative filter** within a country;
- **Community is participant-named civic context** — city, neighbourhood, group, organization or shared purpose per `COMMUNITY_CONTEXT_DECISION.md`;
- **Communities are created through participation** — not exhaustively predefined by platform administration in Version 1.

## Visitors discover participant-created communities through regional context

Region page may surface **communities with public activity associated to this regional context** — contextual links, Community Exploration block, map associations where data exists.

Discovery is **honest** — sparse association shown truthfully; no fabricated community vibrancy.

**Find Your Community** — participant name search — remains **Community Experience block 1**, not Region page primary composition.

Region **prepares** community discovery.

Region **does not answer** _what is happening around this community_ — Community Experience completes that observation.

## Community discovery prepares visitors for more local exploration

```
Regional narrative: "I understand this region's civic activity within this country."

↓

Community narrative: "I can observe participant-named local civic context — same architecture."
```

| Transition             | Narrative meaning                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **Region → Community** | Story narrows from geographic filter to participant-named context — message discipline unchanged |
| **Community → Region** | Visitor restores regional context — no penalty                                                   |
| **Region → Country**   | Visitor restores national context                                                                |
| **Region → World**     | Visitor restores global public square — connected, not escaped                                   |

Community Discovery **opens the door** to local civic context created through participation.

It does not **build a wall** around the region as final civic depth.

---

# 8. Narrative Principles

Region Experience narrative conforms to frozen principles — **no regional exceptions**.

## Observation precedes participation

Regional Evidence, Community Discovery preparation and Exploration precede Registration Gateway.

Reading a region page never requires an account.

## Context Before Evidence

Every narrative step respects **Heading → Context Introduction → Evidence → Visitor Conclusion**.

Regional Context Introduction precedes regional statistics, pipeline and initiatives.

## Every interaction increases understanding

Scope changes, initiative links, Community routing and Country ascent must articulate **what the visitor learned** — per Country and Global Interaction architecture adapted at region scope.

## One Humanity. Many Countries. Many Regions. Many Communities. Shared Future.

Regional story **deepens local understanding** — it never **severs country or global connection**.

Copy and progression preserve **connected civic space** language — region within country within Humanity Union.

## One Screen — One Message

Each major narrative step carries **one primary idea** — implementing **One Experience Block — One Responsibility** at story layer.

## Public Space never persuades. It reveals.

Regional narrative excludes urgency, guilt, regional ranking, administrative boosterism and certification rhetoric.

---

# 9. Success Criteria

Visitors should understand — without registration, without forced linear completion — the following narrative outcomes:

| Outcome                                 | Meaning                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Where they are**                      | Named region within named country within Humanity Union Public Space                                                    |
| **What is happening in this region**    | Observable public civic activity — or honest sparsity                                                                   |
| **How it contributes to the country**   | Structured regional participation visible — locatable within national civic life, not sloganeered                       |
| **Which communities are active**        | Participant-created communities with public association to regional context — honestly presented, not directory fiction |
| **How to continue exploring**           | Community Experience, initiatives, Country, World, header destinations                                                  |
| **How participation remains voluntary** | Registration Gateway as calm choice after observation                                                                   |

## Thirty-second regional orientation

Within approximately thirty seconds, a visitor arriving from Country Experience should state:

**"I am viewing this region's civic activity inside this country inside Humanity Union — and I know how to go broader or deeper toward communities."**

Thirty seconds measures **regional orientation within country** — not community mastery or pipeline expertise.

## Familiarity criterion

A visitor who knows the Country Experience narrative should **recognize the same story shape** — localized further:

| Country stage                           | Region stage                               |
| --------------------------------------- | ------------------------------------------ |
| Country exists in Humanity Union        | Region exists in country in Humanity Union |
| National civic activity is active       | Regional civic activity is active          |
| National participation is measurable    | Regional participation is measurable       |
| National initiatives demonstrate action | Regional initiatives demonstrate action    |
| Regional exploration foreshadows Region | Community discovery foreshadows Community  |
| You may participate                     | You may participate — voluntarily          |

Community Discovery **extends** the Country → Region handoff — it does not **replace** the parallel narrative spine.

---

# 10. Final Statement

**Region Experience presents one region's observable civic reality while preparing visitors to discover communities created through participation.**

The narrative **strengthens local awareness** while **preserving country and global perspective**.

Region Experience is not a regional exit from Humanity Union or from its parent country.

It is the **regional chapter** of one public civic story — told with the same calm, the same honesty and the same architectural sequence Country Experience established at national scope and Global Experience established at World scope.

**The narrative preserves Humanity Union's unified architectural language.**

Downstream artifacts — content architecture, interaction architecture, page template standard, alignment documents and architecture review — must inherit this narrative without inverting order, merging messages or introducing regional promotion pressure.

**This document does not define implementation.**

It defines **what story Region Experience tells** — before copy, layout and engineering serve that story.

One Humanity.

Many Countries.

Many Regions.

Many Communities.

Shared Future.

One narrative — observed globally, understood nationally, explored regionally, completed communally.

---

# References

| Document                      | Path                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Discovery Session 01          | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/DISCOVERY_SESSION_01.md`          |
| Region Experience Vision      | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_VISION.md`      |
| Epic 03 Architecture Freeze   | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/EPIC_03_ARCHITECTURE_FREEZE.md`  |
| Community Context Decision    | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`   |
| Public Page Template Standard | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md` |
| Country Experience Narrative  | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_NARRATIVE.md` |
| Global Experience Narrative   | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_NARRATIVE.md`   |
| Public Space Architecture     | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`     |

---

# Document Status

**Draft**

Region Experience Narrative — Epic 04

Content architecture may proceed after narrative approval.

Implementation is **not authorized** by this document.
