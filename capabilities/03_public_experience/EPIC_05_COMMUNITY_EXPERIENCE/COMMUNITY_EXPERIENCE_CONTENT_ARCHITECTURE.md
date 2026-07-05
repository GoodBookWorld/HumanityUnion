# COMMUNITY EXPERIENCE CONTENT ARCHITECTURE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 05 — Community Experience

Version: 1.0

Status: Draft

Document Type: Content Architecture

---

# 1. Purpose

Define the **content architecture** of Community Experience.

This document specifies the **information responsibility** of every Community Experience block while preserving Humanity Union's unified Public Space architecture.

Community Experience presents the **observable civic reality of one participant-created community**.

**Only community context changes.**

**Humanity Union architectural language remains identical.**

Content architecture governs:

- titles and Context Introductions;
- factual information displayed at community scope;
- visitor questions answered;
- narrative position and neighbour relationships.

It does not govern:

- layout, grid, spacing or responsive composition;
- components, routes, APIs or data stores;
- visual design system tokens.

Reference:

- `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_DISCOVERY.md`
- `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/EPIC_04_ARCHITECTURE_FREEZE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`

Epic 04 frozen Region Experience content responsibility at Region scope.

This document frozen **content responsibility** per block at **Community scope**.

---

# Content before Layout

**Humanity Union always defines information responsibility before visual composition.**

Community Experience blocks must not receive copy invented to fit a layout.

Layouts must serve predefined content responsibility.

This discipline preserves Explainable Honesty and prevents community promotional or organizational boosterism drift during implementation.

---

# 2. Canonical Block Sequence

Version 1 **Community Experience** block sequence is frozen for content responsibility.

Global chrome precedes page composition per Epic 01.

## Global chrome (required)

| Block                 | Architectural name   | Content responsibility                                                               |
| --------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| Primary navigation    | Header               | Six frozen destinations — unchanged at community scope                               |
| Scope control         | Geographic Navigator | Community active where metadata supports; Region, Country and World ascent preserved |
| Supporting navigation | Footer               | Legal, transparency, secondary platform links                                        |

## Page composition (frozen order)

| Order | UI name (Community scope)                   | Architectural block                     | Narrative stage                |
| ----- | ------------------------------------------- | --------------------------------------- | ------------------------------ |
| **1** | Community Identity                          | Hero · Community Summary                | Identity                       |
| **2** | Community Statistics                        | Statistics (Community scope)            | Evidence — aggregate           |
| **3** | Community Participation Pipeline            | Initiative Levels                       | Evidence — structure           |
| **4** | Latest Community Initiatives                | Latest Initiatives                      | Evidence — concrete            |
| **5** | Community Impact Overview                   | Evidence synthesis                      | Evidence — observable outcomes |
| **6** | Find Your Community                         | Exploration (cross-community discovery) | Exploration                    |
| **7** | Join Humanity Union / Continue to Workspace | Registration Gateway                    | Participation                  |
| **8** | Footer                                      | Footer                                  | Supporting Navigation          |

## Sequence statement

**This sequence forms the canonical Community Experience content order.**

Block order is narrative order — not optional reordering at implementation.

**No Interactive Map** is required in Version 1 Community Experience composition — per Epic 04 freeze and Community Experience discovery.

Optional secondary block **About Preview** from Block Library remains **deferred** — not required in Version 1 Community Experience composition.

Optional **Trusted Community Media** — if authorized in later architecture review — may slot as optional Exploration supporting Evidence using same omission semantics as Trusted Regional Media. Not part of Version 1 frozen sequence in this document.

## Discovery surface exception

When Community Experience serves a **discovery landing** before a community is selected, **Find Your Community** may appear **above Community Identity** as the sole composition on that surface. Once one community is selected for observation, the **frozen sequence above** governs content order without inversion.

## Block responsibility summary

