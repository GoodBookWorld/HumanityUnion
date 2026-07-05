# CAPABILITY 02 PROJECTION INTEGRATION

## Humanity Union Platform

## Capability 02 — Participation

## Capability 03 — Public Experience

### Epic 02 — Global Experience

Version: 1.0

Status: Draft

Document Type: Cross-Capability Integration Architecture

---

# 1. Purpose

Define the **architectural integration** between Capability 02 — **Participation** and Capability 03 — **Public Experience**.

This document specifies how Public Experience **consumes Participation data exclusively through Public Projections** — never through operational aggregates.

| Capability                            | Owns                                                                                                     | Does not own                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Capability 02 — Participation**     | Civic participation aggregates, lifecycles, operational workspaces, **public projection sources**        | Public Space navigation, page composition, Experience Block presentation |
| **Capability 03 — Public Experience** | Public Space architecture, visitor interaction, Experience Blocks, geographic presentation orchestration | Participation aggregates, participation business logic, operational data |

**Capability 03 presents Humanity Union to the public.**

**Capability 02 manages civic participation.**

**Capability 03 never owns participation data.**

**Capability 02 never owns public presentation.**

Integration occurs at a **single architectural boundary**: the Public Projection Layer.

This document does not define APIs, backend services or frontend implementation.

It defines **architectural responsibility** at the Capability 02 ↔ Capability 03 boundary.

Reference:

- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/EPIC_02_ARCHITECTURE_REVIEW.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`

---

# 2. Architectural Principle

The following principle is **frozen**:

## Public Experience consumes only Public Projections

**Operational aggregates are never accessed directly** by Capability 03 Public Experience.

Capability 03 must not:

- read operational workspace models as public page source;
- serialize aggregate roots to public pages;
- expose operational API responses on public surfaces;
- mutate Participation state through public presentation flows.

Capability 02 must not:

- define Public Space navigation architecture;
- embed Experience Block composition in aggregate domains;
- expose operational fields through public projection builders without sanitization review.

This preserves:

| Property                            | How projection boundary preserves it                                             |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| **Operational / Public separation** | Distinct models, builders and presentation ownership                             |
| **Privacy**                         | Participant identity and private operational detail excluded by projection rules |
| **Aggregate independence**          | Public Space references projections — does not embed aggregate graphs            |
| **Future extensibility**            | New blocks consume new projections — not aggregate redesign                      |

Public projections are the **only approved integration surface** between Capability 02 and Capability 03.

---

# 3. Integration Model

Cross-capability relationship:

```
Capability 02

Participation Aggregates

↓

Public Projection Layer

(projection builders · sanitization · public-safe DTOs)

↓

Capability 03

Public Experience

(Experience Blocks · scope filter · page composition)

↓

Visitor

