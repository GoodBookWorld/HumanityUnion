# REGION PAGE TEMPLATE STANDARD

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 04 — Region Experience

Version: 1.0

Status: Draft

Document Type: Page Template Standard

---

# 1. Purpose

Define the **canonical page template** for all Region Experience pages.

**Region pages share one architectural language across all countries.**

**Only regional public information changes.**

This template ensures every region presents its public civic space through **one unified Humanity Union architecture** — the regional expression of the same page template Country Experience established at national scope and Public Page Template Standard at World scope.

This document governs:

- the frozen Version 1 block sequence for Region Experience;
- structural responsibility of each Experience Block on a region page;
- the Context Before Evidence pattern every block must follow;
- navigation descent and ascent rules at region scope;
- Community Discovery as scope transition toward Community Experience;
- future compatibility without structural redesign.

This standard is **architectural composition** — not visual design, not CSS, not frontend components, not routes or APIs.

Reference:

- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_PAGE_TEMPLATE_STANDARD.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`

Content architecture defines **what** each block communicates at region scope.

Interaction architecture defines **how** visitor interactions unfold across blocks.

This document defines **page composition** — the structural template every Region Experience page must follow.

---

# 2. Canonical Layout

Version 1 **Region Experience** page sequence is **frozen**.

Global chrome precedes page composition per Epic 01 and `PUBLIC_PAGE_TEMPLATE_STANDARD.md`.

## Global chrome (required)

| Element                  | Architectural responsibility                                |
| ------------------------ | ----------------------------------------------------------- |
| **Header**               | Six frozen primary destinations — unchanged at region scope |
| **Geographic Navigator** | Region active within Country; Country and World ascent      |

## Page composition (frozen order)

```
Region Identity

↓

Regional Interactive Map

↓

Regional Statistics

↓

Regional Participation Pipeline

↓

Latest Regional Initiatives

↓

Community Discovery

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
| **Observation before participation** | Registration Gateway follows Evidence and Community Discovery                          |
| **One template — many regions**      | Region identity, country context and filtered datasets change — structure does not     |

## Inheritance from Country Experience

Region page template **inherits** Country page template pattern:

| Country Experience block        | Region Experience block         |
| ------------------------------- | ------------------------------- |
| Country Identity                | Region Identity                 |
| National Interactive Map        | Regional Interactive Map        |
| National Statistics             | Regional Statistics             |
| National Participation Pipeline | Regional Participation Pipeline |
| Latest National Initiatives     | Latest Regional Initiatives     |
| Regional Exploration            | **Community Discovery**         |
| Registration Gateway            | Registration Gateway            |
| Footer                          | Footer                          |

Country **Regional Exploration** prepared descent to Region.

Region **Community Discovery** prepares descent to Community Experience.

Optional **Trusted Regional Media** — if authorized in later Architecture Review — may slot between Latest Regional Initiatives and Community Discovery with same optional omission semantics as Trusted National Media at Country scope. Not part of Version 1 frozen Region page composition in this document.

Optional secondary block **About Preview** from Block Library remains **deferred** — not part of Version 1 Region page composition.

This sequence forms the **canonical Region Experience page template**.

---

# 3. Region Identity

**Region Identity** is the first page composition block.

It introduces the **current regional civic space** — where the visitor is **within its country** within Humanity Union Public Space at Region scope.

## Contains

| Element                  | Responsibility                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **Region name**          | Primary identity — names the regional civic space                                   |
| **Country name**         | Parent scope label — region always locatable within named country                   |
| **Representative image** | Optional Identity visual context — landscape or regional landmark; orientation only |
| **Context Introduction** | Helps visitor interpret regional Evidence that follows — without persuasion         |

## Architectural rules

- Identity **orients** — it does not promote the region, its administration or a local political narrative;
- Identity excludes statistics, initiative catalogs, community lists and registration demands;
- Identity copy remains distinct from block-level Evidence below;
- scope label visible — visitor knows they are at **Region** level **within Country** within Humanity Union;
- Identity must not collapse Region scope into Community scope;
- internal capability names forbidden in Identity layer.

**Primary block:** Hero · Geographic Summary at Region scope

**Narrative stage:** Identity

Region Identity answers **Where am I?** — the first of the five visitor questions from `PUBLIC_PAGE_TEMPLATE_STANDARD.md` at regional depth.

**Identity provides orientation.**

---

# 4. Community Discovery

**Community Discovery** is the civic-context depth block before Registration Gateway.

## Purpose

Community Discovery **prepares visitors for Community Experience** — the next civic context level within the same Public Space architecture.

It offers **scope transition** from geographic region to participant-named community — not a substitute for Community Experience composition.

## Architectural character