| Block                                | One-sentence responsibility                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| **Community Identity**               | Name the participant-created community and orient the visitor within Humanity Union |
| **Community Statistics**             | Summarize observable community-scoped public participation indicators               |
| **Community Participation Pipeline** | Show community distribution across pipeline stages                                  |
| **Latest Community Initiatives**     | Present concrete community-associated initiative public examples                    |
| **Community Impact Overview**        | Present evidence-based observable outcome signals — visitor judges impact           |
| **Find Your Community**              | Enable search of participant-created communities by name and description            |
| **Registration Gateway / Workspace** | Offer voluntary registration or governed Workspace continuation after observation   |
| **Footer**                           | Provide supporting navigation and institutional transparency                        |

Architectural names govern engineering and reviews.

UI names govern visitor-facing labels where permitted by canonical naming registry.

---

# 3. Community Identity

**Architectural blocks:** Hero · Community Summary (page context)

## Purpose

Introduce **the community** as the visitor's current **participant-created civic context** within Humanity Union — one primary community identity message.

Orient the visitor at community scope **without separating** the community from its region, country or global public square.

**Identity explains.**

**It does not promote.**

## Visitor questions answered

- Where am I?
- What is this community?
- Who named this civic context?
- How does this page relate to Humanity Union?

## Contains

| Element                   | Content responsibility                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Community Name**        | Primary Identity label — participant-provided public identifier from Capability 02 Community record                         |
| **Representative Image**  | Optional Identity visual context — community-associated imagery; orientation only; policy-governed neutrality               |
| **Community Description** | Participant-provided public explanation of shared civic purpose — primary Find Your Community search target                 |
| **Activity Area**         | Governed discovery filter dimension — separate from Community naming; must not duplicate Description without additive value |
| **Context Introduction**  | One or two calm sentences — why community Evidence below matters within connected civic space                               |

## Context Introduction (direction)

_This page shows public civic activity associated with [Community Name] — a participant-created community on Humanity Union. Observation here is part of one connected regional, national and global civic space._

Tone must match Epic 02, Epic 03 and Epic 04 Context Introduction discipline — significance without pressure.

## Information displayed

- Community Name and community-scope page identity;
- Community Description — public-safe, governed by content policy;
- Activity Area where applicable as Identity-adjacent discovery metadata — not substitute for Description;
- optional restrained community visual Identity elements;
- Context Introduction — not statistics, initiative lists, cross-community search or registration demands;
- optional calm link to About for platform trust depth — not registration;
- optional scope label and Geographic Navigator alignment — Region and Country ascent where metadata supports.

## Information excluded

- community statistics, pipeline counts, initiative catalogs, impact synthesis totals;
- registration demands or urgency copy;
- organizational endorsement, community ranking or platform certification language;
- private participant identity, member rosters or contact data;
- mandatory Community type taxonomy or classification badges;
- language implying Community is identical to Region administrative boundary;
- language implying Humanity Union owns or operates the community as an organization.

## Why this position

First narrative stage: **Community exists as participant-named civic context in Humanity Union.**

Visitor must understand **who this community is** before interpreting Evidence below.

## Neighbour relationships

| Neighbour                                 | Relationship                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| **Above (Header / Geographic Navigator)** | Chrome provides destinations and scope; Community Identity provides page meaning       |
| **Below (Community Statistics)**          | Identity names the community; Statistics show first quantitative Evidence              |
| **Region scope**                          | Ascent to Region Experience must remain conceptually available where metadata supports |

Community Identity provides **orientation** — not **organizational promotion**.

---

# 4. Community Statistics

**Architectural block:** Statistics — Community scope (UI: Community Statistics)

## Purpose

Present **observable community participation** — community scale and presence made legible through honest aggregate public metrics.

## Visitor questions answered

- How much civic activity exists around this community?
- Is structured participation visibly present at community scope?

## Context Introduction

_These figures summarize public civic activity associated with [Community Name] on Humanity Union. Counts and indicators are computed from public records — derived values are labeled accordingly._

## Information displayed

Examples of approved public indicators at community scope:

| Indicator category    | Content rule                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Participants**      | Public-safe aggregate participant indicators where projection rules explicitly permit — never private identity; small-count suppression where policy requires                  |
| **Initiatives**       | Count of initiatives visible at community association scope from public projections                                                                                            |
| **Achievements**      | Observable advanced-stage or implementation-visible indicators where projection contracts define public-safe achievement aggregates — labeled derived; never fabricated badges |
| **Evidence**          | High-level evidence counts from public projections — e.g. public record presence — no ad hoc platform invention                                                                |
| **Public indicators** | Additional metrics from Participation Public Statistics Projection — community filter — labeled derived where applicable                                                       |

Also displayed:

- scope label — Community Name;
- honest zero or low-activity presentation;
- no ranking of communities, engagement scores or unverifiable totals;
- no comparative community virtue framing.

## Information excluded

- initiative titles or narrative — belongs to Latest Community Initiatives;
- full cross-community statistics — belongs to Find Your Community result summaries only at search-result granularity;
- operational workspace totals;
- community-vs-community league tables;
- subjective impact evaluation — belongs to Visitor Conclusion in Community Impact Overview, not Statistics primary message.

## Projection source

Participation Public Statistics Projection — **community association filter**.

Capability 03 orchestrates and filters.

Capability 02 owns projection truth.

## Why this position

Second narrative stage: **Community participation is measurable.**

Follows Community Identity with **quantitative community summary**.

## Neighbour relationships

| Neighbour                                    | Relationship                                                    |
| -------------------------------------------- | --------------------------------------------------------------- |
| **Above (Community Identity)**               | Identity names community; Statistics quantify observably        |
| **Below (Community Participation Pipeline)** | Statistics answer _how much_; Pipeline answers _at what stages_ |

## Context Before Evidence

**Mandatory:** Heading → Context Introduction → Statistics Evidence → Visitor Conclusion.

Derived values **labeled derived** in Evidence layer. Platform presents Evidence — visitor forms conclusion independently.

---

# 5. Community Participation Pipeline

**Architectural block:** Initiative Levels (UI: Community Participation Pipeline)

## Purpose

Show **distribution of initiatives across participation stages inside the community** — pipeline structure visible at a glance.

## Visitor questions answered

- How is participation structured around this community?
- What stages of civic life are publicly visible here?
- What kinds of public activity are underway at community scope?

## Context Introduction

_Participation on Humanity Union follows a structured civic path from proposal through collective action. This overview shows how many public initiatives are visible at each stage associated with [Community Name]._

## Information displayed

- stage labels using **Capability 02 civic vocabulary** — Initiative, Collaborative Analysis, Collective Decision, Petition, Implementation Commitment, Implementation;
- count or proportion per stage at **community scope** from Participation Pipeline Public Projection;
- optional calm link to Initiatives destination or Knowledge process explanation — not registration;
- Impact stage omitted or marked future if no public data — not fabricated;
- no gamification, league tables or urgency framing.

**Pipeline remains identical across Humanity Union.**

**Only projection data changes.**

Community scope **filters counts** — it does not **rename, reorder or shorten** the civic path.

## Information excluded

- full initiative cards — duplicates Latest Community Initiatives;
- community-vs-community comparisons;
- registration pressure;
- regional pipeline as substitute — region scope belongs to Region Experience.

## Projection source

Participation Pipeline Public Projection — **community association filter**.

## Why this position

Continues **Community participation is measurable** — immediately after Community Statistics.

## Neighbour relationships

| Neighbour                                | Relationship                                            |
| ---------------------------------------- | ------------------------------------------------------- |
| **Above (Community Statistics)**         | Statistics = magnitude; Pipeline = stage distribution   |
| **Below (Latest Community Initiatives)** | Pipeline names path; Latest Initiatives shows instances |

## Context Before Evidence

**Mandatory.**

---

# 6. Latest Community Initiatives

**Architectural block:** Latest Initiatives (UI: Latest Community Initiatives)

## Purpose

Present **recent initiatives created or associated within this community** — concrete civic subjects on observable public paths.

## Visitor questions answered

- What is happening specifically around this community?
- What can I explore further without registering?
- Can I see real community-associated examples?

## Context Introduction

_These are recent public initiatives associated with [Community Name] on Humanity Union. Each links to a public record of its civic path — you can read details without registering._

