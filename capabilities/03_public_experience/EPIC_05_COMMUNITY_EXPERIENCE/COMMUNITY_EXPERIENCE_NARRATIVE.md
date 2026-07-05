# COMMUNITY EXPERIENCE NARRATIVE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 05 — Community Experience

Version: 1.0

Status: Draft

Document Type: Narrative Architecture

---

# Purpose

Define the **narrative architecture** of Community Experience.

This document explains how visitors **progressively understand one participant-created community** and **naturally transition from public observation to personal participation**.

Community Experience tells the story of **one community's observable civic life within Humanity Union** — not the story of a community standing apart from its region, country or global civic context.

Narrative architecture governs **copy direction, emotional progression and story sequencing at community scope**.

It does not govern visual design, component APIs, routing or Capability 02 implementation.

Reference:

- `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_DISCOVERY.md`
- `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/EPIC_04_ARCHITECTURE_FREEZE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`

Epic 04 defined the **regional civic story** and frozen **Community Discovery** as geographic handoff.

Epic 05 defines the **community civic story** — same architectural language, participant-named civic context, final public chapter before Workspace.

**Narrative supports understanding rather than promotion.**

Implementation must serve the narrative.

Promotional, organizational boosterism or conversion-first copy must not replace it at build time.

---

# 1. Purpose

Community Experience tells the story of **one living civic community**.

The narrative demonstrates **how people unite around shared purpose through observable public activity** — participant-created context made legible through public projections, not administrator-imposed catalog fiction.

The visitor arrives — from Region Community Discovery, Find Your Community search, Initiative association, or a shared link — seeking **participant-named local civic context** within the same institution they already know at Region, Country and World scope.

The narrative answers:

- this community exists as **named shared civic purpose** within Humanity Union;
- civic activity associated with this community is **visible and structured**;
- community participation can be **understood** through public projections — not asserted through rhetoric;
- exploration may continue **toward initiatives, other communities, broader scopes, or personal Workspace entry** — calmly;
- participation remains **voluntary** after observation.

Community Experience tells the story of **one community's observable civic life as part of Humanity Union**.

The narrative supports **understanding**.

It never substitutes **promotion**.

It does not tell an organizational membership funnel story, a community marketing story, or an administrative certification story.

It tells a **civic observation story** — localized at participant-named context within connected regional, national and global civic space.

**It explains rather than promotes.**

---

# 2. Narrative Philosophy

Community Experience should answer the following guiding questions — in order, across the page — without forcing the visitor through a tutorial.

## Who are these people?

**Not:** a private roster, identifiable member list, or social network profile directory.

**But:** what **participant-created civic context** names this community — and what **public aggregate signals** (where projection rules permit) suggest scale — honestly, including sparse participation.

People are understood through **observable public activity and stated community purpose** — not through exposure of private identity.

## Why does this community exist?

**What shared civic purpose did participants associate with this name?**

Community Description and Context Introduction explain **civic value and shared goals** — not organizational recruitment.

Purpose is **explained** — not sold.

## What does it contribute?

**What structured participation and initiative activity is visible at community scope?**

Statistics, pipeline distribution and initiatives show **contribution as measurable public records** — derived values labeled, empty states honest.

Contribution is **revealed** — not scored, ranked or celebrated by the platform.

## How active is it?

**What public civic activity is observable around this community?**

Activity indicators, pipeline presence and initiative recency answer scale and structure — including honest low or zero activity.

Activity is **observable** — not fabricated for vibrancy.

## How can I learn more?

**Where does the story continue without registering?**

Initiative public detail, header destinations, ascent to Region, Country and World scope, Find Your Community for other participant-created contexts.

Learning is **curiosity-driven** — not path completion enforced by the UI.

## How can I participate?

**What happens if I choose personal accountable action?**

Registration Gateway and Workspace transition — calm, optional, after sufficient community observation.

Participation is **invited** — never required to read.

These questions implement the Five Visitor Questions from `PUBLIC_PAGE_TEMPLATE_STANDARD.md` at **community scope** — with **who / why / what / how active** as the defining local observation questions and **Workspace as the natural next step** when the visitor chooses contribution.

---

# 3. Narrative Flow

Community Experience follows a **canonical narrative sequence**.

Each step carries **one primary narrative responsibility**.

Steps align with Experience Blocks and page template stages — narrative order must not invert template order once a community is selected for observation.

```
Community Identity

↓

Community Purpose

↓

Observable Civic Activity

↓

Participation Pipeline

↓

Community Initiatives

↓

Community Impact Overview

↓

Find Your Community

↓

Workspace Transition
```

