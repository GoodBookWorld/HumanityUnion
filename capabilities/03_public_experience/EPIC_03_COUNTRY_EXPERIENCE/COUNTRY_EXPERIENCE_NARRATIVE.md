# COUNTRY EXPERIENCE NARRATIVE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 03 — Country Experience

Version: 1.0

Status: Draft

Document Type: Narrative Architecture

---

# Purpose

Define the **narrative architecture** of Country Experience.

This document explains how visitors **gradually understand one country's civic activity** within Humanity Union Public Space.

Country Experience tells the story of **one country's participation in Humanity Union** — not the story of a nation standing apart from it.

Narrative architecture governs **copy direction, emotional progression and block sequencing at country scope**.

It does not govern visual design, component APIs, routing or Capability 02 implementation.

Reference:

- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/EPIC_02_ARCHITECTURE_FREEZE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`

Epic 02 defined the **global civic story** at World scope.

Epic 03 defines the **national civic story** — same architectural language, country-filtered meaning.

**Narrative supports understanding rather than promotion.**

Implementation must serve the narrative.

Promotional, nationalist or conversion-first copy must not replace it at build time.

---

# 1. Purpose

Country Experience narrates **one country's observable place in Humanity Union's public civic life**.

The visitor arrives — from Global Experience, a shared link, or geographic navigation — seeking **national civic context** within the same institution they already know at World scope.

The narrative answers:

- this country exists as a **participating place** in Humanity Union;
- civic activity associated with this country is **visible and structured**;
- national participation can be **understood** through public projections — not asserted through rhetoric;
- exploration may continue **regionally, globally, or into initiative detail** — calmly;
- participation remains **voluntary** after observation.

Country Experience does not tell a tourism story, a political story, or a registration funnel story.

It tells a **civic observation story** — localized.

Narrative supports **understanding**.

It never substitutes **promotion**.

---

# 2. Narrative Philosophy

Country Experience should answer four guiding questions — in order, across the page — without forcing the visitor through a tutorial.

## What makes this country unique?

**Not:** exceptionalism, ranking, or competition with other countries.

**But:** what **public civic activity** is associated with **this named place** within Humanity Union — honestly, including sparse or emerging activity.

Uniqueness is **observable civic presence and context** — not nationalist claim.

## How does it contribute?

**How does structured participation appear at national scope?**

Statistics, pipeline distribution and initiatives show **contribution as measurable public activity** — derived values labeled, empty states honest.

Contribution is **revealed** — not scored or celebrated by the platform.

## How does it connect to Humanity Union?

**How does this national view remain part of one global public square?**

Context Introduction, World ascent, unified chrome and connected civic space language preserve **global coherence**.

The country is a **lens** — not a separate platform.

## How can visitors explore further?

**Where does the story continue?**

Regions within the country, initiative public detail, header destinations, related public records, return to World scope.

Exploration is **curiosity-driven** — not path completion enforced by the UI.

These questions implement the Five Visitor Questions from `PUBLIC_PAGE_TEMPLATE_STANDARD.md` at **country scope**.

---

# 3. Narrative Flow

Country Experience follows a **canonical narrative sequence**.

Each step carries **one primary narrative responsibility**.

Steps align with Experience Blocks and page template stages — narrative order must not invert template order.

```
Country Identity

↓

National Context

↓

Observable Civic Activity

↓

Participation Pipeline

↓

National Initiatives

↓

Trusted National Media

↓

Regional Exploration

↓