```

## Layer responsibilities

| Layer                        | Responsibility                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| **Participation Aggregates** | Authoritative civic participation truth — operational                                 |
| **Public Projection Layer**  | Transform aggregate truth into **stable public representations** approved for society |
| **Public Experience**        | Compose projections into Experience Blocks and visitor understanding                  |
| **Visitor**                  | Observe, understand, evaluate — optionally register and participate                   |

**Public Experience depends only on stable public representations.**

Implementation may change stores, APIs and UI — projection contracts at architectural level must remain stable or version explicitly.

Capability 03 **orchestrates and filters** projections for presentation.

Capability 03 **does not recompute** Participation derived civic authority — labels and presents what projection layer exposes.

---

# 4. Projection Responsibilities

For every **Global Experience** block, this section specifies the **canonical architectural data source**.

Projection names are **architectural contracts** — composed at implementation time from Capability 02 aggregate public projections (for example `PublicInitiativeProjection`, `PublicPetitionProjection`, `PublicImplementationProjection`) without direct aggregate access.

Capability 03 Experience Blocks consume projection contracts only.

---

## Interactive World Map

| Attribute                 | Definition                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source**                | **Public Geographic Participation Projection**                                                                                                       |
| **Purpose**               | Display civic activity geographically                                                                                                                |
| **Consumed by block**     | Interactive Map                                                                                                                                      |
| **Architectural content** | Geographic association of public participation activity; scope-suitable activity markers or aggregates; no participant locations or private geo data |
| **Capability 02 owns**    | Geographic association of public participation records in projection builders                                                                        |
| **Capability 03 owns**    | Map presentation; scope filter application; exploration interaction                                                                                  |

---

## Global Statistics

| Attribute                 | Definition                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source**                | **Participation Public Statistics Projection**                                                                                                                  |
| **Purpose**               | Display aggregated measurable civic participation                                                                                                               |
| **Consumed by block**     | Statistics (World scope — UI: Global Statistics)                                                                                                                |
| **Architectural content** | Public-safe counts and derived indicators at scope; derived values explicitly marked in projection semantics; no operational totals requiring workspace context |
| **Capability 02 owns**    | Aggregation rules over public projections; derivation labeling semantics                                                                                        |
| **Capability 03 owns**    | Statistics block presentation; Context Introduction; honest empty states                                                                                        |

---

## Participation Pipeline

| Attribute                 | Definition                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source**                | **Participation Pipeline Public Projection**                                                                                                                  |
| **Purpose**               | Display aggregate distribution across participation stages                                                                                                    |
| **Consumed by block**     | Initiative Levels (UI: Participation Pipeline)                                                                                                                |
| **Architectural content** | Stage labels using Participation pipeline civic vocabulary; counts or proportions per stage at scope; Impact stage omitted or marked future if no public data |
| **Capability 02 owns**    | Stage taxonomy; public-safe stage distribution from initiative and path public projections                                                                    |
| **Capability 03 owns**    | Pipeline block presentation; optional filter entry to Initiatives destination                                                                                 |

---

## Latest Global Initiatives

| Attribute                 | Definition                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source**                | **Initiative Public Projection**                                                                                                                                 |
| **Purpose**               | Display recent public initiatives                                                                                                                                |
| **Consumed by block**     | Latest Initiatives (UI: Latest Global Initiatives)                                                                                                               |
| **Architectural content** | Initiative subject title; public pipeline stage indicator; public-safe summary; link reference to initiative public detail projection; recency ordering metadata |
| **Capability 02 owns**    | `PublicInitiativeProjection` and path-stage public summary fields per projection builder rules                                                                   |
| **Capability 03 owns**    | Card presentation; link to Initiative public detail page; scope filtering                                                                                        |

**Note:** Initiative public detail pages consume **full path public projection set** — Initiative, Collaborative Analysis summary, Collective Decision, Petition, Implementation Commitment, Implementation public projections as applicable — still through projection layer only.

---

## Registration Gateway

| Attribute                 | Definition                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Source**                | **Identity Capability** — not Capability 02 Participation                                                |
| **Purpose**               | Allow voluntary transition into Workspace                                                                |
| **Consumed by block**     | Registration Gateway (UI: Join Humanity Union)                                                           |
| **Architectural content** | Registration entry metadata; what registration enables in civic terms — not participation aggregate data |
| **Capability 01 owns**    | Identity and registration flow                                                                           |
| **Capability 03 owns**    | Gateway presentation; placement after Evidence in Global Experience                                      |

Registration Gateway is **cross-capability boundary** — not Participation projection — but listed here because Global Experience composition includes it adjacent to Participation Evidence blocks.

---

## Footer

| Attribute                         | Definition                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------- |
| **Source**                        | **Platform configuration**                                                       |
| **Purpose**                       | Navigation and transparency                                                      |
| **Consumed by block**             | Footer                                                                           |
| **Architectural content**         | Legal, accessibility, contact, secondary links — no Participation aggregate data |
| **Platform / Capability 03 owns** | Footer structure and supporting link configuration                               |
| **Capability 02 owns**            | Nothing in Footer                                                                |

---

## Projection summary table

| Global Experience block   | Architectural projection source            | Capability owner         |
| ------------------------- | ------------------------------------------ | ------------------------ |
| Interactive Map           | Public Geographic Participation Projection | Capability 02            |
| Global Statistics         | Participation Public Statistics Projection | Capability 02            |
| Participation Pipeline    | Participation Pipeline Public Projection   | Capability 02            |
| Latest Global Initiatives | Initiative Public Projection               | Capability 02            |
| Registration Gateway      | Identity Capability                        | Capability 01            |
| Footer                    | Platform configuration                     | Platform / Capability 03 |

---

# 5. Projection Rules

All Public Projections consumed by Capability 03 must satisfy:

## Content rules

Public projections:

- **contain no operational identifiers** exposed to visitors beyond public-safe reference IDs where policy permits linking;
- **contain no private participant information** — no participant IDs, personal workload, private signatures detail beyond public petition rules, recorder identity, storage paths;
- **contain no editable data** — read-only public representations;
- **contain only information approved for public visibility** per aggregate public projection specifications and Participation Architecture Freeze.

## Behaviour rules

Public projections are **read-only** at the Capability 03 boundary.

Public Experience must not:

- PATCH, POST or DELETE through projection consumption;
- treat projection fields as input forms for participation state;
- merge operational and public models into dual-purpose DTOs.

## Builder authority

Capability 02 **projection builders** own sanitization and public field selection.

Capability 03 must not re-sanitize by re-interpreting operational sources — if projection is wrong, fix builder in Capability 02.

Capability 03 may:

- filter by geographic scope;
- select subsets for block Evidence;
- attach Context Introduction copy;
- compose multiple projection contracts into one page.

## Derived values

Derived civic indicators in projections must carry **derived semantics** visible to Capability 03 presentation — Capability 03 must label derived values in Experience Block Evidence layer.

Capability 03 must not re-derive Participation authority.

---

# 6. Geographic Filtering

**Capability 03 never duplicates geographic data.**

Geographic truth originates in Capability 02 public projections — associated with initiatives and participation paths as public-safe geographic metadata.

## Filtering model

```
Capability 02 exposes public projections with geographic eligibility metadata