**Entry exception:** When the visitor has **not yet selected a community**, Find Your Community may serve as the **narrative entry** on discovery surfaces — search precedes Identity until one community is chosen. Once observation begins, the **frozen sequence above** governs story progression without inversion.

## Community Identity

**Responsibility:** Name the community as the visitor's current **participant-created civic context** within Humanity Union — with regional and national ascent preserved where metadata supports.

**Message:** You are observing **this community** in the public square — not leaving Humanity Union, its region or its country.

**Block alignment:** Community Identity · Hero · Geographic Navigator · Identity layer

**One Screen — One Message:** _Who is this community in public civic space?_

## Community Purpose

**Responsibility:** Help the visitor interpret **why this named civic context exists** — shared goals and civic value before Evidence collapses into numbers alone.

**Message:** This community's public activity exists around **stated shared purpose** within a **connected civic context**.

**Block alignment:** Context Introduction below Hero · Community Description · block-level Context Introductions

**One Screen — One Message:** _Why does this community exist — and why does civic information below matter?_

## Observable Civic Activity

**Responsibility:** Present **measurable public activity** at community scope — aggregates before abstraction collapses into slogans.

**Message:** Civic activity around this community is **real and observable** — honest at community scale.

**Block alignment:** Community Statistics · Evidence layer opening · public aggregate indicators where permitted

**One Screen — One Message:** _What can be observed about civic activity around this community?_

## Participation Pipeline

**Responsibility:** Show **how participation is structured** at community scope — stage distribution across the frozen Participation pipeline vocabulary.

**Message:** Community civic life follows the **same structured path** as regional, national and global civic life — visible at community scope.

**Block alignment:** Community Participation Pipeline · Initiative Levels

**One Screen — One Message:** _How is participation structured around this community?_

## Community Initiatives

**Responsibility:** Connect structure to **concrete civic subjects** — named initiatives on public paths visitors may read without registering.

**Message:** Shared purpose here becomes **observable collective action** — instances, not only counts.

**Block alignment:** Latest Community Initiatives · Exploration entry to public detail

**One Screen — One Message:** _What specific civic activity is associated with this community?_

## Community Impact Overview

**Responsibility:** Allow the visitor to **synthesize observable outcomes** from Evidence already presented — without the platform imposing a verdict.

**Message:** What you have observed **adds up to legible public civic life** — or honest sparsity — at community scope.

**Block alignment:** Visitor Conclusion layers across Evidence blocks · optional honest trend presentation where architecture permits · completed or advanced-stage initiatives visible in public projections

**One Screen — One Message:** _What observable outcomes can I infer from public evidence — by my own judgment?_

**Note:** Community Impact Overview is **narrative synthesis** — not a separate promotional megablock. Platform presents Evidence; visitor forms impact understanding. No platform-declared community success, failure or organizational achievement score.

## Find Your Community

**Responsibility:** Enable **cross-community discovery** — search participant-created Community Name and Description — before the visitor concludes public observation or considers Workspace.

**Message:** Other participant-created communities exist in the same architecture — discovery remains voluntary and explainable.

**Block alignment:** Find Your Community · Exploration layer

**One Screen — One Message:** _How may I discover other communities created through participation?_

**Note:** Find Your Community is **search** — Region Community Discovery is **association browse**. Region **prepares** community descent; Community Experience **hosts** name search exclusively per Epic 04 freeze and `COMMUNITY_CONTEXT_DECISION.md`.

## Workspace Transition

**Responsibility:** Complete Public Experience and offer **informed personal participation entry** — observation yields optionally to accountable contribution.

**Message:** You understand who this community is and what public activity is observable — **you may enter Workspace when ready**; reading never required an account.

**Block alignment:** Registration Gateway · Participation stage · governed Workspace entry copy

**One Screen — One Message:** _How may I participate personally if I choose?_

Community Experience **concludes Public Experience** at Workspace Transition.

Workspace is **not** another narrative step inside Public Space — it is the **first personal operational environment**.

---

# 4. Community Identity

Community Identity establishes **orientation** — not organizational promotion or administrative certification.

## Community Name

**Narrative role:** primary Identity label — the participant-created community named clearly in Hero and navigator.

**Narrative constraint:** canonical naming from Capability 02 Community record — consistent across scopes, links and Find Your Community results; duplicate names handled honestly without fabricated disambiguation drama.

## Representative image

**Narrative role:** optional visual anchor in Identity layer — community-associated imagery signals **which participant-named context is active**.

