# REGION EXPERIENCE CONTENT ARCHITECTURE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 04 — Region Experience

Version: 1.0

Status: Draft

Document Type: Content Architecture

---

# 1. Purpose

Define the **content architecture** of Region Experience.

This document specifies the **information responsibility** of every Region Experience block while preserving the Humanity Union Public Space architecture.

Region Experience presents **one region's civic reality** through the **same architectural language** as Country and Global Experience.

**Only geographic scope changes.**

Content architecture governs:

- titles and Context Introductions;
- factual information displayed at region scope;
- visitor questions answered;
- narrative position and neighbour relationships.

It does not govern:

- layout, grid, spacing or responsive composition;
- components, routes, APIs or data stores;
- visual design system tokens.

Reference:

- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/EPIC_03_ARCHITECTURE_FREEZE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`

Epic 03 frozen Country Experience content responsibility at Country scope.

This document frozen **content responsibility** per block at **Region scope**.

---

# Content before Layout

**Humanity Union always defines information responsibility before visual composition.**

Region Experience blocks must not receive copy invented to fit a layout.

Layouts must serve predefined content responsibility.

This discipline preserves Explainable Honesty and prevents regional promotional or administrative boosterism drift during implementation.

---

# 2. Canonical Block Sequence

Version 1 **Region Experience** block sequence is frozen for content responsibility.

Global chrome precedes page composition per Epic 01.

## Global chrome (required)

| Block                 | Architectural name   | Content responsibility                                 |
| --------------------- | -------------------- | ------------------------------------------------------ |
| Primary navigation    | Header               | Six frozen destinations — unchanged at region scope    |
| Scope control         | Geographic Navigator | Region active within Country; Country and World ascent |
| Supporting navigation | Footer               | Legal, transparency, secondary platform links          |

## Page composition (frozen order)

| Order | UI name (Region scope)          | Architectural block            | Narrative stage               |
| ----- | ------------------------------- | ------------------------------ | ----------------------------- |
| **1** | Region Identity                 | Hero · Geographic Summary      | Identity                      |
| **2** | Regional Interactive Map        | Interactive Map                | Evidence — geographic         |
| **3** | Regional Statistics             | Statistics (Region scope)      | Evidence — aggregate          |
| **4** | Regional Participation Pipeline | Initiative Levels              | Evidence — structure          |
| **5** | Latest Regional Initiatives     | Latest Initiatives             | Evidence — concrete           |
| **6** | Community Discovery             | Exploration (scope transition) | Exploration — community depth |
| **7** | Join Humanity Union             | Registration Gateway           | Participation                 |
| **8** | Footer                          | Footer                         | Supporting Navigation         |

## Sequence statement

**This sequence forms the canonical Region Experience content order.**

Block order is narrative order — not optional reordering at implementation.

Optional secondary block **About Preview** from Block Library remains **deferred** — not required in Version 1 Region Experience composition.

Optional **Trusted Regional Media** — if authorized in later architecture review — may slot as optional Exploration supporting Evidence between Latest Regional Initiatives and Community Discovery using same omission semantics as Trusted National Media at Country scope. Not part of Version 1 frozen sequence in this document.

## Block responsibility summary

| Block                               | One-sentence responsibility                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| **Region Identity**                 | Name the region within its country and orient the visitor within Humanity Union           |
| **Regional Interactive Map**        | Show civic activity geographically within the region and highlight community associations |
| **Regional Statistics**             | Summarize observable regional public participation indicators                             |
| **Regional Participation Pipeline** | Show regional distribution across pipeline stages                                         |
| **Latest Regional Initiatives**     | Present concrete regional initiative public examples                                      |
| **Community Discovery**             | Surface participant-created communities with public activity associated to the region     |
| **Registration Gateway**            | Offer voluntary registration after regional observation                                   |
| **Footer**                          | Provide supporting navigation and institutional transparency                              |

Architectural names govern engineering and reviews.

UI names govern visitor-facing labels where permitted by canonical naming registry.

---

# 3. Region Identity

**Architectural blocks:** Hero · Geographic Summary (page context)

## Purpose

Introduce **the region** as the visitor's current civic location **within its country** within Humanity Union — one primary regional identity message.

Orient the visitor regionally **without separating** the region from its country or from the global public square.

**Identity provides orientation rather than promotion.**

## Visitor questions answered

- Where am I?
- Which region's civic activity am I observing?
- Which country contains this region?
- How does this page relate to Humanity Union?

## Contains

| Element                         | Content responsibility                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Region name**                 | Primary Identity label — canonical from public-safe geographic metadata                                         |
| **Country name**                | Parent scope label — region always locatable within named country                                               |
| **Representative image**        | Optional Identity visual context — landscape or regional landmark; orientation only; policy-governed neutrality |
| **Region Context Introduction** | One or two calm sentences — why regional Evidence below matters within country and connected civic space        |
| **Scope label**                 | Region scope visible — Geographic Navigator alignment                                                           |
| **Humanity Union connection**   | Implicit or explicit framing that visitor remains in unified Public Space                                       |

## Context Introduction (direction)

_This page shows public civic activity associated with [Region] within [Country] in Humanity Union. Observation here is part of one connected national and global civic space._

Tone must match Epic 02 and Epic 03 Context Introduction discipline — significance without pressure.

## Information displayed

- region name and Region-scope page identity;
- country name as parent geographic context;
- optional restrained regional visual Identity elements;
- Context Introduction — not statistics, initiative lists, community catalogs or registration demands;
- optional calm link to About for platform trust depth — not registration;
- optional Geographic Summary line clarifying regional scope meaning.

## Information excluded

- regional statistics, pipeline counts, initiative catalogs, community directories;
- registration demands or urgency copy;
- administrative endorsement, regional ranking or certification language;
- language implying Region is identical to Community;
- language implying Humanity Union is a federation of separate regional platforms.

## Why this position

First narrative stage: **Region exists within country in Humanity Union.**

Visitor must understand **where they are regionally** before interpreting Evidence below.

## Neighbour relationships

| Neighbour                                 | Relationship                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| **Above (Header / Geographic Navigator)** | Chrome provides destinations and scope; Region Identity provides page meaning |
| **Below (Regional Interactive Map)**      | Identity names the region; Map shows first geographic Evidence within it      |
| **Country scope**                         | Ascent to Country Experience must remain conceptually available               |

Region Identity provides **orientation** — not **regional promotion**.

---

# 4. Regional Interactive Map

**Architectural block:** Interactive Map (UI: Regional Interactive Map)

## Purpose

Allow visitors to **understand the region geographically** — civic activity locatable within regional boundaries.

The map **highlights communities** with public associations and **supports transition toward Community Discovery** — not replacement of Community Experience.

## Visitor questions answered

- What is happening geographically inside this region?
- Where is civic activity present at local level within the region?
- Which communities have visible public association here?
- How does geography relate to community context below?

## Context Introduction (required)

_Public civic activity on Humanity Union is associated with places within [Region] in [Country]. The map shows where activity is visible at regional scope — including communities with public civic associations you may explore further._

Context explains **significance of map Evidence** — never replaces map data.

## Information displayed

- geographic distribution of public civic activity **within region scope**;
- community association markers or entry points where public projection metadata supports them;
- scope indication — Region lens active within Country;
- honest absence where no public activity or no community associations exist — not hidden defaults;
- no personal data, participant locations or operational internals.

## Information excluded

- aggregate counts duplicating Regional Statistics primary message in same screen region;
- full Community Discovery card content duplicated as primary map legend;
- operational geography or private location data;
- Community Experience page content — map provides **orientation and entry**, not replacement;
- Find Your Community search interface.

## Why this position

Second narrative stage: **Regional civic activity is locatable.**

Follows Region Identity with **geographic Evidence** inside the region.

## Neighbour relationships

| Neighbour                       | Relationship                                                                |
| ------------------------------- | --------------------------------------------------------------------------- |
| **Above (Region Identity)**     | Identity names region and country; Map shows observable geographic presence |
| **Below (Regional Statistics)** | Map shows _where_; Statistics summarize _how much_ regionally               |
| **Community Discovery**         | Map assists community association visibility — complementary, not competing |

## Context Before Evidence

**Mandatory:** Heading → Context Introduction → map Evidence → Visitor Conclusion.

---

# 5. Regional Statistics

**Architectural block:** Statistics — Region scope (UI: Regional Statistics)

## Purpose

Present **observable regional civic participation** — regional scale and presence made legible through honest aggregate public metrics.

## Visitor questions answered

- How much civic activity exists in this region?
- Is structured participation visibly present regionally?

## Context Introduction

_These figures summarize public civic activity associated with [Region] in [Country] on Humanity Union. Counts and indicators are computed from public records — derived values are labeled accordingly._

## Information displayed

Examples of approved public indicators at region scope:

| Indicator category                | Content rule                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Public initiatives**            | Count of initiatives visible at region scope from public projections                                                |
| **Participants**                  | Only public-safe aggregate participant indicators where projection rules explicitly permit — never private identity |
| **Civic activity indicators**     | High-level aggregates from Participation public statistics projection — labeled derived where applicable            |
| **Other approved public metrics** | Additional metrics defined in projection contracts — no ad hoc platform invention                                   |

Also displayed:

- scope label — Region name within Country;
- honest zero or low-activity presentation;
- no ranking of regions, engagement scores or unverifiable totals;
- no comparative regional virtue framing.

## Information excluded

- initiative titles or narrative — belongs to Latest Regional Initiatives;
- full community statistics — belongs to Community Experience;
- operational workspace totals;
- region-vs-region league tables within or across countries.

## Why this position

Third narrative stage begins: **Regional participation is measurable.**

Follows geographic orientation with **quantitative regional summary**.

## Neighbour relationships

| Neighbour                                   | Relationship                                                    |
| ------------------------------------------- | --------------------------------------------------------------- |
| **Above (Regional Interactive Map)**        | Map orients geographically; Statistics quantify regionally      |
| **Below (Regional Participation Pipeline)** | Statistics answer _how much_; Pipeline answers _at what stages_ |

## Context Before Evidence

**Mandatory.** Derived values **labeled derived** in Evidence layer. Platform presents Evidence — visitor forms conclusion independently.

---

# 6. Regional Participation Pipeline

**Architectural block:** Initiative Levels (UI: Regional Participation Pipeline)

## Purpose

Show **distribution of initiatives across participation stages inside the region** — pipeline structure visible at a glance.

## Visitor questions answered

- How is participation structured in this region?
- What stages of civic life are publicly visible here?
- What kinds of public activity are underway regionally?

## Context Introduction

_Participation on Humanity Union follows a structured civic path from proposal through collective action. This overview shows how many public initiatives are visible at each stage within [Region] in [Country]._

## Information displayed

- stage labels using **Capability 02 civic vocabulary** — Initiative, Collaborative Analysis, Collective Decision, Petition, Implementation Commitment, Implementation;
- count or proportion per stage at **region scope** from Participation Pipeline Public Projection;
- optional calm link to Initiatives destination or Knowledge process explanation — not registration;
- Impact stage omitted or marked future if no public data — not fabricated;
- no gamification, league tables or urgency framing.

**Pipeline remains identical across Humanity Union.**

Region scope **filters counts** — it does not **rename, reorder or shorten** the civic path.

## Information excluded

- full initiative cards — duplicates Latest Regional Initiatives;
- region-vs-region comparisons;
- registration pressure;
- community pipeline as substitute — community scope belongs to Community Experience.

## Why this position

Continues **Regional participation is measurable** — immediately after Regional Statistics.

## Neighbour relationships

| Neighbour                               | Relationship                                            |
| --------------------------------------- | ------------------------------------------------------- |
| **Above (Regional Statistics)**         | Statistics = magnitude; Pipeline = stage distribution   |
| **Below (Latest Regional Initiatives)** | Pipeline names path; Latest Initiatives shows instances |

## Context Before Evidence

**Mandatory.**

---

# 7. Latest Regional Initiatives

**Architectural block:** Latest Initiatives (UI: Latest Regional Initiatives)

## Purpose

Present **recent public initiatives occurring within the region** — concrete civic subjects on observable public paths.

## Visitor questions answered

- What is happening specifically in this region?
- What can I explore further without registering?
- Can I see real regional examples?

## Context Introduction

_These are recent public initiatives visible at regional scope within [Region] in [Country]. Each links to a public record of its civic path — you can read details without registering._

## Information displayed

- initiative subject title from Initiative Public Projection;
- current pipeline stage indicator — read-only, civic language;
- scope-relevant summary line — public-safe only;
- **link to Initiative public detail** — public projection page pattern;
- recency or curated ordering — transparent if curated;
- honest empty state if no initiatives at region scope.

## Information excluded

- operational fields, participant identity, private internals;
- repetition of Regional Statistics totals as primary message;
- create or edit actions;
- community Identity content as initiative substitute.

## Why this position

Fourth narrative stage: **Regional ideas become collective action.**

Abstract metrics become **concrete regional stories**.

## Neighbour relationships

| Neighbour                                   | Relationship                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| **Above (Regional Participation Pipeline)** | Pipeline explains stages; Latest Initiatives shows living examples            |
| **Below (Community Discovery)**             | Initiatives prove exploration open; Community Discovery extends local context |
| **Registration Gateway**                    | Initiatives precede invitation — narrative distance preserved                 |

**Cards navigate to public initiative pages** — Capability 03 presentation; Capability 02 public projection source.

## Context Before Evidence

**Mandatory.**

---

# 8. Community Discovery

**Architectural block:** Exploration — scope transition (UI: Community Discovery)

## Purpose

Help visitors **discover participant-created communities within the region** — preparing descent to Community Experience without implementing Community scope on the Region page.

**Community Discovery is not an administrator-maintained directory.**

**Communities appear through participation** — public projection associations surface communities that exist because civic activity created or named them.

## Visitor questions answered

- Which participant-created communities have public activity associated with this region?
- How is Community scope different from Region scope?
- How do I continue toward Community Experience?

## Context Introduction

_Communities on Humanity Union are named through civic participation — not fixed administrative lists. Below are participant-created communities with public activity associated with [Region]. Select one to observe community-scoped civic activity — or continue to Find Your Community when you are ready for broader discovery._

Context must clarify **Region ≠ Community** — geographic filter vs participant-named civic context.

## Display

Each community entry may present **public-safe summary fields only**:

| Field                            | Content responsibility                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Community Name**               | Participant-provided primary public identifier from Community record                                                                                                |
| **Short Description**            | Participant-provided public Description — concise display, not full Community Identity block                                                                        |
| **Activity Area**                | Governed discovery filter dimension — separate from Community naming; must not duplicate Description keywords without additive value per Community Context Decision |
| **Public statistics**            | Summary-level public participation indicators associated with community — e.g. initiative count or stage presence — not full Community Statistics block duplication |
| **Link to Community Experience** | Entry to community-scoped public observation when Community Experience exists                                                                                       |

## Information displayed

- list or card set of communities with **public activity associated to region** from public projections;
- honest empty state when no associated communities exist — not fabricated communities;
- optional calm cross-link toward **Find Your Community** on Community Experience — not embedded search on Region page;
- scope transition explanation — Community Experience is next observation level.

## Information excluded

- **Find Your Community** search field — Community Experience block 1, not Region composition;
- administrator-only community catalog presented as exhaustive truth;
- mandatory Community type taxonomy or classification UI;
- full Community Identity, Community Pipeline or Latest Community Initiatives blocks;
- community operational internals or participant identity;
- duplicate Latest Regional Initiatives content under community labels;
- language equating administrative region boundary with Community boundary.

## Why this position

Fifth narrative stage: **Local civic context is discoverable through participation.**

Regional Evidence completes; **Community Discovery prepares** next scope — it does not **complete** Community observation.

## Neighbour relationships

| Neighbour                               | Relationship                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Above (Latest Regional Initiatives)** | Initiatives show concrete paths; Community Discovery introduces participant-named local context                  |
| **Below (Registration Gateway)**        | Community preparation precedes participation invitation                                                          |
| **Regional Interactive Map**            | Map may highlight same associations — complementary, not duplicate primary lists without distinct responsibility |
| **Community Experience**                | Discovery links forward — Community Experience owns full community-scoped blocks                                 |

## Context Before Evidence

**Mandatory.**

---

# 9. Registration Gateway

**Architectural block:** Registration Gateway (UI: Join Humanity Union display label permitted)

## Purpose

**Invite participation after understanding** — calm registration entry after regional Evidence and Community Discovery weight.

## Visitor questions answered

- How do I participate if I choose to?
- Must I register to continue exploring this region's public information?

## Context Introduction

_You can explore public civic activity in [Region] without an account. Registration allows you to take part in structured participation when you are ready._

## Information displayed

- calm invitation — what registration enables in civic terms;
- single primary registration entry action when Identity route exists; honest placeholder when not;
- no urgency, guilt, countdown or limited-access language;
- no restatement of statistics, initiatives or community lists — invitation only;
- optional About link for trust evaluation — placeholder permitted until About ships.

## Information excluded

- regional statistics, initiative catalogs, pipeline detail, community directories;
- pressure tied to region identity or representative image;
- duplicate footer legal conversion.

## Why this position

Sixth narrative stage regionally: **You may participate.**

Last narrative block before Footer.

**Participation remains voluntary.**

**The same architectural principles as Global and Country Experience apply** — narrative distance from Hero preserved.

## Neighbour relationships

| Neighbour                                         | Relationship                                          |
| ------------------------------------------------- | ----------------------------------------------------- |
| **Above (Community Discovery / Evidence blocks)** | Regional observation precedes invitation              |
| **Below (Footer)**                                | Gateway invites; Footer supports — sequential closure |

## Context Before Evidence

**Mandatory** — Context Introduction precedes registration action Evidence.

---

# 10. Footer

**Architectural block:** Footer

## Purpose

Provide **supporting navigation and transparency** — stable closure of Region Experience.

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

**Reuse Humanity Union footer architecture** — identical responsibility at all geographic scopes.

Region scope does not fork footer structure.

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

# 11. Context Before Evidence

Every Region Experience block follows:

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
| **Heading**              | Block title — identifies subject at region scope                           |
| **Context Introduction** | Explains why this block's Evidence matters regionally — without persuasion |
| **Evidence**             | Public projection data or public-safe configuration — read-only            |
| **Visitor Conclusion**   | Visitor judges — platform does not conclude for them                       |

**No exceptions.**

Context Introduction:

- explains significance — never persuades;
- never replaces Evidence;
- remains concise;
- matches Epic 02 and Epic 03 tone discipline regionally.

Evidence:

- originates from responsible Capabilities through **public projections** filtered to region;
- includes **derived** values labeled derived;
- permits honest empty or sparse regional states;
- never fabricates activity to appear regionally vibrant.

Registration Gateway Context Introduction precedes invitation action — not Region Identity Hero.

Community Discovery Context Introduction must clarify **Region vs Community scope** before community association Evidence.

---

# 12. Relationship with Country Experience

Region Experience **inherits Country Experience architecture**.

Epic 03 Country Experience is the **direct parent reference**.

| Country Experience (Country)    | Region Experience (Region)      |
| ------------------------------- | ------------------------------- |
| Country Identity                | Region Identity                 |
| National Interactive Map        | Regional Interactive Map        |
| National Statistics             | Regional Statistics             |
| National Participation Pipeline | Regional Participation Pipeline |
| Latest National Initiatives     | Latest Regional Initiatives     |
| Regional Exploration            | Community Discovery             |
| Registration Gateway            | Registration Gateway            |
| Footer                          | Footer                          |

**Only public datasets and geographic scope change.**

| Unchanged                                 | Changed                                 |
| ----------------------------------------- | --------------------------------------- |
| Block sequence pattern and responsibility | Scope parameter — Region within Country |
| Header six destinations                   | Identity and Context copy               |
| Projection boundary                       | Filtered projection datasets            |
| Context Before Evidence                   | Regional Context Introductions          |
| Registration ethics                       | Region and country names in calm copy   |
| Interaction philosophy                    | Community entry from region             |
| Footer architecture                       | None                                    |
| Pipeline vocabulary                       | None — filter only                      |

```
Country Experience + region scope parameter → Region Experience
```

Epic 03 Country Experience is the **reference** for block behaviour at national scope.

Epic 04 content architecture is the **regional adaptation** of that reference.

Region Experience must not re-implement national Evidence — visitor arrives from Country with national context available through ascent.

---

# 13. Relationship with Community Experience

**Community Discovery prepares visitors for Community Experience.**

**Community Experience becomes the first public space focused on one participant-created community.**

Per `COMMUNITY_CONTEXT_DECISION.md`:

| Region Experience                                   | Community Experience                          |
| --------------------------------------------------- | --------------------------------------------- |
| Geographic/administrative filter within country     | Participant-named civic context               |
| Community Discovery — associated communities listed | Find Your Community — participant name search |
| Prepares Community descent                          | Completes local observation                   |
| Regional Statistics                                 | Community Statistics                          |
| Does not host Community blocks                      | Full Community block composition              |

## Handoff rules

| Rule                         | Application                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------ |
| **Link forward**             | Community Discovery links to Community Experience at selected community scope  |
| **No search duplication**    | Find Your Community remains Community Experience primary discovery path        |
| **No scope collapse**        | Region page must not impersonate Community page                                |
| **Organic communities only** | Displayed communities exist through participation — not admin catalog monopoly |
| **Ascent preserved**         | Community Experience links upward to Region, Country and World                 |

Region answers **what is happening in this region**.

Community Experience answers **what is happening around this community**.

Region **prepares**.

Community **completes** local public observation before optional Workspace participation.

---

# 14. Future Evolution

Future **local administrative depth** — district, municipality, city, village, neighbourhood, Indigenous Territory — **continues through Community Experience rather than Region Experience** in Version 1 architectural intent.

```
Region Experience block architecture