## Information displayed

- initiative subject title from Initiative Public Projection;
- current pipeline stage indicator — read-only, civic language;
- scope-relevant summary line — public-safe only;
- **link to Initiative public detail** — public projection page pattern;
- recency or curated ordering — transparent if curated;
- honest empty state if no initiatives at community association scope.

## Information excluded

- operational fields, participant identity, private internals;
- repetition of Community Statistics totals as primary message;
- create or edit actions;
- community Identity content as initiative substitute;
- platform editorial endorsement of initiatives.

## Why this position

Fourth narrative stage: **Community ideas become collective action.**

Abstract metrics become **concrete community-associated stories**.

## Neighbour relationships

| Neighbour                                    | Relationship                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Above (Community Participation Pipeline)** | Pipeline explains stages; Latest Initiatives shows living examples                    |
| **Below (Community Impact Overview)**        | Initiatives supply instance Evidence; Impact Overview synthesizes observable outcomes |
| **Registration Gateway**                     | Initiatives precede invitation — narrative distance preserved                         |

**Cards navigate to public initiative pages** — Capability 03 presentation; Capability 02 public projection source.

## Projection source

Initiative Public Projection — **community association filter**.

## Context Before Evidence

**Mandatory.**

---

# 7. Community Impact Overview

**Architectural block:** Evidence synthesis (UI: Community Impact Overview)

## Purpose

Summarize **observable public contribution** at community scope — evidence-based outcome signals drawn from public projections already presented upstream.

**No subjective evaluation.**

Platform presents **observable signals**.

Visitor forms **impact understanding** through Visitor Conclusion — platform does not declare community success, failure or organizational effectiveness.

## Visitor questions answered

- What observable outcomes can I infer from public evidence around this community?
- Are there completed or advanced-stage initiatives visible publicly?
- How has participation trended — honestly, where data permits?

## Context Introduction

_The indicators below summarize observable public outcomes associated with [Community Name] — derived from public civic records already visible on Humanity Union. They describe what is publicly observable — not a judgment of community worth._

## Information displayed

Examples of approved evidence-based impact signals:

| Signal category           | Content rule                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Completed initiatives** | Count or list reference of initiatives at advanced or implementation-visible stages from public projections — traceable to initiative detail |
| **Achievements**          | Public-safe achievement aggregates where projection contracts explicitly define them — labeled derived; never fabricated trophies            |
| **Evidence**              | Verifiable public record indicators — e.g. implementation commitment presence — no editorial scoring                                         |
| **Participation trends**  | Honest temporal aggregates where architecture permits — transparent aggregation; derived labeled; no predictive framing                      |
| **Collective outcomes**   | Observable collective indicators from public projections — e.g. stage progression summaries — never moral or political verdict copy          |

Also displayed:

- explicit **derived** labeling on computed values;
- honest sparse or zero outcome presentation;
- Visitor Conclusion layer inviting visitor judgment — not platform conclusion;
- optional calm links back to Latest Community Initiatives or initiative detail for verification.

## Information excluded

- subjective platform evaluation — community ranked, certified, endorsed or condemned;
- marketing impact reports replacing upstream Evidence blocks;
- operational workspace outcomes not in public projections;
- participant identity or private contribution attribution;
- duplicate full Statistics or Pipeline primary displays without distinct synthesis responsibility;
- registration pressure or Workspace entry copy — belongs to Registration Gateway.

## Why this position

Fifth narrative stage: **Observable outcomes become legible — visitor judges.**

Follows concrete initiative Evidence with **synthesis layer** before cross-community exploration and participation invitation.

Community Impact Overview **does not replace** Statistics, Pipeline or Latest Initiatives — it **aggregates observable outcome signals** with distinct synthesis responsibility.

## Neighbour relationships

| Neighbour                                | Relationship                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Above (Latest Community Initiatives)** | Initiatives provide verifiable instances; Impact Overview summarizes observable outcome patterns  |
| **Below (Find Your Community)**          | Observation synthesis precedes cross-community discovery                                          |
| **Community Statistics / Pipeline**      | Upstream Evidence sources — Impact Overview must not contradict or inflate upstream honest states |

