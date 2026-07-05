# COUNTRY PAGE TEMPLATE STANDARD

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 03 — Country Experience

Version: 1.0

Status: Draft

Document Type: Page Template Standard

---

# 1. Purpose

Define the **canonical page template** for all Country Experience pages.

Country pages must share **one architectural language** regardless of culture, language, or geography.

This template ensures every country presents its public civic space through **one unified Humanity Union architecture** — the national expression of the same Public Page Template Standard Epic 02 established at World scope.

This document governs:

- the frozen Version 1 block sequence for Country Experience;
- structural responsibility of each Experience Block on a country page;
- the Context Before Evidence pattern every block must follow;
- navigation descent and ascent rules at country scope;
- future compatibility without structural redesign.

This standard is **architectural composition** — not visual design, not CSS, not frontend components, not routes or APIs.

Reference:

- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`

Content architecture defines **what** each block communicates at country scope.

Interaction architecture defines **how** visitor interactions unfold across blocks.

This document defines **page composition** — the structural template every Country Experience page must follow.

---

# 2. Canonical Layout

Version 1 **Country Experience** page sequence is **frozen**.

Global chrome precedes page composition per Epic 01 and `PUBLIC_PAGE_TEMPLATE_STANDARD.md`.

## Global chrome (required)

| Element                  | Architectural responsibility                                 |
| ------------------------ | ------------------------------------------------------------ |
| **Header**               | Six frozen primary destinations — unchanged at country scope |
| **Geographic Navigator** | Country active; World ascent and Region descent entry        |

## Page composition (frozen order)

```
Country Identity

↓

National Interactive Map

↓

National Statistics

↓

National Participation Pipeline

↓

Latest National Initiatives

↓

Trusted National Media

↓

Regional Exploration

↓

Registration Gateway

↓

Footer
```

## Sequence rules

| Rule                                 | Meaning                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| **Order is narrative order**         | Blocks appear in this sequence — not optional reordering                               |
| **No stage out of order**            | A block may be omitted only where architecture explicitly permits — never repositioned |
| **Observation before participation** | Registration Gateway follows Evidence and Exploration blocks                           |
| **One template — many countries**    | Country identity and filtered datasets change — structure does not                     |

This sequence forms the **canonical Country Experience page template**.

Optional secondary block **About Preview** from Block Library remains **deferred** — not part of Version 1 Country page composition.

---

# 3. Country Identity

**Country Identity** is the first page composition block.

It introduces the **current national civic space** — where the visitor is within Humanity Union Public Space at Country scope.

## Contains

| Element                                                 | Responsibility                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Country name**                                        | Primary identity — names the national civic space                           |
| **National flag**                                       | Recognizable national symbol — orientation, not promotion                   |
| **Context Introduction**                                | Helps visitor interpret national Evidence that follows — without persuasion |
| **Optional representative landscape or landmark image** | Atmospheric orientation — not tourism marketing                             |

## Architectural rules

- Identity **orients** — it does not promote the country, its government or a political narrative;
- Identity excludes statistics, initiative catalogs, regional lists and registration demands;
- Identity copy remains distinct from block-level Evidence below;
- scope label visible — visitor knows they are at **Country** level within Humanity Union;
- internal capability names forbidden in Identity layer.

**Primary block:** Hero · Geographic Summary at Country scope

**Narrative stage:** Identity

Country Identity answers **Where am I?** — the first of the five visitor questions from `PUBLIC_PAGE_TEMPLATE_STANDARD.md`.

---

# 4. Regional Exploration

**Regional Exploration** is the geographic depth block before Registration Gateway.

## Purpose

Regional Exploration **prepares visitors to continue into Region Experience** — the next geographic level within the same Public Space architecture.

It offers **scope transition** — not a substitute for Community discovery.

## Architectural boundaries

| Permitted                                          | Forbidden                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| Entry to named regions within the country          | Community search or Find Your Community on Country page              |
| Map or list exploration of regional civic activity | Community Experience composition at Country scope                    |
| Context for why regional depth matters nationally  | Duplicating National Interactive Map Evidence under alternate labels |
| Calm invitation to descend — not pressure          | Forced linear path through every region                              |

Regional Exploration **does not replace Community Experience**.

Community is a separate civic context level in the approved geographic flow:

```
Global Experience → Country Experience → Region Experience → Community Experience → Workspace
```

Community discovery belongs to **Community Experience** and governed Initiative flows — not to Country page template composition.

Regional Exploration answers **Where can I explore next?** at geographic depth — within Country scope only.

---

# 5. Consistent Block Responsibilities

Each Experience Block on a Country page has **one responsibility**.

No block may absorb another block's architectural duty.

## Block responsibility table

| Block                               | One responsibility                                            |
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

## Duplication rules

| Forbidden                                                                              | Permitted                                                           |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Same statistic in Statistics and Pipeline without distinct responsibility              | Each block presents Evidence from its own projection responsibility |
| Initiative catalog duplicated in Map and Latest Initiatives as primary content         | Cross-reference links that preserve block responsibility            |
| Regional list duplicated in Map and Regional Exploration as identical primary Evidence | Regional Exploration extends — not repeats — map exploration        |
| Header navigation duplicated inside page blocks                                        | Footer secondary links — not header duplication                     |
| Find Your Community or community search at Country scope                               | Community discovery deferred to Community Experience                |

**Filter Instead of Duplicate.**

Country pages present **filtered national datasets** through **distinct block responsibilities** — not repeated information under alternate headings.

---

# 6. Context Before Evidence

Every Country Experience block follows the same structural pattern:

```
Heading

