# EPIC 04 ARCHITECTURE FREEZE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 04 — Region Experience

Version: 1.0

Status: Frozen

---

# 1. Purpose

Freeze the approved architecture of Epic 04 — **Region Experience** for Public Experience Version 1.

This document records architectural decisions approved during Epic 04 architecture review and establishes the **Version 1 implementation baseline**.

After this freeze:

- future implementation shall **conform to this architecture** and referenced Epic 04 documents;
- architectural changes require **formal Architecture Review** or approved freeze version increment;
- implementation must not redefine block sequence, narrative, interaction model, geographic boundaries, Community Discovery rules, projection integration or trust principles.

**Version 1 Region Experience architecture is frozen.**

This document records **architectural intent only**.

It does not define implementation.

It does not authorize features beyond frozen Version 1 scope.

Reference:

- `EPIC_04_ARCHITECTURE_REVIEW.md`
- `REGION_EXPERIENCE_VISION.md`
- `REGION_EXPERIENCE_NARRATIVE.md`
- `REGION_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `REGION_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `REGION_PAGE_TEMPLATE_STANDARD.md`
- `COMMUNITY_CONTEXT_DECISION.md`
- `EPIC_03_ARCHITECTURE_FREEZE.md`

Epic 01 Information Space architecture remains **Frozen** and governs all Capability 03 work.

Epic 02 Global Experience architecture remains **Frozen** — Epic 02 implementation at World scope is the **reference** for original template behaviour.

Epic 03 Country Experience architecture remains **Frozen** — Epic 03 is the **direct inheritance reference** for Region Experience.

Epic 04 freeze applies **Region Experience at Region scope** within Epic 01, Epic 02 and Epic 03 foundation.

---

# 2. Approved Scope

Version 1 scope is **frozen** as follows.

## In scope

- **Region-level Region Experience only** — architectural **Geographic Experience at Region scope**;
- regional public civic presentation within Humanity Union Public Space **within named country context**;
- frozen Experience Block sequence (Section 3);
- global chrome required by Epic 01 — Header, Geographic Navigator, Footer;
- consumption of Capability 02 public projections filtered to region scope per `CAPABILITY_02_PROJECTION_INTEGRATION.md`;
- **Region Identity** — regional orientation within country;
- **Regional Interactive Map** — region-scoped geographic Evidence; community association highlights;
- **Regional Statistics** — region-scoped aggregate public participation indicators;
- **Regional Participation Pipeline** — region-scoped stage distribution;
- **Latest Regional Initiatives** — region-associated public initiative examples;
- **Community Discovery** — participant-created community associations; scope transition toward Community Experience;
- **Registration Gateway** — voluntary participation entry after regional observation;
- **Footer** — supporting navigation and institutional transparency;
- public reading without account requirement.

## Explicitly excluded from Version 1

| Exclusion                                | Handled by                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Community Experience**                 | Future epic bound to `COMMUNITY_CONTEXT_DECISION.md`                                                                                   |
| **Find Your Community**                  | Community Experience — not Region scope                                                                                                |
| **Community search**                     | Community Experience — participant-driven discovery                                                                                    |
| **Identity integration**                 | Beyond Registration Gateway link to existing Identity entry                                                                            |
| **Personalized content**                 | Must not gate public Evidence                                                                                                          |
| **Local administrative levels**          | Future civic context through Community Experience or Architecture Review — District, Municipality, City, Village, Indigenous Territory |
| **Community-specific statistics blocks** | Community Experience — not Region page                                                                                                 |
| **Community Identity block**             | Community Experience — not Region page                                                                                                 |

Epic 04 does **not** introduce new header destinations, block catalog forks or page template families.

Region Experience is a **filter variant** of Country Experience — not a separate product architecture.

---

# 3. Approved Experience Blocks

The **canonical Region Experience block sequence** is frozen:

| Order | UI name (Region scope)          | Architectural block            |
| ----- | ------------------------------- | ------------------------------ |
| **1** | Region Identity                 | Hero · Geographic Summary      |
| **2** | Regional Interactive Map        | Interactive Map                |
| **3** | Regional Statistics             | Statistics (Region scope)      |
| **4** | Regional Participation Pipeline | Initiative Levels              |
| **5** | Latest Regional Initiatives     | Latest Initiatives             |
| **6** | Community Discovery             | Exploration (scope transition) |
| **7** | Join Humanity Union             | Registration Gateway           |
| **8** | Footer                          | Footer                         |

