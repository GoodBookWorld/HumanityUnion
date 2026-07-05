# GLOBAL EXPERIENCE CONTENT ARCHITECTURE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 02 — Global Experience

Version: 1.0

Status: Draft

Document Type: Content Architecture

---

# Purpose

Define the **information responsibility** of every Global Experience block.

This document specifies **what each block communicates**, **why that information matters**, and **how blocks relate in civic meaning** — not how they are laid out or implemented.

Content architecture governs:

- titles and Context Introductions;
- factual information displayed;
- visitor questions answered;
- narrative position and neighbour relationships.

It does not govern:

- layout, grid, spacing or responsive composition;
- components, routes, APIs or data stores;
- visual design system tokens.

Reference:

- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`

Epic 01 frozen block catalog and composition order.

This document frozen **content responsibility** per block at World scope.

---

# Content before Layout

**Humanity Union always defines information responsibility before visual composition.**

Layout answers _how information is arranged_.

Content architecture answers _what information means_ and _why it appears_.

Correct sequence:

```
Content responsibility

↓

Narrative position

↓

Context Introduction

↓

Evidence displayed

↓

(only then) layout and visual design
```

Forbidden sequence:

```
Visual mockup

↓

Fill blocks with available content

↓

Retrofit narrative
```

Global Experience blocks must not receive copy invented to fit a layout.

Layouts must serve predefined content responsibility.

This discipline preserves Explainable Honesty and prevents promotional drift during implementation.

---

# Context Before Evidence

Every Experience Block begins with:

```
Title

↓

Context Introduction

↓