↓

Capability 03 applies scope filter (World | Country | Region | future)

↓

Experience Blocks consume filtered projection rows
```

Capability 02 exposes **filterable public projections** — not separate projection types per geography unless architecturally required for performance at implementation time.

Architectural contract remains **identical per scope**.

## Global Experience consumes

| Scope                        | Projection consumption                               |
| ---------------------------- | ---------------------------------------------------- |
| **World**                    | Unfiltered or globally aggregated public projections |
| **Country**                  | Country-filtered public projections                  |
| **Region**                   | Region-filtered public projections                   |
| **Future geographic levels** | Same filter parameter model                          |

Global Experience at Epic 02 consumes **World-level** projections.

Country and Region consume **same projection contracts** — filtered — in future Geographic Experience epics.

Forbidden:

- Capability 03 maintaining parallel geographic participation database;
- Capability 02 building Country-specific public page DTOs;
- geographic fork of projection rules per Experience Block.

**Filter Instead of Duplicate** applies at integration boundary.

---

# 7. Trust Model

Public projections support Capability 03 trust principles:

| Principle                        | Projection support                                                             |
| -------------------------------- | ------------------------------------------------------------------------------ |
| **Explainable Honesty**          | Projections expose only public-safe fields; derived semantics explicit         |
| **Trust Through Verification**   | Visitor can trace block Evidence to initiative detail public projections       |
| **Observable civic activity**    | Projections surface recorded public participation state — not marketing claims |
| **Independent visitor judgment** | Projections present evidence — not platform conclusions                        |

**Projections expose evidence rather than conclusions.**

Examples:

- Initiative Public Projection shows stage and public summary — not "approved good idea";
- Participation Public Statistics Projection shows counts — not "overwhelming support";
- Public Implementation projection shows derived progress — labeled derived — not "verified complete execution";
- Pipeline projection shows distribution — not "healthy democracy score".

Capability 02 projection builders must not embed persuasive or certification language.

Capability 03 Context Introduction explains significance — projections supply Evidence.

Trust strengthens when visitor drills from Statistics → Latest Initiatives → Initiative detail public projections — same projection discipline at each layer.

---

# 8. Version 1 Scope

## Epic 02 — Global Experience

Epic 02 currently consumes **World-level public projections** for:

- Public Geographic Participation Projection
- Participation Public Statistics Projection
- Participation Pipeline Public Projection
- Initiative Public Projection (recency list)

## Geographic Experience — future

**Country and Region projections reuse the same architecture.**

Same projection contracts.

Scope filter applied by Capability 03.

No architectural redesign required for Geographic Experience epics.

## Existing Capability 02 public projections

Version 1 implementation composes architectural contracts from existing aggregate public projection patterns where available:

- Initiative → `PublicInitiativeProjection`
- Collaborative Analysis → public analysis summary projections
- Collective Decision → `PublicCollectiveDecisionProjection`
- Petition → `PublicPetitionProjection`
- Implementation Commitment → `PublicImplementationCommitmentProjection`
- Implementation → `PublicImplementationProjection`

Architectural contracts in Section 4 may **aggregate** multiple aggregate projections — Capability 03 still consumes only resulting public projection layer outputs, never operational aggregates.

## Out of scope

- Media, Knowledge, Institutions projection integration — future capabilities;
- Impact public projections — Stage 8 future epic;
- Real-time live activity projection streams — future extension.

---

# 9. Future Evolution

Future capabilities may expose **additional public projections**.

Public Experience extends by **consuming new projections** — not by accessing new aggregates directly.

| Future projection (examples)          | Potential block                                                           |
| ------------------------------------- | ------------------------------------------------------------------------- |
| **Public Events**                     | Exploration / Media-adjacent blocks                                       |
| **Impact summaries**                  | Statistics or Initiative detail extensions                                |
| **Media trust indicators**            | Trusted Media Carousel                                                    |
| **Knowledge statistics**              | Knowledge Categories                                                      |
| **Volunteer participation summaries** | Statistics — only if distinct from Implementation Commitment public rules |

## Extension rules

- new projection → new or extended Experience Block in Block Library;
- existing blocks extend dataset — projection contract version increment if needed;
- Capability 03 never bypasses projection layer for convenience;
- Capability 02 never embeds Public Experience block logic in aggregates.

**Public Experience extends through new projections rather than direct aggregate access.**

Geographic future levels extend filter parameters — not projection architecture.

---

# 10. Architectural Principles Confirmed

This integration architecture confirms:

| Principle                                       | Confirmation                                               |
| ----------------------------------------------- | ---------------------------------------------------------- |
| **Capability independence**                     | C02 owns participation truth; C03 owns public presentation |
| **Projection-based integration**                | Single boundary — Public Projection Layer                  |
| **Operational / Public separation**             | No operational aggregate access from C03                   |
| **Read-only public data**                       | Projections consumed read-only at public boundary          |
| **Filter Instead of Duplicate**                 | Geographic and scope variation through filtering           |
| **Trust Through Verification**                  | Traceable public projection evidence chain                 |
| **Explainable Honesty**                         | No conclusion language in projections; derived labeling    |
| **Future Extension Without Present Complexity** | New projections attach — aggregates stable                 |

Epic 01 and Epic 02 architecture reviews **CONDITIONAL** on this document — integration map now defined at architectural level.

Implementation APIs remain deferred.

---

# 11. Final Statement

**Capability 02 provides verified public representations of civic participation.**

Participation aggregates record civic truth.

Projection builders transform that truth into society-safe public representations.

**Capability 03 transforms those representations into meaningful public understanding.**

Experience Blocks compose projections.

Visitors observe, understand and evaluate.

**Neither capability replaces the responsibility of the other.**

Capability 02 without Capability 03 leaves society without coherent public civic space.

Capability 03 without Capability 02 projections would expose operational internals or fabricate civic data — both forbidden.

Together they establish Humanity Union's **public civic experience** while preserving:

- aggregate independence;
- privacy;
- long-term architectural stability.

Public projections are the contract between them.

This document defines that contract at architectural level.

Implementation follows.

Neither capability crosses the boundary without Architecture Review.

---

# References

| Document                                   | Path                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Epic 01 Architecture Freeze                | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`                |
| Epic 02 Architecture Review                | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/EPIC_02_ARCHITECTURE_REVIEW.md`                |
| Public Space Architecture                  | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`                  |
| Global Experience Content Architecture     | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md`     |
| Global Experience Interaction Architecture | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_INTERACTION_ARCHITECTURE.md` |
| Participation Architecture Freeze          | `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`                                      |
| Experience Block Library                   | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`            |

---

# Document Status

**Draft**

Capability 02 Projection Integration — Epic 02 Global Experience

Closes Epic 02 architecture review condition on public projection integration map at architectural level.

API and builder specifications remain future implementation artifacts.