## Global chrome (required)

- **Header** — six frozen primary destinations — unchanged at region scope
- **Geographic Navigator** — Region active within Country; Country and World ascent

## Canonical sequence statement

**This sequence forms the canonical Region Experience.**

Block order is narrative order — not optional reordering at implementation.

## Inheritance matrix (frozen)

| Global / Country pattern         | Region Experience               |
| -------------------------------- | ------------------------------- |
| Civic / Country Identity         | Region Identity                 |
| Interactive Map                  | Regional Interactive Map        |
| Statistics                       | Regional Statistics             |
| Participation Pipeline           | Regional Participation Pipeline |
| Latest Initiatives               | Latest Regional Initiatives     |
| Country **Regional Exploration** | Region **Community Discovery**  |
| Registration Gateway             | Registration Gateway            |
| Footer                           | Footer                          |

Country **Regional Exploration** prepared descent to Region.

Region **Community Discovery** prepares descent to Community Experience.

Optional secondary block **About Preview** from Block Library remains **deferred** — not part of Version 1 Region Experience composition.

Full block definitions: `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`

Content responsibility per block: `REGION_EXPERIENCE_CONTENT_ARCHITECTURE.md`

Page composition: `REGION_PAGE_TEMPLATE_STANDARD.md`

---

# 4. Geographic Architecture

The approved **geographic hierarchy** is frozen:

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

## Frozen geographic statements

**Only geographic scope changes.**

**Architectural language remains identical.**

- same page template flow — Identity through Supporting Navigation;
- same Experience Block catalog and responsibility model;
- same header destinations, interaction philosophy and trust model;
- same Context Before Evidence structure on every block;
- scope transitions change **filter only** — not page anatomy.

Region Experience sits **between Country and Community** in public observation hierarchy.

Country parent context is **mandatory** — region always locatable within named country.

Primary geographic descent at Region scope: **Region → Community**.

Ascent paths preserved: Community → Region → Country → World.

Region Experience must not answer **what is happening around this community** — that belongs to Community Experience.

---

# 5. Community Discovery

The approved **Community Discovery** decision is frozen per `REGION_EXPERIENCE_CONTENT_ARCHITECTURE.md`, `REGION_EXPERIENCE_INTERACTION_ARCHITECTURE.md` and `REGION_PAGE_TEMPLATE_STANDARD.md`.

## Frozen Community Discovery rules

| Rule                                           | Frozen statement                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Introduces participant-created communities** | Surfaces communities with public activity **associated to the region** — created through participation |
| **Exploration rather than search**             | Browse associations — **not** search interface; no query box on Region page                            |
| **Not administrator-maintained directory**     | Associations reflect civic activity — not exhaustive admin catalog as sole truth                       |
| **Prepares Community Experience**              | Links forward to community-scoped observation — does not implement Community blocks                    |

## Community Discovery display (frozen summary fields)

Public-safe association preview only:

- Community Name;
- Short Description;
- Activity Area — separate from Community naming; no keyword duplication with Description;
- summary public statistics — not full Community Statistics block duplication;
- link to Community Experience.

## Find Your Community boundary

**Find Your Community belongs exclusively to Community Experience.**

| Region Experience                        | Community Experience                          |
| ---------------------------------------- | --------------------------------------------- |
| Community Discovery — association browse | Find Your Community — participant name search |
| Prepares Community descent               | Completes local observation                   |
| No search field                          | Search field as block 1 composition priority  |

**Community Discovery precedes Community Search** architecturally — Region prepares; Community searches.

Omission of community associations when none exist is **architectural honesty** — not failure.

---

# 6. Interaction Model

The approved **Learning Path** is frozen for Region Experience:

```
Observe

↓

Understand

↓

Explore

↓

Discover Communities

↓

Evaluate

↓

Participate
```

## Harmonization with Country and Epic 01 Visitor Journey