Evidence
```

| Layer                    | Role                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------- |
| **Title**                | Identifies the subject — what this block is about                                  |
| **Context Introduction** | Explains why the information matters — one or two short sentences below the title  |
| **Evidence**             | Presents factual public information from which visitors draw their own conclusions |

The Context Introduction:

- helps visitors correctly interpret the block;
- explains significance without persuasion, marketing language or emotional pressure;
- builds understanding rather than influencing opinion;
- never certifies truth, demand registration or create urgency.

Evidence:

- originates from responsible Capabilities through public projections;
- includes derived values **labeled derived** where applicable;
- permits honest empty or sparse states — never fabricated activity.

This principle supports **Explainable Honesty** and **Trust Through Verification**.

Visitors judge — the platform reveals.

---

# 1. Civic Introduction (Hero)

**Architectural block:** Hero

## Purpose

Establish Humanity Union as a public civic platform and orient the visitor at World scope — one primary identity message only.

## Visitor Questions Answered

- What is Humanity Union?
- Why am I on this page?

## Context Introduction

_Humanity Union is a public space where society can observe structured civic participation worldwide. This page shows what is happening on the platform at global scope._

## Information Displayed

- platform name and World-scope page identity;
- one-sentence civic purpose — observation before participation;
- optional single calm link to About for platform identity depth — not registration;
- no statistics, initiative lists or pipeline detail in Hero — those belong to downstream blocks.

## Why it appears in this position

First narrative stage: **Humanity exists.**

The visitor must understand _what this place is_ before interpreting activity data below.

Hero implements Stage 1 of `GLOBAL_EXPERIENCE_NARRATIVE.md`.

## Relationship with neighbouring blocks

| Neighbour                                 | Relationship                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Above (Header / Geographic Navigator)** | Header provides destinations; Hero provides page meaning — not duplicate navigation                    |
| **Below (Interactive World Map)**         | Hero states platform identity; Map shows geographic evidence that activity is real                     |
| **Throughout page**                       | Hero framing sets interpretive lens — downstream blocks present evidence, not repeated identity claims |

Hero must not preview statistics or initiatives — that collapses One Screen — One Message.

---

# 2. Interactive World Map

**Architectural block:** Interactive Map (UI: Interactive World Map)

## Purpose

Show that civic activity exists geographically and offer scope exploration entry — orientation through place, not operational control.

## Visitor Questions Answered

- What is happening now — geographically?
- How is humanity participating across the world?
- Where can I explore further by region?

## Context Introduction

_Civic initiatives on Humanity Union are associated with places around the world. The map shows where public activity is present — select a region to view activity at that scope._

## Information Displayed

- geographic distribution of public civic activity at World scope;
- visual or interactive entry to Country and Region filtered views;
- scope indication — World lens active;
- honest absence where no public activity exists in a geography — not hidden defaults;
- no personal data, participant locations or operational internals.

## Why it appears in this position

Second narrative stage: **Humanity is active.**

Follows identity with geographic evidence — activity is locatable and real.

Implements Orientation in Information Architecture Flow.

## Relationship with neighbouring blocks

| Neighbour                     | Relationship                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Above (Hero)**              | Hero names the platform; Map shows first observable proof of global presence                                        |
| **Below (Global Statistics)** | Map shows _where_; Statistics summarize _how much_ at World scope — complementary, not redundant                    |
| **Geographic Navigator**      | Navigator changes scope filter; Map may assist same scope model — same architectural intent, not competing messages |

Map must not display aggregate counts that duplicate Statistics block primary message on the same screen region.

---

# 3. Global Statistics

**Architectural block:** Statistics (World scope; UI: Global Statistics)

## Purpose

Summarize aggregate public civic metrics at World scope — scale and presence made legible through honest numbers.

## Visitor Questions Answered

- How much civic activity exists globally?
- Is this platform actively used?

## Context Introduction

_These figures summarize public civic activity across Humanity Union at global scope. Counts and indicators are computed from public records — derived values are labeled accordingly._

## Information Displayed

- initiative or participation path counts suitable for public World display;
- high-level aggregate indicators from Capability 02 public projections;
- **derived** metrics explicitly labeled derived;
- scope label — World;
- honest zero or low-activity presentation when applicable;
- no ranking of people, engagement scores or unverifiable totals.

## Why it appears in this position

Third narrative stage begins: **Participation is measurable.**

Follows geographic orientation with quantitative summary — structure becomes legible.

Pairs with Participation Pipeline block below — Statistics gives scale; Pipeline gives stage shape.

## Relationship with neighbouring blocks

| Neighbour                          | Relationship                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Above (Interactive Map)**        | Map orients geographically; Statistics quantify globally                                                           |
| **Below (Participation Pipeline)** | Statistics answer _how much_; Pipeline answers _at what stages_ — sequential understanding, not duplicate headline |
| **Below (Latest Initiatives)**     | Statistics abstract; Latest Initiatives concrete — abstraction before examples                                     |

Statistics must not include initiative titles or narrative — that belongs to Latest Initiatives.

---

# 4. Participation Pipeline

**Architectural block:** Initiative Levels (UI may read Participation Pipeline or Initiative Levels)

## Purpose

Show how civic activity distributes across Participation pipeline stages in public view — pipeline structure visible at a glance.

## Visitor Questions Answered

- How is humanity participating — structurally?
- What stages of civic life exist on the platform?
- What kinds of public activity are underway?

## Context Introduction

_Participation on Humanity Union follows a structured civic path from proposal through collective action. This overview shows how many public initiatives are visible at each stage worldwide._

## Information Displayed

- stage labels using Capability 02 civic vocabulary — Initiative, Collaborative Analysis, Collective Decision, Petition, Implementation Commitment, Implementation;
- count or proportion per stage at World scope from public projections;
- optional calm link to Initiatives destination or Knowledge process explanation — not registration;
- Impact stage omitted or marked future if no public data — not fabricated;
- no gamification, league tables or urgency framing.

## Why it appears in this position

Continues Stage 3: **Participation is measurable.**

Immediately after Global Statistics — visitor understands scale, then structure.

Prepares Stage 4 by naming the path initiatives travel before showing concrete examples.

## Relationship with neighbouring blocks

| Neighbour                             | Relationship                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Above (Global Statistics)**         | Statistics = magnitude; Pipeline = stage distribution — one measurable story in two blocks             |
| **Below (Latest Global Initiatives)** | Pipeline names the path; Latest Initiatives shows real instances on that path                          |
| **Knowledge (via Header)**            | Pipeline shows live distribution; Knowledge explains process — cross-link optional, not duplicate copy |

Pipeline block must not list full initiative cards — that duplicates Latest Initiatives evidence.

---

# 5. Latest Global Initiatives

**Architectural block:** Latest Initiatives (UI: Latest Global Initiatives)

## Purpose

Present concrete public initiative entries — ideas becoming collective action through observable civic paths.

## Visitor Questions Answered

- What is happening now — specifically?
- What can I explore further?
- Can I see real examples before deciding anything?

## Context Introduction

_These are recent public initiatives visible at global scope. Each links to a public record of its civic path — you can read details without registering._

## Information Displayed

- initiative subject title from public projection;
- current pipeline stage indicator — read-only, civic language;
- scope-relevant summary line — public-safe only;
- link to Initiative public detail;
- recency or curated ordering — transparent if curated;
- no operational fields, participant identity or private internals;
- honest empty state if no initiatives at World scope.

## Why it appears in this position

Fourth narrative stage: **Ideas become collective action.**

Abstract metrics above become concrete stories — supports trust evaluation through traceable subjects.

Implements Understanding → Evaluation transition.

## Relationship with neighbouring blocks

| Neighbour                            | Relationship                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Above (Participation Pipeline)**   | Pipeline explains stages; Latest Initiatives shows living examples at those stages                                 |
| **Below (Registration Gateway)**     | Initiatives prove exploration is open without account; Registration follows — not precedes — concrete examples     |
| **Initiatives destination (Header)** | Latest Initiatives is curated entry; Initiatives destination is full browse — same content domain, different depth |

Latest Initiatives must not repeat Global Statistics totals as primary message.

---

# 6. Registration Gateway

**Architectural block:** Registration Gateway (UI: Join Humanity Union)

## Purpose

Offer explicit, informed entry to registration — invitation after observation, never requirement for reading.

## Visitor Questions Answered

- How do I participate if I choose to?
- Must I register to continue exploring? _(answered implicitly: no)_

## Context Introduction

_You can explore Humanity Union without an account. Registration allows you to take part in civic participation when you are ready._

## Information Displayed

- calm invitation to register — what registration enables in civic terms;
- single primary registration entry action;
- no urgency, guilt, countdown or "limited access" language;
- no restatement of statistics or initiative lists — invitation only;
- optional link to About for trust evaluation before registering.

## Why it appears in this position

Fifth narrative stage: **You may participate.**

Last narrative block before Footer — comprehension precedes invitation.

Implements Participation threshold in Information Architecture Flow after Evaluation.

## Relationship with neighbouring blocks

| Neighbour                             | Relationship                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Above (Latest Global Initiatives)** | Initiatives demonstrate public exploration without account; Gateway offers optional next step                     |
| **Below (Footer)**                    | Gateway invites participation; Footer provides institutional and accessibility support — not competing conversion |
| **Hero**                              | Hero never demands registration; Gateway appears only here — narrative distance preserves calm                    |

Registration Gateway must not appear above Latest Initiatives in content hierarchy.

---

# 7. Footer

**Architectural block:** Footer

## Purpose

Provide supporting platform information, secondary navigation and institutional obligations — stable closure of the public page.

## Visitor Questions Answered

- Where are legal, accessibility and contact resources?
- How do I reach supporting destinations without using primary header?

## Context Introduction

_Humanity Union publishes legal, accessibility and contact information here. These links support informed use of the platform — they are not required reading to explore civic activity above._

## Information Displayed

- legal and privacy links;
- accessibility statement entry;
- contact or support entry;
- locale or language where applicable;
- reserved secondary links per Navigation Architecture;
- no primary civic content duplication — no initiative lists, statistics or registration pressure.

## Why it appears in this position

Persistent global chrome — page closure after narrative completion.

Supports trust through institutional transparency without interrupting narrative flow.

## Relationship with neighbouring blocks

| Neighbour                        | Relationship                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Above (Registration Gateway)** | Gateway offers participation entry; Footer offers platform obligations — sequential closure, not conversion stack |
| **Header**                       | Header primary discovery; Footer supporting resources — hierarchy preserved                                       |
| **About destination**            | Footer may link About; About owns trust depth — Footer does not duplicate mission essay                           |

Footer must not introduce a second Registration Gateway or primary call-to-action competing with narrative order.

---

# Block Content Sequence Summary

| Order | Block                  | Title (example)          | Context Introduction role              |
| ----- | ---------------------- | ------------------------ | -------------------------------------- |
| 1     | Hero                   | Humanity Union           | Name the public civic platform         |
| 2     | Interactive Map        | Civic Activity Worldwide | Explain geographic meaning of activity |
| 3     | Global Statistics      | Global Activity          | Explain aggregate public counts        |
| 4     | Participation Pipeline | Participation Stages     | Explain pipeline stage overview        |
| 5     | Latest Initiatives     | Recent Initiatives       | Explain concrete public examples       |
| 6     | Registration Gateway   | Join Humanity Union      | Explain optional registration          |
| 7     | Footer                 | _(supporting labels)_    | Explain supporting links               |

Header and Geographic Navigator carry navigation content — destination labels and scope labels — not narrative stage messages.

Their content architecture follows `NAVIGATION_ARCHITECTURE.md`.

---

# Data and Copy Discipline

| Rule                       | Application                                                     |
| -------------------------- | --------------------------------------------------------------- |
| Presentation only          | Blocks display; Capabilities own business truth                 |
| Derived labeling           | Any computed public indicator labeled derived in Evidence layer |
| No fabrication             | Empty states honest at World scope                              |
| No persuasion              | Context Introductions explain — never sell                      |
| Civic vocabulary           | Capability 02 stage names — not product synonyms                |
| Public projection boundary | No operational fields in any block Evidence                     |

Source mapping: `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md` Section 8.

---

# Final Statement

**Global Experience communicates reality rather than promotion.**

Each block owns one information responsibility.

Each block begins with Context Introduction before Evidence.

Each block answers specific visitor questions in narrative order.

Content architecture precedes layout and implementation.

Visitors observe civic activity, understand structure, evaluate legitimacy and choose participation freely — because the content layer reveals honestly rather than persuades.

Epic 02 visual and engineering artifacts must conform to this document before build proceeds.

This document does not define layout.

This document does not define implementation.

It defines **what Global Experience means** in public language.

---

# References

| Document                    | Path                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Global Experience Narrative | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_NARRATIVE.md`     |
| Global Experience Vision    | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`        |
| Epic 01 Architecture Freeze | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`     |
| Experience Block Library    | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md` |

---

# Document Status

**Draft**

Global Experience Content Architecture — Epic 02

Layout specifications and implementation guides must inherit content responsibility from this document.