## Context Before Evidence

**Mandatory:** Heading → Context Introduction → synthesis Evidence → Visitor Conclusion.

Visitor Conclusion is **essential** in this block — platform explicitly declines to conclude for the visitor.

---

# 8. Find Your Community

**Architectural block:** Exploration — cross-community discovery (UI: Find Your Community)

## Purpose

Allow visitors to **discover other participant-created communities** — search by Community Name and Community Description.

**Find Your Community searches participant-created communities.**

**It is not an administrator-maintained directory.**

Communities appear because **participation created or named them** — search surfaces public Community records, not platform-imposed civic taxonomy.

## Visitor questions answered

- How do I find another participant-created community?
- How is search different from Region Community Discovery?
- May I continue observing without selecting a community?

## Context Introduction

_Communities on Humanity Union are created through civic participation. Search below finds participant-created communities by name and description — not a fixed administrative catalog._

Context must clarify **Find Your Community = search** vs **Region Community Discovery = association browse**.

## Information displayed

- search input targeting **Community Name** and **Community Description** — public-safe fields only;
- search results presenting public-safe summary fields per result:

| Field                            | Content responsibility                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| **Community Name**               | Participant-provided primary public identifier                                       |
| **Short Description**            | Truncated or summary Description — not full Community Identity block                 |
| **Activity Area**                | Governed discovery filter — separate from naming                                     |
| **Public statistics**            | Summary-level indicators where permitted — not full Community Statistics duplication |
| **Link to Community Experience** | Entry to selected community-scoped observation                                       |

Also displayed:

- honest empty, sparse and duplicate-name result states — explainable, non-fabricated;
- voluntary interaction — no forced community selection before reading elsewhere on platform;
- optional calm note when visitor arrived from Region Community Discovery — search complements browse;
- no mandatory Community type taxonomy filter in Version 1.

## Information excluded

- administrator-only community catalog presented as exhaustive truth;
- private participant data or membership rosters;
- full Community page composition duplicated inside search results;
- Region Community Discovery browse UI duplicated as primary search substitute on Community page;
- operational Community management fields;
- ranking optimized for engagement metrics without explainable honesty.

## Why this position

Sixth narrative stage: **Other communities remain discoverable through participation.**

Follows completion of **this community's** observation arc — cross-community exploration before participation invitation.

On **discovery landing surfaces**, this block may precede Community Identity when no community is selected — see Section 2 discovery surface exception.

## Neighbour relationships

| Neighbour                                    | Relationship                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Above (Community Impact Overview)**        | This community observation complete; Find Your Community extends exploration                                                |
| **Below (Registration Gateway / Workspace)** | Cross-community discovery precedes participation invitation                                                                 |
| **Region Community Discovery**               | Region browse handoff — complementary, not duplicate search on Region page                                                  |
| **Community Identity**                       | Selected community Identity follows search on discovery surfaces; Identity precedes Evidence on community observation pages |

## Context Before Evidence

**Mandatory.**

Search interaction is Exploration Evidence — Context Introduction precedes search affordance.

---

# 9. Registration Gateway / Workspace

**Architectural block:** Registration Gateway (UI: Join Humanity Union display label permitted · Continue to Workspace when authenticated)

## Purpose

Complete Public Experience with **calm participation entry** after community observation.

| Visitor state                 | Content responsibility                                        |
| ----------------------------- | ------------------------------------------------------------- |
| **Unauthenticated visitor**   | Registration Gateway — voluntary registration invitation      |
| **Authenticated participant** | Continue to Workspace — governed personal participation entry |

**Participation remains voluntary.**

Public reading never required an account.

## Visitor questions answered

- How do I participate personally if I choose?
- Must I register to continue exploring this community's public information?
- What changes when I enter Workspace?

## Context Introduction (unauthenticated)

_You can explore public civic activity around [Community Name] without an account. Registration allows you to take part in structured participation when you are ready._

## Context Introduction (authenticated)

_You can continue exploring public civic activity here, or enter your Workspace to participate personally in structured civic action when you choose._