Voluntary Participation
```

## Country Identity

**Responsibility:** Name the country as the visitor's current civic location within Humanity Union.

**Message:** You are observing **this country** in the public square — not leaving Humanity Union.

**Block alignment:** Hero · Geographic Navigator · Identity layer

**One Screen — One Message:** _Where am I in Humanity Union?_

## National Context

**Responsibility:** Help the visitor interpret what follows — why national civic activity matters in this connected public space.

**Message:** This country's public participation exists within a **shared global civic context**.

**Block alignment:** Context Introduction below Hero and block-level Context Introductions

**One Screen — One Message:** _Why does national civic information below matter?_

## Observable Civic Activity

**Responsibility:** Present **measurable public activity** at country scope — geography and aggregates before abstraction collapses into slogans.

**Message:** Civic activity here is **real and locatable** — honest at national scale.

**Block alignment:** Interactive Map · Statistics · Evidence layer opening

**One Screen — One Message:** _What can be observed about civic activity in this country?_

## Participation Pipeline

**Responsibility:** Show **how participation is structured** nationally — stage distribution across the frozen Participation pipeline vocabulary.

**Message:** National civic life follows the **same structured path** as global civic life — visible at country scope.

**Block alignment:** Initiative Levels · Participation Pipeline block

**One Screen — One Message:** _How is participation structured in this country?_

## National Initiatives

**Responsibility:** Connect structure to **concrete civic subjects** — named initiatives on public paths visitors may read without registering.

**Message:** Ideas here become **observable collective action** — instances, not only counts.

**Block alignment:** Latest Initiatives · Exploration entry to public detail

**One Screen — One Message:** _What specific civic activity is happening here?_

## Trusted National Media

**Responsibility:** Optional **supporting context** from verified public communication associated with the country — never primary Evidence substitute.

**Message:** Public communication may **support understanding** — it does not replace participation records.

**Block alignment:** Trusted Media Carousel or Related Content — optional; Exploration stage

**One Screen — One Message:** _What public communication relates to this civic context?_

**Note:** Optional block — narrative stage may be omitted when no public-safe media exists. Omission is honest — not failure.

## Regional Exploration

**Responsibility:** Invite **deeper local scope** within the same country — Region as next filter, not new product.

**Message:** National understanding can **narrow further** — same architecture, greater local relevance.

**Block alignment:** Interactive Map · Geographic Navigator · Exploration layer

**One Screen — One Message:** _Where can I observe civic activity more locally within this country?_

## Voluntary Participation

**Responsibility:** Offer **informed registration entry** after national observation — invitation, not requirement.

**Message:** You may participate when ready — **reading never required an account**.

**Block alignment:** Registration Gateway · Participation stage

**One Screen — One Message:** _How may I participate if I choose?_

---

# 4. National Context

National Context establishes **orientation** — not nationalism.

## Country flag

**Narrative role:** optional visual anchor in Identity layer — signals **which country scope is active**.

**Narrative constraint:** flag supports _where am I_ — never _this nation prevails_ or political endorsement by Humanity Union.

## Country name

**Narrative role:** primary Identity label — the country named clearly in Hero and navigator.

**Narrative constraint:** canonical naming from public-safe geographic metadata — consistent across scopes and links.

## Country Context Introduction

**Narrative role:** one or two calm sentences explaining **why national Evidence below matters** within Humanity Union.

**Narrative constraint:** significance without persuasion; no urgency; no certification; tone discipline aligned with Epic 02 frozen Context Introduction reference.

**Example narrative direction (not mandatory copy):**

_This page shows public civic activity associated with [Country] within Humanity Union — one participating place in a connected global civic space._

Identity and Context provide **orientation**.

They do not **replace Evidence**.

They do not **pressure participation**.

National context is **welcoming and precise** — not promotional or political.

---

# 5. Observable Civic Activity

Visitors **first observe measurable public activity** — before interpreting initiatives as stories or considering registration.

Observable activity is **Evidence** — originating from Capability 02 public projections filtered to country scope.

## National statistics

Aggregate indicators at country scope — counts and derived metrics **labeled derived**.

Answers: _How much public civic activity is visible nationally?_

## Participation indicators

Pipeline-related aggregates and geographic presence — structure becoming legible.

Answers: _Is participation structured and present at national scale?_

## Public trends

Where architecture permits honest temporal presentation — **transparent aggregation only**; no predictive or moral framing.

Humanity Union presents **observable public information**.

Visitors form **their own conclusions**.

| Rule                       | Application                                                       |
| -------------------------- | ----------------------------------------------------------------- |
| **No imposed conclusions** | Platform does not declare national success, failure or legitimacy |
| **Honest sparsity**        | Low or zero activity shown truthfully                             |
| **Derived labeling**       | Computed values never presented as raw civic truth                |
| **Verification path**      | Statistics lead toward initiative detail — not slogans            |

Observable Civic Activity implements **Public Space reveals — it does not persuade**.

---

# 6. Participation Narrative

Initiatives demonstrate how **civic participation becomes measurable public action** — moving from national aggregates to **named civic paths**.

## Pipeline remains identical to Global Experience

The Participation pipeline vocabulary is **frozen** — Initiative, Collaborative Analysis, Collective Decision, Petition, Implementation Commitment, Implementation.

Country scope **filters counts and examples** — it does not **rename, reorder or shorten** the civic path for national marketing.

## National participation story

```
Structure visible nationally (Pipeline)

↓

Concrete examples visible nationally (Initiatives)

↓

Detail verifiable publicly (Initiative public projection pages)
```

**Participation Pipeline block** answers: _How is participation distributed across stages in this country?_

**Latest Initiatives block** answers: _What living examples exist on that path here?_

Together they narrate: **structured civic life is observable nationally** — not abstract globally only.

No gamification.

No league tables.

No urgency.

---

# 7. Trusted National Information

Trusted national media plays a **supporting narrative role** — not the primary story.

## Media supports understanding through verified reporting

When Verified Media capability supplies country-associated public communication, media may appear in **Exploration** or optional secondary Evidence — contextualizing civic activity, institutions or public debate **without replacing participation records**.

## Media is not the narrative

Participation projections remain **authoritative public civic Evidence** for structured participation.

Media **documents communication** — announcements, publications, recordings — it does not substitute for Initiative, Decision, Petition or Implementation public projections.

## Media supports the narrative

Trusted national media answers:

_What public communication relates to the civic context I am observing?_

It supports **Trust Through Verification** when linked to subjects visitors may cross-check — never **Trust Through Authority** rhetoric from Humanity Union itself.

Optional omission when no verified country-associated media exists — narrative continues without gap or fabrication.

---

# 8. Regional Continuation

Country Experience **naturally leads to Region Experience**.

The national narrative completes **national orientation** — it does not **terminate exploration**.

## Architectural continuation

```
Country narrative: "I understand this country's civic activity within Humanity Union."

