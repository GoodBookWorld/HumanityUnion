# COUNTRY EXPERIENCE ALIGNMENT

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 03 — Country Experience

Version: 1.0

Status: Draft

Document Type: Architecture Alignment

---

# 1. Purpose

Align **Country Experience architecture** with the approved **Community Context** decision recorded in `COMMUNITY_CONTEXT_DECISION.md`.

Country Experience is **national in scope**.

It must **not absorb Community responsibilities** defined for participant-named local civic context.

Country Experience must:

- preserve frozen Country block composition and interaction model;
- maintain **Country → Region** as the primary geographic descent within national public observation;
- **prepare visitors for Region Experience** — the next geographic filter in the frozen hierarchy;
- **prepare visitors for future Community Experience** — without implementing Community blocks, search or statistics at Country scope.

This document resolves architectural boundaries between **Country**, **Region** and **Community** scopes.

It does not redefine Country Experience content or interaction architecture — it **aligns** them with Community Context.

It does not define implementation.

Reference:

- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`

---

# 2. Approved Geographic Sequence

Humanity Union Public Space follows the **approved civic context sequence** aligned with Community Context decision:

```
Global Experience

↓

Country Experience

↓

Region Experience

↓

Community Experience

↓

Workspace
```

| Level                    | Scope type           | Primary observation question             |
| ------------------------ | -------------------- | ---------------------------------------- |
| **Global Experience**    | World                | What is happening in the world?          |
| **Country Experience**   | Country              | What is happening in this country?       |
| **Region Experience**    | Region               | What is happening in this region?        |
| **Community Experience** | Community            | What is happening around this community? |
| **Workspace**            | Personal operational | What can I do personally?                |

## Alignment rules

| Rule                            | Application                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| **One architecture**            | Same page template, Context Before Evidence, interaction philosophy at every level                 |
| **Filter Instead of Duplicate** | Each level filters public projections — no scope forks block catalog                               |
| **Ordered descent**             | Country prepares Region; Region prepares Community — no scope skip without explicit visitor choice |
| **Ascent preserved**            | Visitor may return upward — Community → Region → Country → World                                   |

Country Experience sits **between World and Region** in public observation hierarchy.

Community Experience sits **below Region** — participant-named civic context, not administrative geography alone.

Workspace follows **optional** Registration Gateway entry — outside Public Space observation model.

---

# 3. Country Role

## Country answers

**What is happening in this country?**

Country Experience presents **national public civic activity** within Humanity Union:

- country Identity and Context Introduction;
- civic activity geographically distributed **within national boundaries**;
- national aggregate statistics and pipeline distribution;
- latest initiatives associated with the country;
- optional trusted national media supporting context;
- regional exploration entry **within the country**.

Country orients the visitor **nationally** while preserving **global Humanity Union context**.

## Country does not answer

**What is happening near me?**

| Excluded question                                              | Belongs to                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| What is happening around this community?                       | **Community Experience**                                                            |
| Which participant-named group or local society is active here? | **Community Experience** — Find Your Community                                      |
| What is happening in my neighbourhood / my organization?       | **Community Experience** — unless explicitly Region geographic filter applies first |

Country Experience **must not**:

- impersonate hyperlocal or participant-named Community scope;
- present Find Your Community search;
- label national page as "near you" or personal locality without Region or Community scope activation;
- conflate **national civic observation** with **community discovery**.

"Near me" implies **Community or highly local Region context** — not Country scope.

Country remains **national filter** — broader than community, narrower than world.

---

# 4. Region Role

## Region answers

**What is happening in this region?**

Region Experience presents **regional public civic activity** within a country — same architectural template, finer geographic filter than Country.

Region Interaction responsibilities aligned with Community Context:

- Identity names **region within country**;
- Evidence filtered to region scope from public projections;
- same block sequence as Country Experience — region-labeled;
- reversible ascent to Country and World.

## Region prepares visitors for Community Experience

Region is the **geographic bridge** between national observation and participant-named local context.

| Region responsibility toward Community | Alignment                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Geographic local depth**             | Region narrows place within country before Community naming                                                                   |
| **Exploration entry**                  | Region page may link or transition toward Community discovery where public associations exist                                 |
| **Scope clarity**                      | Visitor understands Region is **not yet Community** — administrative or regional geography vs participant-named civic context |
| **No Community blocks at Region**      | Find Your Community remains Community Experience primary entry — Region may **route toward** it, not **replace** it           |

Region does **not** answer Community questions directly.

Region **prepares** the visitor for progressively more local civic understanding that Community Experience completes.

---

# 5. Community Role

## Community answers

**What is happening around this community?**

Community Experience presents **community-scoped public civic activity** — filtered public projections associated with a **participant-created or participant-named Community record**.

## Community may represent

Per `COMMUNITY_CONTEXT_DECISION.md`, Community is **not limited to administrative geography**.

Community may represent:

| Form               | Illustrative examples                          |
| ------------------ | ---------------------------------------------- |
| **Place**          | city, town, village, neighbourhood             |
| **Organization**   | public organization with civic activity        |
| **Group**          | civic, environmental, cultural group           |
| **Shared purpose** | people connected by cause rather than boundary |

Community naming emerges through **Initiative creation** and **Find Your Community** discovery — not administrator-predefined directory alone.

## Boundary with Country

| Country                          | Community                                          |
| -------------------------------- | -------------------------------------------------- |
| National geographic filter       | Participant-named civic context                    |
| Regional Exploration block entry | Find Your Community block entry                    |
| National Statistics              | Community Statistics                               |
| Prepares Region descent          | Completes local civic observation before Workspace |

Country Experience ** acknowledges** Community as downstream scope.

Country Experience ** does not implement** Community scope.

---

# 6. Country Experience Block Impact

Community Context decision ** confirms** Country Experience block composition ** unchanged at national scope**.

## Country Experience keeps

Frozen Version 1 Country Experience blocks per `COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md`:

| Block                               | Country responsibility                                        |
| ----------------------------------- | ------------------------------------------------------------- |
| **Country Identity**                | National Identity — Hero · Geographic Summary                 |
| **National Map**                    | Interactive Map — civic activity within country; region entry |
| **National Statistics**             | Statistics — country-scoped aggregates                        |
| **National Participation Pipeline** | Initiative Levels — country-scoped stage distribution         |
| **Latest National Initiatives**     | Latest Initiatives — country-associated public examples       |
| **Trusted National Media**          | Trusted Media Carousel — optional national supporting context |
| **Regional Exploration**            | Exploration — Region scope transition within country          |
| **Registration Gateway**            | Participation — voluntary invitation after observation        |
| **Footer**                          | Supporting Navigation — unified footer                        |

Global chrome unchanged: **Header**, **Geographic Navigator**, **Footer**.

## Country Experience does not include

The following belong to **Community Experience** — not Country scope:

| Excluded at Country               | Community owner                                                |
| --------------------------------- | -------------------------------------------------------------- |
| **Find Your Community**           | Community Experience block 1 — participant-created name search |
| **Community-created search**      | Find Your Community interaction — not national browse          |
| **Community-specific statistics** | Community Statistics — community-filtered projections          |

Also excluded at Country — confirmed by Community Context:

- Community Identity block content as primary page Identity;
- Community Participation Pipeline as separate national substitute;
- Community map requirement — Community Experience Version 1 excludes map; Country retains **National Map** for **regional** exploration within country only.

## Alignment statement

No Country Experience block shall be repurposed to fulfill Community discovery or Community-scoped statistics.

Community Context ** adds** Community Experience composition — it does ** not subtract** from Country block set.

If implementation planning proposes Find Your Community on Country page — ** reject** as architectural misalignment unless formal Architecture Review amends this alignment.

---

# 7. Navigation Impact

Community Context decision adjusts **navigation responsibility** between scopes without changing header primary destinations.

## Country → Region navigation remains primary

At Country Experience scope, **primary geographic descent** is:

```
Country Experience