## Information displayed

### Registration Gateway (unauthenticated)

- calm invitation — what registration enables in civic terms;
- single primary registration entry action when Identity route exists; honest placeholder when not;
- no urgency, guilt, countdown or limited-access language;
- no restatement of statistics, initiatives, impact signals or community search results — invitation only;
- optional About link for trust evaluation — placeholder permitted until About ships.

### Continue to Workspace (authenticated)

- calm explanation of Workspace as **personal operational environment** — distinct from public observation;
- single primary Workspace entry action when governed route exists; honest placeholder when not;
- no pressure to enter Workspace immediately;
- no duplication of Registration Gateway when visitor already authenticated — Workspace continuation only.

## Information excluded

- community statistics, initiative catalogs, pipeline detail, impact synthesis, Find Your Community results;
- pressure tied to community Identity or representative image;
- organizational membership recruitment copy;
- duplicate footer legal conversion;
- operational Workspace internals previewed in Public Space.

## Why this position

Seventh narrative stage: **You may participate personally — optionally.**

Last narrative block before Footer.

Community Experience **completes Public Experience** at this boundary.

Workspace is **not** a Public Space block — it is the **first personal operational level** entered through governed continuation.

## Neighbour relationships

| Neighbour                                         | Relationship                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Above (Find Your Community / Evidence blocks)** | Community observation precedes invitation                                       |
| **Below (Footer)**                                | Gateway or Workspace continuation invites; Footer supports — sequential closure |
| **Workspace**                                     | Architectural boundary — personal participation beyond Public Space             |

## Context Before Evidence

**Mandatory** — Context Introduction precedes registration or Workspace continuation action Evidence.

---

# 10. Footer

**Architectural block:** Footer

## Purpose

Provide **supporting navigation and transparency** — stable closure of Community Experience.

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

**Reuse Humanity Union footer architecture** — identical responsibility at all scopes.

Community scope does not fork footer structure.

Only link **availability** may vary during progressive platform bootstrap — placeholders must be clearly marked.

## Why this position

Persistent global chrome — page closure after narrative completion.

## Neighbour relationships

| Neighbour                                    | Relationship                                                    |
| -------------------------------------------- | --------------------------------------------------------------- |
| **Above (Registration Gateway / Workspace)** | Sequential closure — not conversion stack                       |
| **Header**                                   | Primary discovery vs supporting resources — hierarchy preserved |

## Context Before Evidence

Footer Context Introduction may be brief supporting copy — Evidence layer is link list, not civic aggregates.

---

# 11. Context Before Evidence

Every Community Experience block follows:

```
Heading

↓

Context Introduction

↓

Evidence

↓

Visitor Conclusion
```

| Layer                    | Role                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| **Heading**              | Block title — identifies subject at community scope                                      |
| **Context Introduction** | Explains why this block's Evidence matters at community scope — without persuasion       |
| **Evidence**             | Public projection data, public-safe configuration or governed search results — read-only |
| **Visitor Conclusion**   | Visitor judges — platform does not conclude for them                                     |

**No exceptions.**

Context Introduction:

- explains significance — never persuades;
- never replaces Evidence;
- remains concise;
- matches Epic 02, Epic 03 and Epic 04 tone discipline at community scope.

Evidence:

- originates from responsible Capabilities through **public projections** filtered to community association;
- includes **derived** values labeled derived;
- permits honest empty or sparse community states;
- never fabricates activity to appear community vibrant.

Registration Gateway Context Introduction precedes invitation action — not Community Identity Hero.

Find Your Community Context Introduction must clarify **participant-created search** before search Evidence.

Community Impact Overview **requires** Visitor Conclusion — platform explicitly declines subjective evaluation in Evidence layer.

---

# 12. Relationship with Region Experience

Community Experience **inherits Region Experience architecture**.

Epic 04 Region Experience is the **direct geographic parent reference**.