**Narrative constraint:** atmospheric orientation — not organizational campaign imagery, membership recruitment creative or symbolism implying Humanity Union endorsement of a private group.

## Community Description

**Narrative role:** participant-provided public explanation of shared civic purpose — primary Find Your Community search target alongside Community Name.

**Narrative constraint:** explains context — does not replace statistics or initiative Evidence; governed by public-safe content policy; no mandatory type taxonomy in Version 1.

## Activity Area

**Narrative role:** separate discovery filter dimension — thematic or domain classification **distinct from Community naming and Description**.

**Narrative constraint:** supports findability without duplicating Description keywords or initiative text; governed vocabulary — not participant free-text Identity substitute.

**Identity provides orientation rather than promotion.**

Identity elements answer **who this community is in public civic space**.

They do not **certify legitimacy**.

They do not **replace Evidence**.

They do not **pressure Workspace entry**.

Community Identity is **welcoming and precise** — not promotional or organizational performative.

---

# 5. Community Purpose

Community Purpose explains **why the community exists** — the narrative bridge between Identity and Evidence.

## Civic value and shared goals

Purpose describes **what participants associated with this name** — environmental stewardship, neighbourhood coordination, cultural preservation, civic education, volunteer collective action, or other shared civic goals visible through public activity.

Purpose copy answers:

- _Why did participants name this civic context?_
- _What shared goal organizes observable activity below?_

## What purpose is not

| Forbidden                                 | Required                               |
| ----------------------------------------- | -------------------------------------- |
| Marketing language                        | Calm explanatory copy                  |
| Urgency or recruitment pressure           | Voluntary reading tone                 |
| Platform certification of community worth | Observable public activity as evidence |
| Organizational membership pitch           | Civic purpose orientation              |
| Political endorsement rhetoric            | Explainable honesty                    |

**Example narrative direction (not mandatory copy):**

_This page shows public civic activity associated with [Community Name] — a participant-created community within [Region/Country context where metadata supports] in Humanity Union._

Purpose should describe **civic value and shared goals**.

It should **not contain marketing language**.

Community Purpose implements **Context Before Evidence** at story layer — significance explained before statistics, pipeline and initiatives.

---

# 6. Observable Civic Activity

Visitors **first observe measurable public activity** at community scope — before interpreting initiatives as stories, discovering other communities, or considering Workspace.

Observable activity is **Evidence** — originating from Capability 02 public projections filtered to community association scope.

## Community statistics

Aggregate indicators at community scope — counts and derived metrics **labeled derived**.

Answers: _How much public civic activity is visible around this community?_

## Participation indicators

Pipeline-related aggregates and stage presence at community scope — structure becoming legible.

Answers: _Is participation structured and present at community scale?_

## Public initiative activity

Initiative-associated public records contributing to community-scoped aggregates — traceable toward public detail.

Answers: _What initiative activity supports these community-level observations?_

## Community growth

Where architecture permits honest temporal presentation — **transparent aggregation only**; participant count or activity trends at community scope when projection rules explicitly allow; small-count suppression where policy requires.

Answers: _Has observable public activity changed over time — honestly presented?_

Humanity Union presents **observable public information**.

Visitors form **their own conclusions**.

| Rule                                       | Application                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| **No imposed conclusions**                 | Platform does not declare community success, failure or organizational performance |
| **Honest sparsity**                        | Low or zero activity shown truthfully                                              |
| **Derived labeling**                       | Computed values never presented as raw civic truth                                 |
| **Verification path**                      | Statistics lead toward initiative detail — not slogans                             |
| **Evidence without directing conclusions** | Platform presents facts — visitor judges independently                             |

**No conclusions are imposed.**

Observable Civic Activity implements **Public Space reveals — it does not persuade**.

---

# 7. Participation Narrative

Community initiatives demonstrate how **civic participation develops around participant-named context** — moving from community aggregates to **named civic paths**.

## Pipeline remains identical to all previous Experience levels

The Participation pipeline vocabulary is **frozen** — Initiative, Collaborative Analysis, Collective Decision, Petition, Implementation Commitment, Implementation.

Community scope **filters counts and examples** — it does not **rename, reorder or shorten** the civic path for community marketing.

**The Participation Pipeline remains identical to all previous Experience levels.**

## Community participation story

```
Structure visible at community scope (Pipeline)

↓

Concrete examples visible at community scope (Initiatives)

↓

Detail verifiable publicly (Initiative public projection pages)

↓

Visitor synthesizes observable impact (Community Impact Overview — visitor judgment)
```

**Community Participation Pipeline block** answers: _How is participation distributed across stages around this community?_