↓

Regional narrative: "I can observe more locally within the same country — same architecture."
```

Regions provide **greater local relevance** while preserving **one Humanity Union architecture**.

| Transition           | Narrative meaning                                              |
| -------------------- | -------------------------------------------------------------- |
| **Country → Region** | Story narrows geographically — message discipline unchanged    |
| **Region → Country** | Visitor restores national context — no penalty                 |
| **Country → World**  | Visitor restores global public square — connected, not escaped |

Regional Exploration in Country Experience **foreshadows** Region Experience epic — map and navigator interactions explain scope change **before** Region pages exist in build scope.

Country narrative **opens the door** to regional depth.

It does not **build a wall** around the nation.

---

# 9. Narrative Principles

Country Experience narrative conforms to frozen principles — **no national exceptions**.

## Observation precedes participation

National Evidence and Exploration precede Registration Gateway.

Reading a country page never requires an account.

## Context Before Evidence

Every narrative step respects **Heading → Context Introduction → Evidence**.

National Context Introduction precedes national statistics, pipeline and initiatives.

## One Humanity. Many Countries. Shared Future.

National story **deepens local understanding** — it never **severs global connection**.

Copy and progression preserve **connected civic space** language.

## Every interaction increases understanding

Scope changes, initiative links and regional entries must articulate **what the visitor learned** — per `GLOBAL_EXPERIENCE_INTERACTION_ARCHITECTURE.md` adapted at country scope.

## One Screen — One Message

Each major narrative step carries **one primary idea** — implementing **One Experience Block — One Responsibility** at story layer.

## Public Space never persuades. It reveals.

National narrative excludes urgency, guilt, ranking and certification rhetoric.

---

# 10. Success Criteria

Visitors should understand — without registration, without forced linear completion — the following narrative outcomes:

| Outcome                                 | Meaning                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- |
| **Where they are**                      | Named country within Humanity Union Public Space                        |
| **What is happening in this country**   | Observable public civic activity — or honest sparsity                   |
| **How the country contributes**         | Structured participation visible nationally — measured, not sloganeered |
| **How to continue exploring**           | Region, initiatives, World, header destinations                         |
| **How participation remains voluntary** | Registration Gateway as calm choice after observation                   |

## Thirty-second national orientation

Within approximately thirty seconds, a visitor arriving from Global Experience should state:

**"I am viewing this country's civic activity inside Humanity Union — and I know how to go broader or deeper."**

Thirty seconds measures **national orientation** — not regional mastery or pipeline expertise.

## Familiarity criterion

A visitor who knows the Global Experience narrative should **recognize the same story shape** — localized:

| Global stage                   | Country stage                           |
| ------------------------------ | --------------------------------------- |
| Humanity exists                | Country exists in Humanity Union        |
| Humanity is active             | Country civic activity is active        |
| Participation is measurable    | National participation is measurable    |
| Ideas become collective action | National initiatives demonstrate action |
| You may participate            | You may participate — voluntarily       |

Optional media and regional steps **extend** — they do not **replace** — this parallel.

---

# 11. Final Statement

**Country Experience presents one country's observable civic reality as part of Humanity Union's connected public civic space.**

The narrative **strengthens local understanding** while **preserving the global perspective**.

Country Experience is not a national exit from Humanity Union.

It is the **national chapter** of one public civic story — told with the same calm, the same honesty and the same architectural sequence Global Experience established at World scope.

Downstream artifacts — content architecture, interaction architecture, page specification and architecture review — must inherit this narrative without inverting order, merging messages or introducing national promotion pressure.

**This document does not define implementation.**

It defines **what story Country Experience tells** — before copy, layout and engineering serve that story.

One Humanity.

Many Countries.

Shared Future.

One narrative — observed globally, understood nationally, continued regionally.

---

# References

| Document                      | Path                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| Discovery Session 01          | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/DISCOVERY_SESSION_01.md`         |
| Country Experience Vision     | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_VISION.md`    |
| Epic 02 Architecture Freeze   | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/EPIC_02_ARCHITECTURE_FREEZE.md`   |
| Global Experience Narrative   | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_NARRATIVE.md`   |
| Public Page Template Standard | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md` |
| Public Space Architecture     | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`     |

---

# Document Status

**Draft**

Country Experience Narrative — Epic 03

Content architecture may proceed after narrative approval.

Implementation is **not authorized** by this document.