| Interaction Learning Path | Country / Global analogue            | Visitor Journey (Epic 01)   |
| ------------------------- | ------------------------------------ | --------------------------- |
| Observe                   | Observe                              | Discover                    |
| Understand                | Understand the Country / Region      | Understand                  |
| Explore                   | Explore Regional / National Activity | Discover · Understand depth |
| Discover Communities      | _(Region extension)_                 | Discover · Understand depth |
| Evaluate                  | Evaluate                             | Trust                       |
| Participate               | Participate (optional)               | Register · Participate      |

Region path **extends** Country path with **Discover Communities** — it does not replace Observe–Evaluate discipline.

## Frozen interaction confirmation

**Region Experience preserves the interaction architecture inherited from Country Experience.**

Interaction philosophy frozen: voluntary, predictable, reversible, explainable, respectful, calm.

**Every interaction increases understanding rather than encouraging immediate participation.**

End-to-end flow frozen:

```
Visitor → Region Experience → Regional Exploration → Community Discovery → Community Experience → Registration (optional) → Workspace
```

Inherited from Country Experience without regional exception:

- same header navigation outcomes;
- same Geographic Navigator scope-change semantics;
- same map interaction class — regional and community association entry;
- same initiative public detail entry;
- same Registration Gateway ethics — after Evidence and Community Discovery weight;
- same Context Before Evidence on all blocks;
- same reversibility — Country and World ascent always available.

Full specification: `REGION_EXPERIENCE_INTERACTION_ARCHITECTURE.md`

---

# 7. Context Before Evidence

The canonical **block structure** is frozen:

```
Heading

↓

Context Introduction

↓

Evidence

↓

Visitor Conclusion
```

## Frozen statements

**No exceptions.**

**Humanity Union presents evidence.**

**Visitors form conclusions independently.**

Context Introduction:

- explains significance;
- never persuades;
- never replaces evidence;
- remains concise.

Evidence:

- originates from responsible Capabilities through public projections filtered to region;
- includes derived values labeled derived;
- permits honest empty or sparse regional states;
- never fabricates activity or community associations.

Visitor Conclusion:

- visitor judges — platform does not conclude for them;
- no regional certification or administrative boosterism messaging.

Community Discovery Context Introduction must clarify **Region vs Community scope** before association Evidence.

Registration Gateway Context Introduction precedes invitation action — not Region Identity Hero.

Content before Layout — frozen discipline from `REGION_EXPERIENCE_CONTENT_ARCHITECTURE.md`.

---

# 8. Architectural Principles Confirmed

The following principles are **frozen** for Epic 04 Version 1:

| Principle                                            | Frozen application                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **One Experience Block — One Responsibility**        | Each block in Section 3 owns exactly one architectural duty — no duplicated evidence or navigation |
| **Context Before Evidence**                          | Mandatory four-layer block structure — Section 7                                                   |
| **Observation precedes participation**               | Registration Gateway after regional Evidence and Community Discovery                               |
| **Navigation serves intentions**                     | Header primary destinations; Region → Community primary geographic descent                         |
| **Trust Through Verification**                       | Projection traceability; exploration over messaging at region scope                                |
| **Explainable Honesty**                              | Derived labeling; honest sparse regional and community association states                          |
| **Filter Instead of Duplicate**                      | Region scope filters datasets — block responsibilities stay distinct                               |
| **Future Extension Without Present Complexity**      | Deferrals Section 9 — not architectural gaps                                                       |
| **Communities are discovered through participation** | Organic community growth — Community Discovery surfaces associations only                          |
| **Community Discovery precedes Community Search**    | Browse at Region scope; Find Your Community search at Community Experience only                    |

Epic 01, Epic 02 and Epic 03 frozen principles remain binding — Epic 04 does not override prior freezes.

Additional binding statements:

- **Public Space never persuades. It reveals.** — no regional conversion pressure;
- **Every interaction increases understanding** — Interaction model Section 6;
- Region pages reveal public civic records — they do not perform administrative authority advocacy.

---

# 9. Version 1 Deferrals

The following are **intentionally deferred** — future capabilities, **not architectural gaps**:

| Deferred item                       | Notes                                                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Community Experience**            | Bound to `COMMUNITY_CONTEXT_DECISION.md` — inherits Region handoff                                                                                    |
| **Find Your Community**             | Community Experience block 1 — search not Region scope                                                                                                |
| **Community search implementation** | Participant-driven — Community Experience only                                                                                                        |
| **Identity integration**            | Deeper Identity Capability integration beyond Registration Gateway entry                                                                              |
| **Live projection APIs**            | Real-time refresh pattern — same blocks, future capability                                                                                            |
| **Advanced filters**                | Exploration extension — must not replace block sequence                                                                                               |
| **Bookmarks**                       | Visitor convenience — must not gate public Evidence                                                                                                   |
| **AI Discovery Assistant**          | Explain-only — never decides, registers or certifies                                                                                                  |
| **Local administrative hierarchy**  | District, Municipality, City, Village, Indigenous Territory — through Community Experience or Architecture Review, not Region template multiplication |
| **Trusted Regional Media**          | **Deferred unless formally approved** — optional slot between Latest Regional Initiatives and Community Discovery only through Architecture Review    |

Optional Region secondary block **About Preview** — deferred from required composition.

Implementation artifacts deferred separately: visual design system, frontend components, backend services, APIs, region-scoped projection filter adjunct, community-regional association contract extension, regional copy freeze, regional representative image governance policy, bootstrap demo data specification.

Deferral preserves Version 1 narrow purpose — **Region Experience at regional scope only**.

---

# 10. Future Evolution

**Future Community Experience inherits Region Experience architecture.**

```
Region Experience block architecture

+ community scope parameter

= Community Experience
```

## Extension rules

- new Experience Blocks slot into frozen page flow stages — Architecture Review required;
- new public projections attach at Capability 02 boundary — not aggregate access;
- Community Experience reuses canonical block sequence pattern — community filter and copy;
- deeper local administrative levels integrate through **Community Experience** — not by multiplying Region page templates;
- new header destinations require Architecture Review;
- `REGION_PAGE_TEMPLATE_STANDARD.md`, `COUNTRY_PAGE_TEMPLATE_STANDARD.md`, `PUBLIC_PAGE_TEMPLATE_STANDARD.md` and interaction principles apply to all future public pages.

**Only geographic scope, public datasets, and community context change.**

**No redesign is required.**

Architectural language, block responsibility model, Context Before Evidence, interaction philosophy and trust model remain identical.

## Forbidden evolution

- parallel Region Experience architecture or RegionPageTemplate fork;
- Find Your Community or Community blocks on Region page;
- Community Discovery implemented as search interface;
- operational aggregate access from Capability 03;
- registration gating on public Evidence;
- block sequence reordering without freeze increment;
- geographic content fork breaking Filter Instead of Duplicate.

---

# 11. Architectural Decisions Recorded

The following transitions are **frozen** for Version 1 Public Space geographic and civic context progression:

## Country Regional Exploration → Region Experience

| Decision                                                            | Meaning                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Country Regional Exploration transitions into Region Experience** | Country block prepares Region descent; Region page completes regional observation |
| **Same template discipline**                                        | Scope filter change — not new product                                             |
| **Reversible ascent**                                               | Region → Country → World preserved                                                |

## Region Community Discovery → Community Experience

| Decision                                                      | Meaning                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Community Discovery transitions into Community Experience** | Region block prepares Community descent; Community page completes local observation |
| **Association browse only at Region**                         | No search on Region page                                                            |
| **Participant-created communities**                           | Associations from participation — not admin catalog monopoly                        |

## Community Experience → Find Your Community

| Decision                                                | Meaning                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Community Experience introduces Find Your Community** | Participant name search — Community Experience block 1 composition priority |
| **Not on Region page**                                  | Community Discovery precedes Community Search                               |

## Public Experience → Workspace boundary

| Decision                                                           | Meaning                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Public Experience ends before Workspace**                        | Registration Gateway is public invitation threshold — not operational environment         |
| **Workspace remains the first personal participation environment** | Governed operational participation after optional registration — Capability 02 workspaces |
| **Observation without account**                                    | Public reading never gated on Region page                                                 |

## Scope question chain (frozen)

```
World   → What is happening in the world?
Country → What is happening in this country?
Region  → What is happening in this region?
Community → What is happening around this community?
Workspace → What can I do personally?
```

Each level owns **one primary observation question**.

---

# 12. Final Statement

**Epic 04 establishes the complete Version 1 architectural foundation for Region Experience.**

Frozen foundation:

- Region-level Geographic Experience scope within named country;
- canonical eight-block sequence plus global chrome;
- approved regional narrative — explains before it invites per `REGION_EXPERIENCE_NARRATIVE.md`;
- page flow, interaction model and Context Before Evidence structure;
- Capability 02 public projection integration filtered to region scope;
- Community Discovery boundaries — exploration, not search; prepares Community Experience;
- inheritance from Country Experience — Regional Exploration → Community Discovery handoff;
- trust, calm and observation-before-participation principles at regional scope.

**Region Experience narrows Humanity Union's public civic perspective from regions toward communities while preserving one architectural language, one interaction model, and one public trust model.**

**Future implementation shall preserve the approved narrative, interaction model, trust principles, and geographic progression established by this architecture.**

**Any future architectural changes require formal Architecture Review before implementation.**

Valid change paths:

1. **Architecture Review**
2. **Engineering Decision** — bounded interpretation within frozen architecture
3. **New freeze version** — explicit version increment and approval

Accidental architecture evolution is forbidden.

Implementation follows architecture.

Architecture never follows implementation convenience.

One Humanity.

Many Countries.

Many Regions.

Many Communities.

Shared Future.

One architecture — observed globally, understood nationally, explored regionally, completed communally.

---

# Architecture Review Resolution

Epic 04 review status at freeze:

| Review condition                                            | Resolution                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Architecture review **APPROVED**                            | Confirmed — this freeze                                                                        |
| `REGION_PAGE_TEMPLATE_STANDARD.md`                          | **Closed** — Section 3 reference                                                               |
| Community Exploration vs Community Discovery naming         | **Closed** — frozen name **Community Discovery** throughout this freeze                        |
| Inheritance matrix Country → Region                         | **Closed** — Section 3                                                                         |
| Region-scoped projection and community association contract | **Implementation planning** — extend `CAPABILITY_02_PROJECTION_INTEGRATION.md` before Sprint 1 |
| Community Experience route when not live                    | **Implementation planning** — disable links or honest stub with Region return                  |
| Trusted Regional Media                                      | **Closed** — deferred Section 9 unless Architecture Review authorizes                          |
| Community Experience full epic                              | **Deferred** — Section 9 — bound to Community Discovery handoff                                |
| Flow harmonization                                          | **Closed** — Section 6                                                                         |

Epic 04 Region Experience architecture is **approved and locked**.

---

# Source Documents

| Document                                   | Path                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Epic 04 Architecture Review                | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/EPIC_04_ARCHITECTURE_REVIEW.md`                |
| Epic 03 Architecture Freeze                | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/EPIC_03_ARCHITECTURE_FREEZE.md`               |
| Epic 02 Architecture Freeze                | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/EPIC_02_ARCHITECTURE_FREEZE.md`                |
| Epic 01 Architecture Freeze                | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`                |
| Region Experience Vision                   | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_VISION.md`                   |
| Region Experience Narrative                | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_NARRATIVE.md`                |
| Region Experience Content Architecture     | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_CONTENT_ARCHITECTURE.md`     |
| Region Experience Interaction Architecture | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_EXPERIENCE_INTERACTION_ARCHITECTURE.md` |
| Region Page Template Standard              | `capabilities/03_public_experience/EPIC_04_REGION_EXPERIENCE/REGION_PAGE_TEMPLATE_STANDARD.md`              |
| Community Context Decision                 | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COMMUNITY_CONTEXT_DECISION.md`                |
| Country Page Template Standard             | `capabilities/03_public_experience/EPIC_03_COUNTRY_EXPERIENCE/COUNTRY_PAGE_TEMPLATE_STANDARD.md`            |
| Public Page Template Standard              | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`              |
| Capability 02 Projection Integration       | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/CAPABILITY_02_PROJECTION_INTEGRATION.md`       |
| Experience Block Library                   | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`            |

---

# Architecture Status

**FROZEN**

Version 1 architecture of Epic 04 — **Region Experience** is locked.

Implementation planning may proceed under this freeze, Epic 03 freeze, Epic 02 freeze and Epic 01 freeze.

Change requires governance — not engineering convenience.

---

# Document Status

**Frozen**

Epic 04 Architecture Freeze — Region Experience Version 1.0