+ community scope parameter

= Community Experience
```

| Future capability                | Evolution path                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Community Experience**         | Inherits Region handoff — participant-named scope; Find Your Community entry                                    |
| **Deeper administrative levels** | Do not multiply Region page templates — civic context expressed through Community or future Architecture Review |
| **Trusted Regional Media**       | Optional Exploration block — Architecture Review if added                                                       |
| **About Preview**                | Optional deferred block — Architecture Review only                                                              |

**No redesign required** for Community Experience extension from Region template discipline.

New blocks require Block Library entry and Architecture Review.

Canonical flow sequence and Context Before Evidence **must be preserved**.

Forbidden:

- RegionPageContentArchitecture as separate standard replacing this document's structure;
- region scope introducing registration pressure patterns absent at World scope;
- geographic content fork breaking Filter Instead of Duplicate;
- absorbing Find Your Community into Region page through implementation convenience.

---

# 15. Final Statement

**Region Experience presents one region's observable civic reality while guiding visitors toward real communities created through civic participation.**

Visitors should **immediately recognize the familiar structure** — block order, Context Before Evidence, calm registration ethics, projection-backed Evidence — while **naturally understanding** that information is filtered to **one region's public civic space within one country**.

Region content architecture does not redefine Public Space.

It **focuses** Public Space regionally.

Downstream artifacts — interaction architecture, page template standard, alignment documents, architecture review, architecture freeze and implementation plan — must conform to this document and frozen Epic 01, Epic 02 and Epic 03 documents.

**This document does not define layout.**

**This document does not define implementation.**

It defines **what Region Experience means** in public language at regional scope.

One Humanity.

Many Countries.

Many Regions.

Many Communities.

Shared Future.

---

# Data and Copy Discipline

| Rule                       | Application                                                                       |
| -------------------------- | --------------------------------------------------------------------------------- |
| Presentation only          | Blocks display; Capabilities own business truth                                   |
| Derived labeling           | Computed public indicators labeled derived in Evidence                            |
| No fabrication             | Empty regional states honest; no fabricated communities                           |
| No persuasion              | Context Introductions explain — never sell regional boosterism                    |
| Civic vocabulary           | Capability 02 stage names — not product synonyms                                  |
| Public projection boundary | No operational fields in any block Evidence                                       |
| Scope labeling             | Region and Country names visible on aggregate Evidence                            |
| Community boundary         | Community Discovery surfaces associations — does not own Community business truth |

Source mapping: `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md` · `CAPABILITY_02_PROJECTION_INTEGRATION.md`

---

# References

| Document                                | Path                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Discovery Session 01                    | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/DISCOVERY_SESSION_01.md`                     |
| Region Experience Vision                | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_VISION.md`                 |
| Region Experience Narrative             | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_NARRATIVE.md`              |
| Epic 03 Architecture Freeze             | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/EPIC_03_ARCHITECTURE_FREEZE.md`             |
| Community Context Decision              | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`              |
| Country Experience Content Architecture | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md` |
| Public Page Template Standard           | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`            |
| Experience Block Library                | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`          |
| Capability 02 Projection Integration    | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/CAPABILITY_02_PROJECTION_INTEGRATION.md`     |

---

# Document Status

**Draft**

Region Experience Content Architecture — Epic 04

Interaction architecture and page specification may proceed after content architecture approval.

Implementation is **not authorized** by this document.
