# COMMUNITY PAGE TEMPLATE STANDARD

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 05 — Community Experience

Version: 1.0

Status: Draft

Document Type: Page Template Standard

---

# 1. Purpose

Define the **canonical page template** for all Community Experience pages.

**Community pages share one architectural language regardless of community purpose, size, or location.**

**Only community-specific public information changes.**

This template ensures every participant-created community presents its public civic activity through **Humanity Union's unified Public Space architecture** — the community expression of the same page template Region Experience established at regional scope, Country Experience at national scope, and Public Page Template Standard at World scope.

This document governs:

- the frozen Version 1 block sequence for Community Experience;
- structural responsibility of each Experience Block on a community page;
- the Context Before Evidence pattern every block must follow;
- navigation descent and ascent rules at community scope;
- Find Your Community and Workspace Transition boundaries;
- future compatibility without structural redesign.

This standard is **architectural composition** — not visual design, not CSS, not frontend components, not routes or APIs.

Reference:

- `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`
- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_PAGE_TEMPLATE_STANDARD.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`

Content architecture defines **what** each block communicates at community scope.

Interaction architecture defines **how** visitor interactions unfold across blocks.

This document defines **page composition** — the structural template every Community Experience page must follow.

---

# 2. Canonical Layout

Version 1 **Community Experience** page sequence is **frozen**.

Global chrome precedes page composition per Epic 01 and `PUBLIC_PAGE_TEMPLATE_STANDARD.md`.

## Global chrome (required)

| Element                  | Architectural responsibility                                                         |
| ------------------------ | ------------------------------------------------------------------------------------ |
| **Header**               | Six frozen primary destinations — unchanged at community scope                       |
| **Geographic Navigator** | Community active where metadata supports; Region, Country and World ascent preserved |

## Page composition (frozen order)

```
Community Identity

↓

Community Statistics

↓

Community Participation Pipeline

↓

Latest Community Initiatives

↓

Community Impact Overview

↓

Find Your Community

↓

Registration Gateway / Workspace

↓