↓

Context Introduction

↓

Evidence

↓

Visitor Conclusion
```

| Layer                    | Structural role                                                            |
| ------------------------ | -------------------------------------------------------------------------- |
| **Heading**              | Block title — identifies subject at country scope                          |
| **Context Introduction** | Explains why this block's Evidence matters nationally — without persuasion |
| **Evidence**             | Public projection data or public-safe configuration — read-only            |
| **Visitor Conclusion**   | Visitor judges — platform does not conclude for them                       |

## Architectural rules

**Context Introduction:**

- explains significance — never persuades;
- never replaces Evidence;
- remains concise;
- precedes Evidence on every block — **no exceptions**.

**Evidence:**

- originates from responsible Capabilities through public projections filtered to country;
- includes derived values labeled derived;
- permits honest empty or sparse national states;
- never fabricates activity to appear nationally vibrant.

**Visitor Conclusion:**

- Humanity Union presents evidence;
- visitors form conclusions independently;
- platform does not insert national verdicts, certification copy or "trust this country" messaging.

Registration Gateway Context Introduction precedes invitation action — not Country Identity Hero.

This pattern applies to **every block** in the canonical layout — including Footer where supporting copy applies.

---

# 7. Navigation Rules

Primary navigation moves through **approved geographic levels**:

```
Global

↓

Country

↓

Region

↓

Community

↓

Workspace
```

## Visitor orientation

Visitors **always understand their current geographic level**.

At Country scope:

| Navigation element           | Responsibility                                               |
| ---------------------------- | ------------------------------------------------------------ |
| **Header**                   | Six frozen destinations — platform-wide civic spaces         |
| **Geographic Navigator**     | Country active; World ascent; Region descent                 |
| **National Interactive Map** | In-country geographic Evidence and region entry              |
| **Regional Exploration**     | Prepared descent to Region Experience                        |
| **Footer**                   | Supporting navigation — legal, transparency, secondary links |

## Descent and ascent

| Direction            | Permitted entry at Country scope                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Ascent**           | World — via Geographic Navigator, Header Home, or governed return paths                        |
| **Descent**          | Region — via Map, Regional Exploration, or Geographic Navigator                                |
| **Lateral**          | Header destinations — Knowledge, Media, Institutions, About                                    |
| **Deferred descent** | Community — via Region Experience or Find Your Community — not Country page primary navigation |

## Navigation discipline

- three-step navigation rule from Navigation Architecture preserved;
- navigation follows curiosity — no forced linear tutorial or registration wall on public Evidence;
- Community introduced at Region or Community Experience — not as Country page primary nav competition;
- Workspace entry requires explicit governed participation path — never bait-and-switch from public reading.

Primary geographic navigation at Country scope emphasizes **Country → Region** descent.

Community remains architecturally present in the hierarchy without displacing Regional Exploration on the Country page template.

---

# 8. Future Compatibility

The Country page template supports future platform evolution **without structural redesign**.

## Supported future extensions

| Future capability               | Template compatibility                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| **Community Experience**        | Separate page template at Community scope — Country template unchanged              |
| **Local administrative levels** | Additional geographic scopes inherit same block sequence with filtered datasets     |
| **Future public projections**   | New Evidence types slot into existing block responsibilities — not new page anatomy |
| **Find Your Community**         | Community discovery at Community scope — not Country page composition change        |
| **About Preview block**         | Optional deferred block — insertion only through formal Architecture Review         |

## Adaptation rule

```
Country Page Template + country scope parameter → filtered Evidence and Exploration datasets
```

Architecture remains identical across countries and future geographic levels.

Only **filtered datasets**, **identity copy**, and **scope labels** change.

Forbidden future pattern:

- per-country custom block sequences;
- national promotional reordering placing Registration Gateway before Evidence;
- Community blocks inserted into Country template to avoid building Community Experience.

The Version 1 frozen sequence is the **stable contract** for implementation, content and interaction architecture.

---

# 9. Architectural Principles

The Country page template confirms these Humanity Union Public Space principles:

| Principle                                     | Country template meaning                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| **One Experience Block — One Responsibility** | Each block in Section 5 table owns exactly one architectural duty             |
| **Context Before Evidence**                   | Heading → Context Introduction → Evidence → Visitor Conclusion on every block |
| **Observation precedes participation**        | Registration Gateway follows national Evidence and Regional Exploration       |
| **Trust Through Verification**                | Evidence traceable to public projections — honest empty states permitted      |
| **Explainable Honesty**                       | Derived values labeled; no fabricated national vibrancy                       |
| **Filter Instead of Duplicate**               | Country scope filters datasets — block responsibilities stay distinct         |

These principles inherit from Epic 01 Public Space architecture and Epic 02 Global Experience without national exception.

Country pages reveal **one nation's observable civic activity**.

They do not sell platform mythology or national promotion.

---

# 10. Final Statement

Country pages present **one nation's observable civic activity** while preserving Humanity Union's unified Public Space architecture.

The template guarantees:

| Guarantee                 | Meaning                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Familiarity**           | Visitors recognize the same block sequence and rhythm they know from Global Experience |
| **Scalability**           | Every country adopts one template — content and projections vary, structure does not   |
| **Long-term consistency** | Future Community Experience and geographic levels extend — not fork — this composition |

Country Experience is **Geographic Experience at Country scope** — not a separate national portal.

The canonical layout, Context Before Evidence pattern, and navigation rules in this document are the **structural contract** for all Country Experience pages in Version 1.

Implementation, visual design, and engineering must serve this template — not redefine it.

---

**End of Document**