| Region Experience (Region)      | Community Experience (Community) |
| ------------------------------- | -------------------------------- |
| Region Identity                 | Community Identity               |
| Regional Interactive Map        | **No map required in Version 1** |
| Regional Statistics             | Community Statistics             |
| Regional Participation Pipeline | Community Participation Pipeline |
| Latest Regional Initiatives     | Latest Community Initiatives     |
| Community Discovery             | Find Your Community              |
| —                               | Community Impact Overview        |
| Registration Gateway            | Registration Gateway / Workspace |
| Footer                          | Footer                           |

**Community Discovery transitions into Find Your Community.**

| Handoff element                | Rule                                                                    |
| ------------------------------ | ----------------------------------------------------------------------- |
| **Region Community Discovery** | Association browse — prepares Community descent                         |
| **Find Your Community**        | Name and Description search — Community Experience exclusive            |
| **Link forward**               | Community Discovery links to Community Experience at selected community |
| **No search duplication**      | Find Your Community not hosted on Region page                           |
| **No scope collapse**          | Community page must not impersonate Region page                         |
| **Ascent preserved**           | Community Experience links upward to Region, Country and World          |

**Only public datasets and civic context change.**

| Unchanged                                 | Changed                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Block sequence pattern and responsibility | Scope parameter — participant-created community                        |
| Header six destinations                   | Identity and Context copy                                              |
| Projection boundary                       | Filtered projection datasets — community association                   |
| Context Before Evidence                   | Community Context Introductions                                        |
| Registration ethics                       | Community Name in calm copy; Workspace continuation when authenticated |
| Interaction philosophy                    | Find Your Community entry from Region handoff                          |
| Footer architecture                       | None                                                                   |
| Pipeline vocabulary                       | None — filter only                                                     |

```
Region Experience + community scope parameter + participant Identity → Community Experience
```

Region answers **what is happening in this region**.

Community Experience answers **what is happening around this community**.

Region **prepares**.

Community **completes** local public observation before optional Workspace participation.

---

# 13. Relationship with Workspace

**Community Experience completes Public Experience.**

**Workspace begins personal participation.**

The architectural boundary remains explicit.

| Community Experience                                  | Workspace                                               |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Public observation of community-scoped civic activity | Personal accountable civic action                       |
| Read without account                                  | Governed authenticated environment                      |
| Projection-backed Evidence blocks                     | Operational Capability 02 workspaces                    |
| Registration Gateway or Continue to Workspace copy    | Workspace operational UI — not Public Space composition |
| Capability 03 composes public understanding           | Participant contributes personally                      |

## Boundary rules

| Rule                        | Application                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------- |
| **Observation first**       | All Evidence blocks readable without Workspace entry                               |
| **Voluntary transition**    | Registration Gateway and Workspace continuation calm — never urgent                |
| **No Public Space leakage** | Workspace operational fields never appear in Community Evidence blocks             |
| **No Workspace gating**     | Public initiative detail remains readable without Workspace                        |
| **Explainable copy**        | Workspace continuation explains personal participation — not organizational signup |
| **Valid stop point**        | Visitor may complete Community observation without entering Workspace              |

Community Experience is the **last public page class** in the frozen hierarchy.

Workspace is the **first personal environment** — entered only through governed continuation after sufficient public context.

---

# 14. Future Evolution

Future Community Experience capabilities may extend observable community civic life **without redesigning Version 1 architecture**.

| Future capability                      | Evolution path                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Community collections**              | Optional Exploration or Evidence extension — curated public groupings of communities; Architecture Review required                      |
| **Community achievements**             | Optional Evidence extension — public-safe achievement presentation beyond Version 1 aggregates; projection contract first               |
| **Community recognition**              | Optional supporting block — institutional or peer recognition where public-safe; never subjective platform scoring in Version 1 pattern |
| **Community collaboration**            | Optional Exploration extension — cross-community public initiative associations; Architecture Review required                           |
| **Trusted Community Media**            | Optional Exploration block — same omission semantics as Trusted Regional Media                                                          |
| **Interactive Map at community scope** | Optional Evidence block — Architecture Review if added; not Version 1 requirement                                                       |
| **About Preview**                      | Optional deferred block — Architecture Review only                                                                                      |

**No redesign required** for future extensions from Community template discipline.