**Community Discovery is exploratory.**

Visitors browse **public associations** between participant-created communities and regional context — they are not required to search, query or complete a directory.

**Community Discovery is not a search interface.**

Find Your Community search belongs to **Community Experience** — not Region page template composition.

## Architectural boundaries

| Permitted                                                              | Forbidden                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Surface communities with public activity associated to the region      | Find Your Community search field on Region page                               |
| Link to Community Experience at community scope                        | Full Community Identity, Community Statistics or Community Pipeline blocks    |
| Context explaining Region ≠ Community                                  | Administrator-maintained exhaustive community catalog presented as sole truth |
| Map cross-reference to community associations                          | Duplicating Latest Regional Initiatives as community primary Evidence         |
| Honest empty state when no associations exist                          | Fabricated communities to appear regionally vibrant                           |
| Optional cross-link toward Find Your Community on Community Experience | Embedded name search on Region page                                           |

Community Discovery **does not replace Community Experience**.

Community is a separate civic context level in the approved geographic flow:

```
Global Experience → Country Experience → Region Experience → Community Experience → Workspace
```

Communities are **discovered through participation** per `COMMUNITY_CONTEXT_DECISION.md` — Community Discovery **surfaces associations**; it does not **own** Community business truth.

Community Discovery answers **Where can I discover participant-created communities in this regional context?** — within Region scope only.

---

# 5. Block Responsibilities

Each Experience Block on a Region page has **one responsibility**.

**No duplicated navigation.**

**No duplicated evidence.**

No block may absorb another block's architectural duty.

## Block responsibility table

| Block                               | One responsibility                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Region Identity**                 | Name the region within its country and orient the visitor within Humanity Union                              |
| **Regional Interactive Map**        | Show civic activity geographically within the region; highlight community associations                       |
| **Regional Statistics**             | Summarize observable regional public participation indicators                                                |
| **Regional Participation Pipeline** | Show regional distribution across pipeline stages                                                            |
| **Latest Regional Initiatives**     | Present concrete regional initiative public examples                                                         |
| **Community Discovery**             | Surface participant-created communities with public regional association; prepare Community Experience entry |
| **Registration Gateway**            | Offer voluntary registration after regional observation                                                      |
| **Footer**                          | Provide supporting navigation and institutional transparency                                                 |

## Duplication rules

| Forbidden                                                                                | Permitted                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Same statistic in Statistics and Pipeline without distinct responsibility                | Each block presents Evidence from its own projection responsibility       |
| Initiative catalog duplicated in Map and Latest Initiatives as primary content           | Cross-reference links that preserve block responsibility                  |
| Community list duplicated identically in Map and Community Discovery as primary Evidence | Map orients geographically; Community Discovery prepares scope transition |
| Community summary statistics mirroring full Community Statistics block                   | Summary association preview fields only — per content architecture        |
| Header navigation duplicated inside page blocks                                          | Footer secondary links — not header duplication                           |
| Find Your Community or community search at Region scope                                  | Community search deferred to Community Experience                         |

**Filter Instead of Duplicate.**

Region pages present **filtered regional datasets** through **distinct block responsibilities** — not repeated information under alternate headings.

**One Experience Block — One Responsibility.**

---

# 6. Context Before Evidence

Every Region Experience block follows the same structural pattern:

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
| **Heading**              | Block title — identifies subject at region scope                           |
| **Context Introduction** | Explains why this block's Evidence matters regionally — without persuasion |
| **Evidence**             | Public projection data or public-safe configuration — read-only            |
| **Visitor Conclusion**   | Visitor judges — platform does not conclude for them                       |

## Architectural rules

**Context Introduction:**

- explains significance — never persuades;
- never replaces Evidence;
- remains concise;
- precedes Evidence on every block — **no exceptions**.

**Evidence:**

- originates from responsible Capabilities through public projections filtered to region;
- includes derived values labeled derived;
- permits honest empty or sparse regional states;
- never fabricates activity or community associations to appear regionally vibrant.

**Visitor Conclusion:**

- Humanity Union presents evidence;
- visitors form conclusions independently;
- platform does not insert regional verdicts, administrative certification copy or "trust this region" messaging.

Community Discovery Context Introduction must clarify **Region vs Community scope** before association Evidence.

Registration Gateway Context Introduction precedes invitation action — not Region Identity Hero.

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

Visitors **always understand their geographic level**.

At Region scope:

| Navigation element           | Responsibility                                                     |
| ---------------------------- | ------------------------------------------------------------------ |
| **Header**                   | Six frozen destinations — platform-wide civic spaces               |
| **Geographic Navigator**     | Region active within Country; Country and World ascent             |
| **Regional Interactive Map** | In-region geographic Evidence and community association highlights |
| **Community Discovery**      | Prepared descent to Community Experience                           |
| **Footer**                   | Supporting navigation — legal, transparency, secondary links       |