Footer
```

## Sequence rules

| Rule                                 | Meaning                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Order is narrative order**         | Blocks appear in this sequence — not optional reordering                                   |
| **No stage out of order**            | A block may be omitted only where architecture explicitly permits — never repositioned     |
| **Observation before participation** | Registration Gateway / Workspace follows Evidence, Impact Overview and Find Your Community |
| **One template — many communities**  | Community identity, Description and filtered datasets change — structure does not          |
| **No map required**                  | Interactive Map is not part of Version 1 Community page composition                        |

## Inheritance from Region Experience

Community page template **inherits** Region page template pattern:

| Region Experience block         | Community Experience block       |
| ------------------------------- | -------------------------------- |
| Region Identity                 | Community Identity               |
| Regional Interactive Map        | **Omitted in Version 1**         |
| Regional Statistics             | Community Statistics             |
| Regional Participation Pipeline | Community Participation Pipeline |
| Latest Regional Initiatives     | Latest Community Initiatives     |
| Community Discovery             | **Find Your Community**          |
| —                               | **Community Impact Overview**    |
| Registration Gateway            | Registration Gateway / Workspace |
| Footer                          | Footer                           |

Region **Community Discovery** prepared descent to Community Experience.

Community **Find Your Community** completes cross-community discovery at Community scope.

Optional **Trusted Community Media** — if authorized in later Architecture Review — may slot with same optional omission semantics as Trusted Regional Media. Not part of Version 1 frozen Community page composition in this document.

Optional secondary block **About Preview** from Block Library remains **deferred** — not part of Version 1 Community page composition.

## Discovery surface exception

When Community Experience serves a **discovery landing** before a community is selected, **Find Your Community** may appear **above Community Identity** as the sole composition on that surface. Once one community is selected for observation, the **frozen sequence above** governs page composition without inversion.

This sequence forms the **canonical Community Experience page template**.

---

# 3. Community Identity

**Community Identity** is the first page composition block on community observation pages.

It introduces the **current participant-created civic context** — where the visitor is within Humanity Union Public Space at Community scope.

## Contains

| Element                   | Responsibility                                                                    |
| ------------------------- | --------------------------------------------------------------------------------- |
| **Community Name**        | Primary identity — participant-provided public identifier                         |
| **Representative Image**  | Optional Identity visual context — community-associated imagery; orientation only |
| **Community Description** | Participant-provided public explanation of shared civic purpose                   |
| **Activity Area**         | Governed discovery filter dimension — separate from Community naming              |
| **Context Introduction**  | Helps visitor interpret community Evidence that follows — without persuasion      |

## Architectural rules

- Identity **explains purpose and orientation** — it does not promote the community as an organization to join;
- Identity excludes statistics, initiative catalogs, impact synthesis, cross-community search and registration demands;
- Identity copy remains distinct from block-level Evidence below;
- scope label visible — visitor knows they are at **Community** level within Humanity Union;
- Identity must not collapse Community scope into Region administrative boundary or Workspace;
- mandatory Community type taxonomy forbidden in Version 1;
- internal capability names forbidden in Identity layer.

**Primary block:** Hero · Community Summary at Community scope

**Narrative stage:** Identity

Community Identity answers **Where am I?** and **What is this community?** — among the five visitor questions from `PUBLIC_PAGE_TEMPLATE_STANDARD.md` at community depth.

**Identity explains purpose and orientation.**

**It does not promote.**

---

# 4. Community Impact Overview

**Community Impact Overview** is the evidence synthesis block before Find Your Community.

## Purpose

Summarize **observable public contribution** at community scope — evidence-based outcome signals drawn from public projections already presented upstream.

Community Impact Overview **does not replace** Community Statistics, Community Participation Pipeline or Latest Community Initiatives — it **synthesizes observable outcome patterns** with distinct responsibility.

## Architectural character

**Community Impact Overview is synthesizing — not evaluative.**

Platform presents **derived public information**.

Platform does **not** include **subjective evaluations**, community rankings, organizational achievement scores or certification copy.

## Display rules

| Permitted                                                                 | Forbidden                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------- |
| Derived public outcome indicators from permitted projections              | Subjective platform verdict on community worth           |
| Completed or advanced-stage initiative signals traceable to public detail | Fabricated trophies or marketing impact reports          |
| Honest participation trends where architecture permits — derived labeled  | Moral, political or predictive framing                   |
| Visitor Conclusion layer — visitor judges independently                   | Platform conclusion substituting for visitor judgment    |
| Verification links back to initiatives and upstream Evidence              | Duplication of Statistics or Pipeline as primary display |
| Honest sparse or zero outcome presentation                                | Inflated vibrancy to protect community pride             |

## Context Before Evidence

Community Impact Overview **requires** full four-layer pattern.

Visitor Conclusion is **essential** — platform explicitly declines to conclude for the visitor in Evidence layer.

Community Impact Overview answers **What observable outcomes can I infer from public evidence?** — within Community scope only.

---

# 5. Find Your Community

**Find Your Community** is the cross-community discovery block before Registration Gateway / Workspace.

## Purpose

Help visitors **discover other participant-created communities** — search by Community Name and Community Description.

Find Your Community **searches participant-created communities only**.

It **never behaves as an administrator-maintained directory**.

## Architectural character

**Find Your Community is exploratory search.**

Visitors query **participant-created Community records** — they are not required to select a result or complete a catalog.

**Find Your Community is not Region Community Discovery.**

Region browse belongs to **Region Experience** — Community page hosts **name search** exclusively per Epic 04 freeze and `COMMUNITY_CONTEXT_DECISION.md`.

## Architectural boundaries

| Permitted                                              | Forbidden                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Search Community Name and Description                  | Administrator-maintained exhaustive catalog presented as sole truth          |
| Result links to Community Experience at selected scope | Full Community page composition duplicated inside each result                |
| Honest empty, sparse and duplicate-name results        | Fabricated communities to appear searchable                                  |
| Activity Area as governed filter dimension             | Mandatory Community type taxonomy in Version 1                               |
| Voluntary interaction — no forced selection            | Mandatory community selection before reading elsewhere on platform           |
| Context explaining search vs Region browse             | Region Community Discovery browse UI duplicated as primary search substitute |

Find Your Community **does not replace Community Identity** on community observation pages — it **extends discovery** after this community's observation arc.

Communities are **discovered through participation** — Find Your Community **surfaces participant-created records**; it does not **own** Community business truth.

Find Your Community answers **How may I discover other participant-created communities?** — within Community scope.

---

# 6. Workspace Transition

**Registration Gateway / Workspace** is the participation boundary block before Footer.

## Purpose

Complete **Public Experience** with calm personal participation entry — after community observation.

**Public Experience ends here.**

Workspace is **not** a page composition block — it is the **first personal operational environment** entered through governed continuation.

## Guest visitors

**Registration Gateway** — voluntary registration invitation after community Evidence weight.

| Rule              | Application                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Calm invitation   | No urgency, guilt or limited-access language                                             |
| After observation | Follows Evidence, Impact Overview and Find Your Community on community observation pages |
| Optional          | Reading never required an account                                                        |
| Distinct copy     | Does not restate statistics, initiatives or search results                               |

## Authenticated participants

**Continue to Workspace** — governed personal participation entry after community observation.

| Rule                      | Application                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- |
| Explicit boundary         | Signals environment change — public observation → personal operation             |
| Optional                  | Visitor may continue public reading without entering Workspace                   |
| No duplicate registration | Registration Gateway not repeated when visitor already authenticated             |
| Explainable               | Context Introduction explains personal participation — not organizational signup |

## Architectural boundary

| Public Space (Community page)                     | Workspace                            |
| ------------------------------------------------- | ------------------------------------ |
| Projection-backed Evidence blocks                 | Operational Capability 02 workspaces |
| Read without account                              | Governed authenticated environment   |
| Registration Gateway / Continue to Workspace copy | Workspace UI — outside this template |

Workspace entry requires **explicit governed participation path** — never bait-and-switch from public reading.

**Participation remains voluntary.**

---

# 7. Block Responsibilities

Each Experience Block on a Community page has **one responsibility**.

**No duplicated evidence.**

**No duplicated navigation.**

**No duplicated statistics.**

No block may absorb another block's architectural duty.

## Block responsibility table

| Block                                | One responsibility                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Community Identity**               | Name the participant-created community and orient the visitor within Humanity Union        |
| **Community Statistics**             | Summarize observable community-scoped public participation indicators                      |
| **Community Participation Pipeline** | Show community distribution across pipeline stages                                         |
| **Latest Community Initiatives**     | Present concrete community-associated initiative public examples                           |
| **Community Impact Overview**        | Present evidence-based observable outcome synthesis — visitor judges impact                |
| **Find Your Community**              | Enable search of participant-created communities; link to other Community Experience pages |
| **Registration Gateway / Workspace** | Offer voluntary registration or governed Workspace continuation after observation          |
| **Footer**                           | Provide supporting navigation and institutional transparency                               |

## Supporting block notes

**Community Statistics**, **Community Participation Pipeline** and **Latest Community Initiatives** follow the same structural responsibilities as Region Experience equivalents — filtered to community association scope only.

Pipeline vocabulary remains **identical across Humanity Union** — community scope filters projection data only.

Latest Community Initiatives **cards navigate to public initiative pages** — Capability 03 presentation; Capability 02 public projection source.

## Duplication rules

| Forbidden                                                                             | Permitted                                                             |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Same statistic in Statistics and Pipeline without distinct responsibility             | Each block presents Evidence from its own projection responsibility   |
| Initiative catalog duplicated in Statistics and Latest Initiatives as primary content | Cross-reference links that preserve block responsibility              |
| Impact totals mirroring Statistics primary message without synthesis distinction      | Impact Overview aggregates outcome patterns — distinct responsibility |
| Find Your Community results duplicating full Community Statistics block               | Summary result fields only — per content architecture                 |
| Header navigation duplicated inside page blocks                                       | Footer secondary links — not header duplication                       |
| Community search on Region page as substitute for Find Your Community                 | Region Community Discovery browse — complementary, not duplicate      |

**Filter Instead of Duplicate.**

Community pages present **filtered community datasets** through **distinct block responsibilities** — not repeated information under alternate headings.

**One Experience Block — One Responsibility.**

---

# 8. Context Before Evidence

Every Community Experience block follows the same structural pattern:

```
Heading