**Latest Community Initiatives block** answers: _What living examples exist on that path here?_

Together they narrate: **structured civic life is observable at participant-named local context** — not abstract at regional scope only.

Initiatives demonstrate how **shared purpose becomes visible public contribution** — instances visitors may trace to public detail without registering.

Explain how initiatives become **visible public contribution** — through frozen pipeline stages and public initiative projections — not through platform advocacy for any single community.

No gamification.

No community league tables.

No urgency.

No organizational scorekeeping.

---

# 8. Community Impact Overview

Community Impact Overview is the **narrative synthesis stage** — where Evidence accumulated across Observable Civic Activity, Participation Pipeline and Community Initiatives allows the visitor to understand **observable outcomes** without the platform declaring victory or failure.

## Summarize observable outcomes

Impact Overview draws from **public evidence already presented** — never from operational workspace internals or private participant data.

## Examples of evidence-based impact signals

| Signal                             | Narrative role                                                             | Constraint                                                     |
| ---------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Completed initiatives**          | Advanced-stage or implementation-visible initiatives in public projections | Traceable to initiative detail — not platform editorial "wins" |
| **Achievements**                   | Observable pipeline progression and public implementation evidence         | Never fabricated badges or organizational trophies             |
| **Public evidence**                | Verifiable initiative records associated with community scope              | Same trust model as upstream scopes                            |
| **Community participation trends** | Honest temporal aggregates where architecture permits                      | Derived labeled — no moral or predictive framing               |

## What Impact Overview is not

- not a marketing "impact report" block replacing Evidence;
- not platform certification of community effectiveness;
- not substitute for reading statistics, pipeline and initiatives;
- not pressure toward registration or Workspace.

**Impact remains evidence-based.**

Visitor Conclusion layers across blocks implement Impact Overview at copy layer:

**Platform presents Evidence.**

**Visitor understands observable civic life.**

**Platform does not conclude for the visitor.**

Community Impact Overview completes the **observation arc** before Find Your Community and Workspace Transition open **exploration beyond this community** and **personal participation** respectively.

---

# 9. Workspace Transition

Community Experience **concludes Public Experience**.

Workspace Transition narrates the **natural optional boundary** between public observation and personal accountable action.

## Visitors understand before entering Workspace

By Workspace Transition, the narrative must have delivered:

| Understanding                       | Narrative source                                                           |
| ----------------------------------- | -------------------------------------------------------------------------- |
| **Who the community is**            | Community Identity — Name, Description, Activity Area                      |
| **What it does**                    | Community Purpose · Observable Civic Activity                              |
| **How it contributes**              | Participation Pipeline · Community Initiatives · Impact Overview synthesis |
| **That participation is voluntary** | Entire page readable without account                                       |

## Natural transition

```
Public observation complete (Community Experience)

↓

Calm Registration Gateway invitation (optional)

↓

Workspace — personal operational participation
```

**Observation naturally transitions into contribution** — only when the visitor chooses.

Natural transition means:

- sufficient community context observed first;
- Registration Gateway invitation is calm — not urgent;
- Workspace entry is explainable — distinct from public Evidence blocks;
- stopping at community observation without Workspace remains **valid narrative success**.

## Participation remains voluntary

Reading Community Experience **never requires an account**.

Workspace Transition **invites** — it does not **gate** public Evidence.

Community Experience completes the Epic 01 journey at community depth:

Discover → Understand → Trust → Register → Participate.

Stopping at Understand or Trust is valid.

Workspace is the **natural next step** for visitors who choose personal contribution — not a surprise endpoint or organizational signup trap.

---

# 10. Narrative Principles

Community Experience narrative conforms to frozen principles — **no community exceptions**.

## Observation precedes participation

Community Evidence, Impact synthesis, Find Your Community and initiative exploration precede Registration Gateway and Workspace Transition.

Reading a community page never requires an account.

## Context Before Evidence

Every narrative step respects **Heading → Context Introduction → Evidence → Visitor Conclusion**.

Community Purpose precedes community statistics, pipeline and initiatives.

## Every interaction increases understanding

Scope changes, initiative links, Find Your Community results, Region ascent and Workspace entry copy must articulate **what the visitor learned** — per upstream Interaction architecture adapted at community scope.

## Trust Through Verification

Community narrative Evidence traces to initiative public detail and derived labels — same verification path as Global, Country and Region Experience.

## Explainable Honesty

Community sparse or zero activity shown truthfully — narrative never inflates vibrancy to protect community pride or platform engagement metrics.

## One Humanity. Many Communities. Shared Future.