## Descent and ascent

| Direction            | Permitted entry at Region scope                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Ascent**           | Country — via Geographic Navigator or governed return paths                                                     |
| **Ascent**           | World — via Country, Geographic Navigator, Header Home, or governed return paths                                |
| **Descent**          | Community — via Community Discovery, map associations, or Geographic Navigator when Community Experience exists |
| **Lateral**          | Header destinations — Knowledge, Media, Institutions, About                                                     |
| **Deferred descent** | Find Your Community — via Community Experience — not Region page primary navigation                             |

## Navigation discipline

- three-step navigation rule from Navigation Architecture preserved;
- navigation follows curiosity — no forced linear tutorial or registration wall on public Evidence;
- Community introduced at Community Discovery and Community Experience — not as duplicate search on Region page;
- Workspace entry requires explicit governed participation path — never bait-and-switch from public reading;
- deep link to Community Experience is valid — template preserved — not navigation failure.

Primary geographic navigation at Region scope emphasizes **Region → Community** descent.

Country and World ascent remain **always available**.

---

# 8. Future Compatibility

The Region page template supports future platform evolution **without structural redesign**.

## Supported future extensions

| Future capability             | Template compatibility                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Community Experience**      | Separate page template at Community scope — Region template unchanged                                          |
| **Future local levels**       | Deeper civic context through Community Experience and Architecture Review — not Region template multiplication |
| **Future public projections** | New Evidence types slot into existing block responsibilities — not new page anatomy                            |
| **Find Your Community**       | Community discovery search at Community scope — not Region page composition change                             |
| **Trusted Regional Media**    | Optional Exploration block — Architecture Review if added                                                      |
| **About Preview block**       | Optional deferred block — insertion only through formal Architecture Review                                    |

## Adaptation rule

```
Region Page Template + region scope parameter + country parent context → filtered Evidence and Community Discovery datasets
```

Architecture remains identical across regions, countries and future civic context levels.

Only **filtered datasets**, **identity copy**, **country parent label**, and **scope labels** change.

Forbidden future pattern:

- per-region custom block sequences;
- regional promotional reordering placing Registration Gateway before Evidence;
- Community blocks inserted into Region template to avoid building Community Experience;
- Find Your Community search absorbed into Region page;
- multiplying Region templates for district, municipality, city or village — local depth continues through **Community Experience** per content architecture.

The Version 1 frozen sequence is the **stable contract** for implementation, content and interaction architecture.

---

# 9. Architectural Principles

The Region page template confirms these Humanity Union Public Space principles:

| Principle                                            | Region template meaning                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **One Experience Block — One Responsibility**        | Each block in Section 5 table owns exactly one architectural duty                          |
| **Context Before Evidence**                          | Heading → Context Introduction → Evidence → Visitor Conclusion on every block              |
| **Observation precedes participation**               | Registration Gateway follows regional Evidence and Community Discovery                     |
| **Trust Through Verification**                       | Evidence traceable to public projections — honest empty states permitted                   |
| **Explainable Honesty**                              | Derived values labeled; no fabricated regional or community vibrancy                       |
| **Filter Instead of Duplicate**                      | Region scope filters datasets — block responsibilities stay distinct                       |
| **Communities are discovered through participation** | Community Discovery surfaces associations from civic activity — not admin catalog monopoly |

These principles inherit from Epic 01 Public Space architecture, Epic 02 Global Experience and Epic 03 Country Experience without regional exception.

Region pages reveal **one region's observable civic activity**.

They do not sell platform mythology or regional administrative promotion.

---

# 10. Final Statement

**Region pages present one region's observable civic activity while preparing visitors to discover communities created through participation.**

The template guarantees:

| Guarantee                 | Meaning                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Familiarity**           | Visitors recognize the same block sequence pattern they know from Country and Global Experience |
| **Scalability**           | Every region adopts one template — content and projections vary, structure does not             |
| **Long-term consistency** | Community Experience and future civic context extend — not fork — this composition              |
| **Community handoff**     | Community Discovery prepares Community Experience without absorbing Community scope             |

Region Experience is **Geographic Experience at Region scope** — not a separate regional portal.

The canonical layout, Context Before Evidence pattern, Community Discovery boundaries, and navigation rules in this document are the **structural contract** for all Region Experience pages in Version 1.

Implementation, visual design, and engineering must serve this template — not redefine it.

One Humanity.

Many Countries.

Many Regions.

Many Communities.

Shared Future.

---

**End of Document**