↓

Region Experience
```

Implemented through:

- **Geographic Navigator** — Region entry within active Country;
- **National Interactive Map** — regional selection within country;
- **Regional Exploration block** — explains and supports Region transition.

Country navigation **must not** treat Community as equal sibling to Region in primary geographic chrome at Country scope.

## Community navigation is introduced later

Community entry paths — aligned with Community Context:

| Entry path                 | Scope transition                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| **Region Experience**      | Region page links or routes toward associated Community contexts where public activity exists |
| **Find Your Community**    | Dedicated Community Experience search — participant-created names                             |
| **Initiative association** | Initiative creation or public detail links to Community context                               |
| **Deep link**              | Community-scoped URL when Community Experience exists                                         |

Community navigation is **not** primary at Country Experience launch.

Country prepares Region.

Region and Community Experience together complete **progressively local** civic understanding.

## Header and footer unchanged

Six frozen header destinations apply at Country scope — unchanged by Community Context.

Footer supporting navigation unchanged.

Geographic Navigator displays **Country active** — Region available — **Community not primary at Country chrome level** in Version 1 alignment.

## Ascent paths

| From                     | Ascent                     |
| ------------------------ | -------------------------- |
| **Community Experience** | → Region → Country → World |
| **Region Experience**    | → Country → World          |
| **Country Experience**   | → World                    |

Navigation remains **reversible, explainable and calm** per Country Interaction Architecture.

---

# 8. Final Statement

**Country Experience remains national in scope while preparing the visitor for progressively more local civic understanding.**

Community Context decision ** extends** Humanity Union Public Space downward to participant-named Community — without ** diluting** Country national responsibility.

Country Experience:

- answers **what is happening in this country**;
- preserves frozen block composition and interaction model;
- descends primarily to **Region Experience**;
- **does not** answer **what is happening near me** or **around this community**;
- **does not** host Find Your Community, community search or community-specific statistics.

Region Experience bridges **national geography** and **community civic context**.

Community Experience completes **local observation** before optional Workspace participation.

One architecture.

Progressively local questions.

Filter Instead of Duplicate.

Country, Region and Community each own **one scope question** — Country architecture aligned with Community Context remains **national, familiar and preparatory**.

This document does not define implementation.

It records **alignment** between Country Experience architecture and approved Community Context decision.

Change requires Architecture Review — not implementation convenience.

---

# Consistency Check

| Document                                         | Alignment status                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md`     | **Consistent** — Country blocks unchanged; Community blocks excluded                                         |
| `COUNTRY_EXPERIENCE_INTERACTION_ARCHITECTURE.md` | **Consistent** — Country → Region primary; Community downstream                                              |
| `COUNTRY_EXPERIENCE_NARRATIVE.md`                | **Consistent** — Regional Continuation prepares Region; Community narrative deferred to Community Experience |
| `COMMUNITY_CONTEXT_DECISION.md`                  | **Aligned by this document**                                                                                 |
| `PUBLIC_PAGE_TEMPLATE_STANDARD.md`               | **Consistent** — template unchanged; scope parameter extends to Community in future epic                     |
| `PUBLIC_SPACE_ARCHITECTURE.md`                   | **Consistent** — Public Space observation hierarchy extended                                                 |

No amendment to Country Experience content or interaction architecture documents is required for Community Context alignment — boundary clarification only.

---

# References

| Document                                    | Path                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Community Context Decision                  | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`                  |
| Country Experience Narrative                | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_NARRATIVE.md`                |
| Country Experience Content Architecture     | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md`     |
| Country Experience Interaction Architecture | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_INTERACTION_ARCHITECTURE.md` |
| Public Space Architecture                   | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`                    |
| Public Page Template Standard               | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`                |

---

# Document Status

**Draft**

Country Experience Alignment — Epic 03

Architecture review may adopt this alignment before Country Experience freeze.

Implementation is **not authorized** by this document.