↓

Context Introduction

↓

Evidence

↓

Visitor Conclusion
```

| Layer                    | Structural role                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| **Heading**              | Block title — identifies subject at community scope                                      |
| **Context Introduction** | Explains why this block's Evidence matters at community scope — without persuasion       |
| **Evidence**             | Public projection data, public-safe configuration or governed search results — read-only |
| **Visitor Conclusion**   | Visitor judges — platform does not conclude for them                                     |

**Mandatory for every block.**

## Architectural rules

**Context Introduction:**

- explains significance — never persuades;
- never replaces Evidence;
- remains concise;
- precedes Evidence on every block — **no exceptions**.

**Evidence:**

- originates from responsible Capabilities through public projections filtered to community association;
- includes derived values labeled derived;
- permits honest empty or sparse community states;
- never fabricates activity to appear community vibrant.

**Visitor Conclusion:**

- Humanity Union presents evidence;
- visitors form conclusions independently;
- platform does not insert community verdicts, organizational certification copy or "trust this community" messaging.

Community Impact Overview **requires** Visitor Conclusion — platform explicitly declines subjective evaluation in Evidence layer.

Find Your Community Context Introduction must clarify **participant-created search** before search Evidence.

Registration Gateway and Workspace continuation Context Introduction precede action — not Community Identity Hero.

**Community Experience explains before presenting evidence.**

This pattern applies to **every block** in the canonical layout — including Footer where supporting copy applies.

---

# 9. Navigation Rules

Primary navigation moves through **approved geographic and civic levels**:

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

**Visitors always understand where they are in Humanity Union.**

At Community scope:

| Navigation element                   | Responsibility                                                             |
| ------------------------------------ | -------------------------------------------------------------------------- |
| **Header**                           | Six frozen destinations — platform-wide civic spaces                       |
| **Geographic Navigator**             | Community active where metadata supports; Region, Country and World ascent |
| **Community Identity**               | Participant-named civic context — primary page orientation                 |
| **Find Your Community**              | Cross-community discovery — search, not Region browse                      |
| **Registration Gateway / Workspace** | Public Experience boundary — optional personal entry                       |
| **Footer**                           | Supporting navigation — legal, transparency, secondary links               |

## Descent and ascent

| Direction           | Permitted entry at Community scope                                                          |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Ascent**          | Region — via Geographic Navigator or governed return paths where metadata supports          |
| **Ascent**          | Country — via Region, Geographic Navigator, Header Home, or governed return paths           |
| **Ascent**          | World — via Country, Geographic Navigator, Header Home, or governed return paths            |
| **Lateral**         | Header destinations — Knowledge, Media, Institutions, About                                 |
| **Lateral**         | Initiative public detail — from Latest Community Initiatives cards                          |
| **Cross-community** | Find Your Community — search to another Community Experience                                |
| **Forward**         | Workspace — via Registration Gateway or Continue to Workspace only — explicit governed path |

## Navigation discipline

- three-step navigation rule from Navigation Architecture preserved;
- navigation follows curiosity — no forced linear tutorial or registration wall on public Evidence;
- Region Community Discovery introduced at Region Experience — not duplicated as primary search on Community observation page without Find Your Community responsibility;
- Workspace entry requires explicit governed participation path — never bait-and-switch from public reading;
- deep link to Community Experience is valid — template preserved — not navigation failure;
- Community Experience organized around **civic participation context** — geographic ascent preserved but secondary to participant-named orientation.

Primary civic navigation at Community scope emphasizes **observation completion → optional Workspace**.

Region, Country and World ascent remain **always available**.

---

# 10. Future Compatibility

The Community page template supports future platform evolution **without structural redesign**.

## Supported future extensions

| Future capability                      | Template compatibility                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Community collaboration**            | Optional Exploration or Evidence extension — Architecture Review required                           |
| **Community collections**              | Optional curated or visitor grouping — must not gate public Evidence                                |
| **Community achievements**             | Optional Evidence extension — projection contract first; no subjective scoring in Version 1 pattern |
| **Advanced discovery**                 | Search and filter extensions — must preserve Find Your Community principles                         |
| **Saved communities / subscriptions**  | Visitor convenience — must not replace public observation path or force account for reading         |
| **AI community discovery**             | Explain-only assistant — Architecture Review; never certifies or ranks opaquely                     |
| **Trusted Community Media**            | Optional Exploration block — Architecture Review if added                                           |
| **Interactive Map at community scope** | Optional Evidence block — Architecture Review if added; not Version 1 requirement                   |
| **About Preview block**                | Optional deferred block — insertion only through formal Architecture Review                         |

## Adaptation rule

```
Community Page Template + community scope parameter + participant Identity → filtered Evidence and Find Your Community datasets
```

Architecture remains identical across communities, regions, countries and future civic context extensions.

Only **filtered datasets**, **identity copy**, **Community Name**, **Description**, **Activity Area**, and **scope labels** change.

Forbidden future pattern:

- per-community custom block sequences;
- community promotional reordering placing Registration Gateway before Evidence;
- Region blocks inserted into Community template to avoid building distinct Community scope;
- Find Your Community absorbed into Region page through implementation convenience;
- Community Impact Overview becoming subjective platform rating block;
- multiplying Community templates by community type taxonomy — organic participation-created growth preserved.

The Version 1 frozen sequence is the **stable contract** for implementation, content and interaction architecture.

---

# 11. Architectural Principles

The Community page template confirms these Humanity Union Public Space principles:

| Principle                                                                              | Community template meaning                                                                           |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **One Experience Block — One Responsibility**                                          | Each block in Section 7 table owns exactly one architectural duty                                    |
| **Context Before Evidence**                                                            | Heading → Context Introduction → Evidence → Visitor Conclusion on every block                        |
| **Observation precedes participation**                                                 | Registration Gateway / Workspace follows community Evidence, Impact Overview and Find Your Community |
| **Trust Through Verification**                                                         | Evidence traceable to public projections — honest empty states permitted                             |
| **Explainable Honesty**                                                                | Derived values labeled; no fabricated community vibrancy                                             |
| **Communities are discovered through participation**                                   | Find Your Community searches participant-created records — not admin catalog monopoly                |
| **Community Experience is organized around civic participation rather than geography** | Template emphasizes participant-named purpose and observable activity — geographic ascent preserved  |

These principles inherit from Epic 01 Public Space architecture, Epic 02 Global Experience, Epic 03 Country Experience and Epic 04 Region Experience without community exception.

Community pages reveal **one participant-created community's observable civic activity**.

They do not sell platform mythology or organizational membership promotion.

---

# 12. Final Statement

**Community pages present one participant-created community through Humanity Union's unified Public Space architecture.**

They **complete the public civic journey** while **naturally preparing visitors for personal participation through Workspace** — calmly, voluntarily and verifiably.

The template guarantees:

| Guarantee                   | Meaning                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Familiarity**             | Visitors recognize the same block sequence pattern they know from Region, Country and Global Experience |
| **Scalability**             | Every community adopts one template — content and projections vary, structure does not                  |
| **Long-term consistency**   | Future collaboration, collections and achievements extend — not fork — this composition                 |
| **Public completion**       | Community Experience is final Public Space page class — Workspace boundary explicit                     |
| **Participation readiness** | Observation arc complete before Registration Gateway or Workspace continuation                          |

Community Experience is **Community scope Public Experience** — not a separate community portal or social network.

The canonical layout, Context Before Evidence pattern, Find Your Community boundaries, Workspace Transition rules, and navigation rules in this document are the **structural contract** for all Community Experience pages in Version 1.

Implementation, visual design, and engineering must serve this template — not redefine it.

One Humanity.

Many Countries.

Many Regions.

Many Communities.

Shared Future.

---

# References

| Document                                      | Path                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Community Experience Vision                   | `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_VISION.md`                   |
| Community Experience Narrative                | `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_NARRATIVE.md`                |
| Community Experience Content Architecture     | `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_CONTENT_ARCHITECTURE.md`     |
| Community Experience Interaction Architecture | `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_INTERACTION_ARCHITECTURE.md` |
| Community Context Decision                    | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`                      |
| Region Page Template Standard                 | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_PAGE_TEMPLATE_STANDARD.md`                    |
| Public Page Template Standard                 | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`                    |
| Epic 04 Architecture Freeze                   | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/EPIC_04_ARCHITECTURE_FREEZE.md`                      |
| Public Space Architecture                     | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`                        |

---

# Document Status

**Draft**

Community Page Template Standard — Epic 05

Architecture review and architecture freeze may proceed after page template approval.

Implementation is **not authorized** by this document.

---

**End of Document**
