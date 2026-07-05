# COMMUNITY CONTEXT DECISION

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 03 — Country Experience

Version: 1.0

Status: Draft

Document Type: Architecture Decision

---

# 1. Purpose

Record the approved **Community Context** decision for Humanity Union Public Space and Initiative creation.

This document defines **Community** as a civic context **created by participant activity** — not as a rigid administrative geography imposed by platform administration.

Community Context extends the frozen geographic public hierarchy:

```
World → Country → Region → Community → Workspace
```

Community allows Humanity Union to reflect **real civic life** — cities, neighbourhoods, civic groups, cultural associations, environmental societies and other participant-named places of shared purpose — without forcing society into fixed administrative categories.

This decision governs:

- how Community relates to Geographic Experience at Country and Region scope;
- how Initiative creation may introduce new Community records;
- how **Find Your Community** discovery behaves;
- how **Community Experience** composes at local public scope;
- how **Activity Area** supports filtering without duplicating initiative text.

This document records **architectural intent and approved rules only**.

It does not define implementation.

It does not authorize UI components, database schemas, API endpoints or visual design.

Reference:

- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_NARRATIVE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`

---

# 2. Approved Geographic Flow

Humanity Union Public Space follows an **approved civic context flow** from global observation to personal action.

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

Each level answers a **distinct visitor question** while preserving **one architectural language**.

| Level                    | Visitor question                         | Architectural responsibility                                                                         |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Global Experience**    | What is happening in the world?          | World-scoped public civic observation — Humanity Union global public square                          |
| **Country Experience**   | What is happening in this country?       | Country-scoped filtered public civic activity within unified Public Space                            |
| **Region Experience**    | What is happening in this region?        | Region-scoped filtered public civic activity — same template, finer geographic filter                |
| **Community Experience** | What is happening around this community? | Community-scoped public civic activity — participant-named civic context, not admin-imposed taxonomy |
| **Workspace**            | What can I do personally?                | Accountable operational participation — Capability 02 workspaces                                     |

## Transition principles

| Principle                              | Application                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| **One architecture**                   | Same page template, block discipline, interaction philosophy at every public level |
| **Filter Instead of Duplicate**        | Scope parameter changes — block catalog does not fork                              |
| **Observation precedes participation** | Public levels remain readable without account; Workspace follows informed choice   |
| **Ascent preserved**                   | Visitor may return to broader scope — Community → Region → Country → World         |

Community Experience is **not** a separate platform.

It is the **community-scoped expression** of Public Space — parallel to Geographic Experience at Country and Region scope, extended to **participant-defined civic context**.

Region Experience and Community Experience relationship:

- Region remains **geographic filter** in frozen hierarchy;
- Community may **overlap** geographic place but is **not limited** to administrative boundaries;
- Community Experience may be reached from Region context, Find Your Community search, or Initiative association — architecture must preserve coherent scope labeling.

Detailed Community Experience composition: Section 7.

---

# 3. Community Definition

**Community** is a **civic context** representing people and places connected by shared civic purpose — visible in Public Space through public projections of participation activity.

## Community is not limited to administrative geography

A Community may represent — non-exhaustively:

| Community form             | Examples (illustrative)                              |
| -------------------------- | ---------------------------------------------------- |
| **City**                   | Nelson, Vancouver, Berlin                            |
| **Town**                   | Trail, Nelson-adjacent municipalities                |
| **Village**                | Small settlement with civic activity                 |
| **Neighbourhood**          | Local district with shared civic concern             |
| **Local society**          | Place-based civic association                        |
| **Civic group**            | Volunteer or advocacy collective                     |
| **Environmental group**    | Watershed or conservation society                    |
| **Cultural group**         | Community cultural organization                      |
| **Organization**           | Public-facing institution or NGO with civic activity |
| **Shared-purpose network** | People connected by cause rather than boundary       |

Communities are **named by participants** through civic activity — not exhaustively enumerated by platform administrators at launch.

## Version 1 taxonomy rule

**Do not create a fixed Community type taxonomy in Version 1.**

Forbidden at Version 1:

- mandatory Community type enum blocking Initiative creation;
- administrator-only Community catalog as sole source of truth;
- rigid mapping forcing every Community into city/town/village/organization categories before public visibility.

Permitted at Version 1:

- free-text **Community Name** and **Description** as required creation fields;
- organic growth of Community records through Initiative creation and Find Your Community discovery;
- future taxonomy only through formal Architecture Review — not implementation convenience.

Community names must remain **public-safe** and subject to platform governance policies — architecture decision does not waive moderation or legitimacy review where policy requires.

---

# 4. Community Creation Rule

**Community is created through Initiative creation when needed.**

When a participant creates or associates an Initiative with a Community context:

- participant may **select an existing Community** discovered through Find Your Community or public association;
- if participant enters a **Community name that does not exist**, the platform **may create a new Community record** as part of governed Initiative creation flow.

## Required fields only (Version 1)

| Field              | Responsibility                                                             |
| ------------------ | -------------------------------------------------------------------------- |
| **Community Name** | Primary public identifier — participant-provided                           |
| **Description**    | Short public explanation of community civic context — participant-provided |

## Explicit exclusions (Version 1)

- **Do not require Community type selection** in Version 1;
- do not require administrator pre-approval before Community record existence;
- do not require geographic coordinate precision as Community creation gate;
- do not require Country or Region pre-selection as hard blocker if Initiative policy permits broader association — geographic labeling remains separate concern governed by projection metadata.

## Architectural boundary

Community creation belongs to **participation and identity governance** — Capability 02 Initiative flow and related platform policy.

Community Experience (Capability 03) **presents** Community public activity through projections — it does not **own** Community business truth.

Public Space consumes **public projections** of Community-associated activity — same boundary as Country and Region scopes.

---

# 5. Activity Area

**Activity Area** is selected **separately from Community**.

## Purpose

Activity Area helps **discovery and filtering** across Initiatives and public browse surfaces — thematic or domain classification distinct from Community naming.

| Dimension       | Community                                                    | Activity Area                                               |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| **Represents**  | Who / where civic context — participant-named place or group | What domain — discovery filter dimension                    |
| **Created by**  | Participant through Initiative-associated Community naming   | Platform-approved Activity Area vocabulary or governed list |
| **Public role** | Identity and scope for Community Experience                  | Filter and discovery — not primary Identity                 |

## Architectural rule

**Activity Area should not duplicate keywords already present in initiative text.**

Activity Area supports **findability** — not redundant labeling.

Forbidden pattern:

- Initiative title and description already state "community garden" — Activity Area forced to repeat identical keyword without additive discovery value.

Permitted pattern:

- Activity Area provides **orthogonal filter axis** — e.g. environment, housing, education — where it clarifies browse and projection filtering without copying initiative prose.

Activity Area selection is **governed in Initiative creation UX specification** — this decision records architectural separation only.

---

# 6. Find Your Community

**Find Your Community** is the primary **Community discovery interaction** in Community Experience and Initiative creation support flows.

## Architectural definition

Find Your Community **searches participant-created Community names**.

It is **not** an administrator-predefined directory.

| Property          | Rule                                                     |
| ----------------- | -------------------------------------------------------- |
| **Source**        | Participant-created Community records                    |
| **Search target** | Community Name and public Description fields             |
| **Authority**     | Discovery reflects civic activity — not top-down catalog |
| **Empty state**   | Honest — no fabricated communities                       |

## Search results may include

Non-exhaustive examples illustrating diversity — not fixed list:

- **Nelson** — place-named community;
- **Kootenay Lake Protection Society** — environmental civic group;
- **Nelson Community Garden** — local initiative-associated community;
- **local civic groups** — participant-named associations;
- **public organizations** — organization-named communities with public activity;
- **participant-created communities** — any new name created through Initiative flow.

Results present **public-safe associations** — no private participant identity exposure beyond public projection rules.

## Interaction responsibility

Find Your Community interactions must:

- increase understanding of **which community context** visitor is entering;
- link to **Community Experience** at selected community scope when public activity exists;
- support **Initiative creation association** when participant is registering a civic path;
- remain **voluntary and explainable** — no forced community selection before public reading elsewhere on platform.

Find Your Community implements architectural principle:

**Communities are discovered through participation, not predefined by administration.**

---

# 7. Community Experience Blocks

**Community Experience** is public observation at **Community scope** — same architectural language as Global, Country and Region Experience, adapted to participant-named civic context.

## Version 1 composition priority

Community Experience **should prioritize** the following block sequence:

| Order | Block                                 | Architectural responsibility                                           |
| ----- | ------------------------------------- | ---------------------------------------------------------------------- |
| **1** | Find Your Community                   | Community discovery and scope entry — search participant-created names |
| **2** | Community Identity                    | Name, Description, Context Introduction — orient without promotion     |
| **3** | Community Statistics                  | Community-scoped public participation indicators — projection-fed      |
| **4** | Community Participation Pipeline      | Stage distribution at community scope — same pipeline vocabulary       |
| **5** | Latest Community Initiatives          | Concrete initiative public examples associated with community          |
| **6** | Registration Gateway / Workspace link | Voluntary participation entry after observation — calm invitation      |
| **7** | Footer                                | Supporting navigation — unified footer architecture                    |

Global chrome unchanged: **Header**, **Geographic Navigator** (with scope context appropriate to community placement in hierarchy), **Footer** as supporting navigation.

## Version 1 exclusions

| Exclusion                      | Rule                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **No map required**            | Version 1 Community Experience does not require Interactive Map block — geographic map remains at World, Country and Region levels |
| **Trusted Media not required** | Version 1 Community Experience does not require Trusted National Media or Trusted Media Carousel — optional future extension only  |

Omission is honest — not architectural gap.

Community Experience may **link upward** to Region, Country and World scopes — ascent preserved.

## Context Before Evidence

Every Community Experience block follows:

```
Heading → Context Introduction → Evidence
```

Same discipline as Global and Country Experience.

## Projection boundary

Community Statistics, Pipeline and Latest Initiatives consume **Capability 02 public projections** filtered by Community association — not operational aggregates.

Detailed Community Experience content and interaction architecture may be specified in future Epic documents — this decision freezes **composition priority and Version 1 boundaries**.

---

# 8. Architectural Principle

**Communities are discovered through participation, not predefined by administration.**

| Implication                     | Application                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Organic growth**              | New Community records emerge from Initiative creation need                                                 |
| **Public discoverability**      | Find Your Community searches participant-created names                                                     |
| **No admin catalog monopoly**   | Platform does not require central Community directory as sole truth                                        |
| **Honest public presentation**  | Community Experience shows observable activity — or honest sparsity                                        |
| **Governance without rigidity** | Platform policy may moderate abuse — without replacing participant naming with fixed taxonomy in Version 1 |
| **Filter Instead of Duplicate** | Community scope filters projections — does not fork Public Space architecture                              |

This principle extends Public Space axiom:

**Public Space is the window into a living society.**

Communities are **how local society names itself in civic participation** — not how administrators partition a map.

Initiative creation is the **primary creation path** for Community context.

Find Your Community is the **primary discovery path** for Community context.

Community Experience is the **primary observation path** for Community-scoped public activity.

---

# 9. Final Statement

**Community Context allows Humanity Union to reflect real civic life without forcing society into rigid administrative categories.**

Humanity Union preserves:

- **one Public Space architecture** from World to Community;
- **one participation pipeline vocabulary** at every scope;
- **one trust model** — projection-backed, Context Before Evidence, observation before participation;
- **one progression** from global observation to personal Workspace action.

Community adds **participant-named local civic context** — cities, groups, societies and shared-purpose collectives — discovered through participation and presented honestly in Public Space.

Version 1 intentionally avoids:

- fixed Community type taxonomy;
- administrator-only Community directories;
- mandatory map or trusted media at Community level.

Future evolution — taxonomy, richer Community metadata, local map — requires Architecture Review and must preserve **Communities are discovered through participation**.

This decision does not define implementation.

It records **approved Community Context architecture** for Epic 03 and downstream Public Experience and Initiative creation specifications.

Change requires governance — not engineering convenience.

---

# Relationship with Epic 03 Country Experience

Community Context **extends** Country Experience — it does not replace it.

| Scope                    | Primary question                         |
| ------------------------ | ---------------------------------------- |
| **Country Experience**   | What is happening in this country?       |
| **Region Experience**    | What is happening in this region?        |
| **Community Experience** | What is happening around this community? |

Country and Region remain **geographic filters** in frozen hierarchy.

Community may **align with** geographic place but is **defined by participant civic naming** — enabling Nelson, Kootenay Lake Protection Society and Nelson Community Garden to coexist as distinct discoverable contexts.

Epic 03 Country Experience documents govern **Country scope**.

Community Context decision governs **Community scope** — future Community Experience epic inherits both.

---

# References

| Document                                    | Path                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Discovery Session 01                        | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/DISCOVERY_SESSION_01.md`                        |
| Country Experience Vision                   | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_VISION.md`                   |
| Country Experience Narrative                | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_NARRATIVE.md`                |
| Country Experience Content Architecture     | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md`     |
| Country Experience Interaction Architecture | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_EXPERIENCE_INTERACTION_ARCHITECTURE.md` |
| Public Page Template Standard               | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`                |
| Public Space Architecture                   | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`                    |
| Epic 01 Architecture Freeze                 | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`                  |

---

# Document Status

**Draft**

Community Context Decision — Epic 03

Architecture review may adopt or amend this decision before freeze.

Implementation is **not authorized** by this document.