New blocks require Block Library entry and Architecture Review.

Canonical flow sequence and Context Before Evidence **must be preserved**.

Forbidden:

- CommunityPageContentArchitecture as separate standard replacing this document's structure;
- community scope introducing registration pressure patterns absent at World scope;
- civic content fork breaking Filter Instead of Duplicate;
- absorbing Find Your Community into Region page through implementation convenience;
- Community Impact Overview becoming subjective platform rating block.

---

# 15. Final Statement

**Community Experience presents one participant-created community through Humanity Union's unified architectural language.**

It **completes the Public Experience hierarchy** by connecting observable civic life with personal participation — calmly, voluntarily and verifiably.

Visitors should **immediately recognize the familiar structure** — block order, Context Before Evidence, calm registration ethics, projection-backed Evidence — while **naturally understanding** that information is filtered to **one participant-created community's public civic space**.

Community content architecture does not redefine Public Space.

It **focuses** Public Space at participant-named civic context.

Downstream artifacts — interaction architecture, page template standard, alignment documents, architecture review, architecture freeze and implementation plan — must conform to this document and frozen Epic 01 through Epic 04 documents and `COMMUNITY_CONTEXT_DECISION.md`.

**This document does not define layout.**

**This document does not define implementation.**

It defines **what Community Experience means** in public language at community scope.

One Humanity.

Many Countries.

Many Regions.

Many Communities.

Shared Future.

---

# Data and Copy Discipline

| Rule                       | Application                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Presentation only          | Blocks display; Capabilities own business truth                                              |
| Derived labeling           | Computed public indicators labeled derived in Evidence                                       |
| No fabrication             | Empty community states honest; no fabricated communities or vibrancy                         |
| No persuasion              | Context Introductions explain — never sell community boosterism                              |
| Civic vocabulary           | Capability 02 stage names — not product synonyms                                             |
| Public projection boundary | No operational fields in any block Evidence                                                  |
| Scope labeling             | Community Name visible on aggregate Evidence                                                 |
| Community boundary         | Capability 02 owns Community record truth and association rules                              |
| Search honesty             | Find Your Community results reflect participant-created records — not admin catalog fiction  |
| Impact honesty             | Community Impact Overview presents observable signals — never platform subjective evaluation |

## Projection source summary

| Block                            | Projection source                                                               |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Community Statistics             | Participation Public Statistics Projection — community filter                   |
| Community Participation Pipeline | Participation Pipeline Public Projection — community filter                     |
| Latest Community Initiatives     | Initiative Public Projection — community association filter                     |
| Community Impact Overview        | Derived synthesis from permitted public projections — no new operational source |
| Find Your Community              | Community public record search — Capability 02 governed public fields           |
| Registration Gateway             | Registration entry metadata — Capability 01 Identity / Registration             |
| Continue to Workspace            | Workspace entry metadata — governed route only                                  |

Source mapping: `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md` · `CAPABILITY_02_PROJECTION_INTEGRATION.md`

Capability 03 **orchestrates and filters**.

Capability 03 **does not** access operational aggregates or workspace internals.

---

# References

| Document                               | Path                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Community Experience Discovery         | `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_DISCOVERY.md`      |
| Community Experience Vision            | `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_VISION.md`         |
| Community Experience Narrative         | `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_NARRATIVE.md`      |
| Epic 04 Architecture Freeze            | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/EPIC_04_ARCHITECTURE_FREEZE.md`            |
| Epic 03 Architecture Freeze            | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/EPIC_03_ARCHITECTURE_FREEZE.md`           |
| Community Context Decision             | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`            |
| Public Page Template Standard          | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`          |
| Public Experience Block Library        | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`        |
| Region Experience Content Architecture | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_CONTENT_ARCHITECTURE.md` |
| Capability 02 Projection Integration   | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/CAPABILITY_02_PROJECTION_INTEGRATION.md`   |

---

# Document Status

**Draft**

Community Experience Content Architecture — Epic 05

Interaction architecture and page template standard may proceed after content architecture approval.

Implementation is **not authorized** by this document.