Community story **deepens participant-named local understanding** — it never **severs region, country or global connection**.

Copy and progression preserve **connected civic space** language — community within broader geographic and institutional context.

## One Screen — One Message

Each major narrative step carries **one primary idea** — implementing **One Experience Block — One Responsibility** at story layer.

## Public Space never persuades. It reveals.

Community narrative excludes urgency, guilt, community ranking, organizational boosterism and certification rhetoric.

## Communities are discovered through participation

Find Your Community searches participant-created names — organic growth through Initiative creation — not administrator catalog monopoly.

---

# 11. Success Criteria

Visitors should understand — without registration, without forced linear completion — the following narrative outcomes:

| Outcome                                    | Meaning                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Who the community is**                   | Participant-created civic context — named, described, oriented — not admin taxonomy       |
| **Why it exists**                          | Shared civic purpose explained calmly — not marketed                                      |
| **What it is doing**                       | Observable public activity — initiatives and structure — or honest sparsity               |
| **How it contributes**                     | Structured participation visible at community scope — evidence-based, not sloganeered     |
| **How they may participate**               | Voluntary Registration Gateway and Workspace entry after observation                      |
| **Why Workspace is the natural next step** | Personal accountable action follows informed public understanding — optional, explainable |

## Thirty-second community orientation

Within approximately thirty seconds, a visitor arriving from Region Community Discovery or a direct community link should state:

**"I understand who this community is, why it exists, and what public civic activity is observable around it — and I know participation is optional."**

Thirty seconds measures **community orientation** — not pipeline expertise or Workspace onboarding completion.

## Familiarity criterion

A visitor who knows the Region Experience narrative should **recognize the same story shape** — localized further:

| Region stage                               | Community stage                                                 |
| ------------------------------------------ | --------------------------------------------------------------- |
| Region exists in country in Humanity Union | Community exists as participant-named context in Humanity Union |
| Regional civic activity is active          | Community civic activity is active                              |
| Regional participation is measurable       | Community participation is measurable                           |
| Regional initiatives demonstrate action    | Community initiatives demonstrate action                        |
| Community Discovery foreshadows Community  | Find Your Community enables cross-community search              |
| Impact understood through Evidence         | Community Impact Overview synthesizes visitor judgment          |
| You may participate                        | Workspace Transition — voluntarily                              |

Find Your Community **extends** the Region → Community handoff — it does not **replace** the parallel narrative spine.

## Valid success without Workspace

Visitors who complete the narrative through Community Impact Overview or Find Your Community **without** entering Workspace have succeeded — Public Experience fulfilled its purpose.

---

# 12. Final Statement

**Community Experience presents the observable civic life of one participant-created community.**

It **completes Humanity Union's Public Experience narrative** by naturally leading informed visitors toward **personal participation** when they choose — never before they understand who the community is, why it exists, and what public activity is observable.

Community Experience is not a community exit from Humanity Union, its region or its country.

It is the **final public chapter** of one civic story — told with the same calm, the same honesty and the same architectural sequence Global, Country and Region Experience established at broader scopes.

**The narrative preserves Humanity Union's unified architectural language.**

Downstream artifacts — content architecture, interaction architecture, page template standard, alignment documents and architecture review — must inherit this narrative without inverting order, merging messages or introducing community promotion pressure.

**This document does not define implementation.**

It defines **what story Community Experience tells** — before copy, layout and engineering serve that story.

One Humanity.

Many Countries.

Many Regions.

Many Communities.

Shared Future.

One narrative — observed globally, understood nationally, explored regionally, **completed communally**, continued personally in Workspace.

---

# References

| Document                       | Path                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Community Experience Discovery | `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_DISCOVERY.md` |
| Community Experience Vision    | `capabilities/03_public_experience/EPIC_05_COMMUNITY_EXPERIENCE/COMMUNITY_EXPERIENCE_VISION.md`    |
| Epic 04 Architecture Freeze    | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/EPIC_04_ARCHITECTURE_FREEZE.md`       |
| Epic 03 Architecture Freeze    | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/EPIC_03_ARCHITECTURE_FREEZE.md`      |
| Community Context Decision     | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`       |
| Public Page Template Standard  | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`     |
| Region Experience Narrative    | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_NARRATIVE.md`       |
| Country Experience Narrative   | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_NARRATIVE.md`     |
| Global Experience Narrative    | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_NARRATIVE.md`       |
| Public Space Architecture      | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`         |

---

# Document Status

**Draft**

Community Experience Narrative — Epic 05

Content architecture may proceed after narrative approval.

Implementation is **not authorized** by this document.
