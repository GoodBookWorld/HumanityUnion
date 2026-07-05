# IMPLEMENTATION PLAN

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 03 — Country Experience

Version: 1.0

Status: Draft

---

# 1. Purpose

Define the **implementation strategy** for Epic 03 — **Country Experience**.

This plan transforms the approved frozen architecture into **incremental implementation milestones** while preserving architectural integrity.

**Implementation follows the approved architecture.**

**No architectural decisions are introduced during implementation.**

| Rule                                     | Meaning                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Architecture precedes implementation** | No engineering sprint begins without frozen spec reference                                              |
| **Freeze governs**                       | `EPIC_03_ARCHITECTURE_FREEZE.md` is binding                                                             |
| **Epic 02 governs reference behaviour**  | `EPIC_02_ARCHITECTURE_FREEZE.md` and Global Experience implementation are the block behaviour reference |
| **Epic 01 governs platform**             | `EPIC_01_ARCHITECTURE_FREEZE.md` remains binding for blocks, navigation, principles                     |
| **Projection boundary governs data**     | `CAPABILITY_02_PROJECTION_INTEGRATION.md` is binding for Capability 02 consumption                      |

This plan defines **strategy and sequencing only**.

It does not define detailed code, component APIs, CSS or backend endpoints.

Architecture references:

- `EPIC_03_ARCHITECTURE_FREEZE.md`
- `EPIC_03_ARCHITECTURE_REVIEW.md`
- `COUNTRY_PAGE_TEMPLATE_STANDARD.md`
- `COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `COUNTRY_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `COMMUNITY_CONTEXT_DECISION.md`
- `PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `CAPABILITY_02_PROJECTION_INTEGRATION.md`

Platform references:

- `EPIC_02_ARCHITECTURE_FREEZE.md`
- `EPIC_01_ARCHITECTURE_FREEZE.md`
- `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`
- `NAVIGATION_ARCHITECTURE.md`

---

# 2. Version 1 Scope

Epic 03 Version 1 implementation includes **only**:

| In scope                            | Description                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| **Country Experience page**         | Country-scoped public square — architectural Geographic Experience at Country scope |
| **Country Identity**                | Hero · Geographic Summary — national orientation without promotion                  |
| **National Interactive Map**        | Country-filtered geographic Evidence; region entry within country                   |
| **National Statistics**             | Country-scoped aggregate public participation indicators                            |
| **National Participation Pipeline** | Country-scoped pipeline stage distribution                                          |
| **Latest National Initiatives**     | Country-associated public initiative examples                                       |
| **Trusted National Media**          | Optional supporting media — omitted when no public-safe country associations exist  |
| **Regional Exploration**            | Scope transition block preparing Region Experience descent                          |
| **Registration Gateway**            | Secondary-zone entry to Identity registration — not full auth implementation        |
| **Footer**                          | Supporting navigation, legal and accessibility links                                |

## Global chrome in scope

- **Header** — six frozen primary destinations — unchanged at country scope
- **Geographic Navigator** — Country active; World ascent enabled; Region descent **disabled or honest stub** until Region Experience epic ships (per Epic 03 freeze Architecture Review Resolution)

## Canonical block sequence (frozen)

1. Country Identity
2. National Interactive Map
3. National Statistics
4. National Participation Pipeline
5. Latest National Initiatives
6. Trusted National Media (optional — sequence slot skipped when omitted)
7. Regional Exploration
8. Registration Gateway
9. Footer

## Explicitly excluded

| Exclusion                                    | Notes                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Region Experience**                        | Future Geographic Experience epic — Region links stubbed or disabled at Country launch |
| **Community Experience**                     | Future epic bound to `COMMUNITY_CONTEXT_DECISION.md`                                   |
| **Identity implementation**                  | Registration Gateway links to existing Identity entry only — not full auth epic        |
| **Personalized content**                     | Must not gate public Evidence                                                          |
| **Find Your Community**                      | Community Experience — not Country scope                                               |
| **Community search**                         | Community Experience — participant-driven discovery                                    |
| **Community-specific statistics**            | Community Experience — not Country page                                                |
| **New header destinations**                  | Frozen at six                                                                          |
| **Operational aggregate access**             | Projection layer only                                                                  |
| **Capability 02 store or workspace changes** | Out of Epic 03 ownership unless required for projection contract fulfillment           |

Epic 03 **reuses** Global Experience architectural patterns where block names match — Country is a **filter variant**, not a separate product implementation fork.

---

# 3. Implementation Principles

All Epic 03 engineering must confirm:

| Principle                           | Application                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Vertical slices**                 | Each sprint delivers demonstrable Country Experience increment — not horizontal layer-only sprints that block verification        |
| **Incremental delivery**            | Repository remains demonstrable after every sprint                                                                                |
| **Architecture-first**              | Sprint work references Epic 03 freeze sections — drift triggers review stop                                                       |
| **Projection-only public data**     | Capability 03 reads only public projection layer for Participation blocks — country scope filter applied at presentation boundary |
| **Repository always buildable**     | Typecheck passes; web app serves Country Experience route without broken build                                                    |
| **No operational aggregate access** | No operational API or workspace models on Country Experience page                                                                 |

Additional frozen Epic 03 principles preserved throughout:

- Context Before Evidence — Heading → Context Introduction → Evidence → Visitor Conclusion on every block
- Observation precedes participation — Registration Gateway after Evidence and Regional Exploration
- One Experience Block — One Responsibility — Filter Instead of Duplicate
- Public Space never persuades — reveals — no nationalist conversion pressure
- Every interaction increases understanding
- Communities are discovered through participation — **not implemented at Country scope**

---

# 4. Sprint Structure

Seven sprints.

Each sprint ends with verification per Section 5.

No sprint begins until prior sprint review completes — except documented parallel prep that does not merge incomplete architecture.

Epic 02 Global Experience implementation is the **reference** for shared block behaviour — Epic 03 extends through country scope parameter and geographic adaptation blocks only.

---

## Sprint 1 — Country Experience shell

**Goal:** Establish Country Experience route and public chrome foundation at country scope.

### Deliverables

- Country Experience route — country-scoped public URL pattern serving one country per request context
- Entry from Global Experience — Geographic Navigator and/or Interactive World Map country selection navigates to Country Experience when bootstrap country data exists
- **Header** — six primary destinations per Navigation Architecture — unchanged labels and behaviour
- **Geographic Navigator** — Country scope displayed when on Country page; World ascent enabled; Region transitions disabled or stubbed per launch policy
- Responsive page foundation implementing `COUNTRY_PAGE_TEMPLATE_STANDARD.md` zones — global chrome, page context slot, primary content slot, secondary slot — without final block content
- Country Experience module structure aligned with Global Experience conventions — no architectural fork

### Architectural checkpoints

- Header labels match frozen destinations — civic language only
- No Registration Gateway in header
- No Find Your Community or community search surfaces
- Template zones exist — layout serves architecture, not invented structure
- Country page is recognizably the same Public Space as Global Experience — scope label differs only

### Sprint 1 verification

- Country route HTTP 200 for bootstrap country
- World → Country navigation works from Global Experience where enabled
- World ascent from Country Geographic Navigator works
- Header navigation present and stable
- Typecheck passes

---

## Sprint 2 — Country Identity · National Interactive Map

**Goal:** Implement Identity and opening Evidence narrative stages at country scope.

### Deliverables

- **Country Identity** block
  - country name and scope label
  - Context Introduction per `COUNTRY_EXPERIENCE_CONTENT_ARCHITECTURE.md`
  - optional national flag and landscape per content architecture — policy-governed neutrality
  - no statistics, initiatives, regional catalogs or registration in Identity
- **National Interactive Map** block
  - Context Before Evidence structure — Heading → Context Introduction → Evidence → Visitor Conclusion
  - map interaction architecture per Interaction doc — national civic activity within country; region entry points within country boundaries
  - no Region Experience page navigation until Region epic unless stub policy approved

### Projection integration

- Wire map to **Public Geographic Participation Projection** contract with **country scope filter** — mock or bootstrap projection acceptable for sprint if labeled development bootstrap; must not use operational aggregates

### Sprint 2 verification

- Country Identity + National Map render in canonical order
- Context Introduction precedes map Evidence
- No narrative stage violation — registration absent
- Country Identity orients — does not promote
- Typecheck passes

---

## Sprint 3 — National Statistics · National Participation Pipeline

**Goal:** Implement national Understanding narrative stage — measurable participation at country scope.

### Deliverables

- **National Statistics** block
  - Context Introduction per Content Architecture
  - derived values labeled in presentation layer
  - honest empty/sparse country state supported
- **National Participation Pipeline** block (Initiative Levels)
  - Capability 02 stage vocabulary unchanged
  - Context Introduction precedes Evidence

### Projection integration

- **Participation Public Statistics Projection** → National Statistics — **country filter**
- **Participation Pipeline Public Projection** → National Participation Pipeline — **country filter**
- Verify read-only consumption — no operational fields
- Verify projection rules: no participant identity, no operational identifiers beyond public-safe links
- Country scope filter applied per `CAPABILITY_02_PROJECTION_INTEGRATION.md` — Capability 03 owns filter application; Capability 02 owns projection builders

### Sprint 3 verification

- Statistics and Pipeline follow Country Identity and National Map in sequence
- Projection contract respected — integration checklist from `CAPABILITY_02_PROJECTION_INTEGRATION.md`
- Country filter verified — World aggregate data not displayed on Country page
- Derived labeling visible where applicable
- Typecheck passes

---

## Sprint 4 — Latest National Initiatives · Trusted National Media

**Goal:** Implement concrete civic subjects and optional supporting media at country scope.

### Deliverables

- **Latest National Initiatives** block
  - initiative summary cards from **Initiative Public Projection** — country filter
  - Context Introduction per Content Architecture
  - links to Initiative public detail routes (Capability 02 existing public pages where available)
- **Initiative navigation** — card → public detail interaction — same class as Global Experience
- **Trusted National Media** block
  - Context Introduction per Content Architecture
  - supporting media only — never primary Evidence substitute
  - **honest omission** when no public-safe country-associated media exists — sequence slot skipped; no fabricated media
  - governed source labeling — not platform truth claim

### Projection integration

- **Initiative Public Projection** list at country scope
- Verified Media public associations at country scope where capability supplies data — optional block only

### Sprint 4 verification

- Latest National Initiatives after Statistics and Pipeline
- Trusted National Media omitted cleanly when no data — or renders in correct sequence position when data exists
- Initiative links resolve to public projection pages — HTTP 200 on bootstrap data
- No operational workspace URLs as primary public CTA
- Typecheck passes

---

## Sprint 5 — Regional Exploration · Registration Gateway · Footer

**Goal:** Complete Exploration, Participation and Supporting Navigation stages.

### Deliverables

- **Regional Exploration** block
  - Context Introduction explaining Region scope transition
  - region entry list or map cross-links within country where bootstrap region data exists
  - **Region Experience routes disabled or honest stub** with Country return path until Region epic ships
  - does not implement Find Your Community or Community search
- **Registration Gateway** block (Join Humanity Union display label permitted)
  - secondary zone placement — after Evidence and Regional Exploration
  - calm copy per Content Architecture — no urgency or nationalist pressure
  - links to Identity registration entry — not full Identity epic
- **Footer**
  - legal, accessibility, contact supporting links
  - no primary civic Evidence duplication
  - platform configuration source — not Participation projections

### Architectural checkpoints

- Registration Gateway not in Hero or primary Evidence zone
- Regional Exploration prepares Region — does not replace Community Experience
- Footer does not compete with Registration as second conversion stack
- Public reading not gated
- Primary geographic descent at Country: Country → Region — not Country → Community

### Sprint 5 verification

- Full canonical block sequence complete — with Trusted National Media omitted or present per data
- Regional Exploration position correct — after Latest Initiatives and optional Trusted National Media
- Registration Gateway position correct — after Regional Exploration
- Footer complete per Navigation Architecture
- Typecheck passes

---

## Sprint 6 — Accessibility · Responsive · Performance

**Goal:** Non-functional verification without architecture change.

### Deliverables

- **Accessibility review** — Context Introduction and Evidence reachable; heading hierarchy; national map accessibility policy documented; skip link and focus states verified
- **Responsive verification** — information hierarchy preserved desktop / tablet / mobile per `COUNTRY_PAGE_TEMPLATE_STANDARD.md` — not registration-first mobile collapse
- **Performance review** — acceptable load for Country page with bootstrap projections; no architectural change to solve performance — document findings only

### Sprint 6 verification

- Responsive hierarchy checklist passed
- Accessibility issues triaged — blockers fixed within architecture
- Performance baseline recorded
- Typecheck passes
- No architectural drift introduced

---

## Sprint 7 — Architecture verification · Implementation review · Epic closure

**Goal:** Close Epic 03 with formal review.

### Deliverables

- **Architecture verification** against `EPIC_03_ARCHITECTURE_FREEZE.md` checklist
- **Projection integration verification** against `CAPABILITY_02_PROJECTION_INTEGRATION.md` — country scope filter
- **Community boundary verification** against `COMMUNITY_CONTEXT_DECISION.md` — no Find Your Community, community search or community statistics on Country page
- **Interaction verification** against Learning Path and interaction principles
- **Navigation verification** — Global → Country → Region stub policy; World ascent; no Community primary nav at Country scope
- **Implementation review document** — APPROVED or REMEDIATION REQUIRED
- **Documentation update** — implementation review, sprint notes, bootstrap demo description
- **Repository clean** at closure (when authorized by engineering process)

### Sprint 7 verification

- All completion criteria Section 7 satisfied
- Epic 03 closure recorded

---

# 5. Verification Rules

**Every sprint** must satisfy:

| Rule                              | Verification                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typecheck passes**              | Monorepo typecheck command — e.g. `npm exec pnpm -- typecheck`                                                                                                |
| **Architecture preserved**        | Sprint diff reviewed against Epic 03 freeze — block order, principles, scope, Community boundaries                                                            |
| **Projection contract respected** | Participation blocks consume projection layer only with country filter — checklist from `CAPABILITY_02_PROJECTION_INTEGRATION.md`                             |
| **Navigation preserved**          | Six header destinations; Registration Gateway not in header; World ascent from Country; Region stub policy not violated; no Community search at Country scope |
| **No scope expansion**            | No Region Experience, Community Experience, Identity implementation or personalized content introduced under Epic 03 delivery                                 |

## Sprint review gate

Each sprint records:

- deliverables completed;
- verification evidence (typecheck, route check);
- architecture drift assessment — none or escalated to review;
- deferred items unchanged.

Sprint may not close with known freeze violations marked "TODO later."

Bootstrap and mock data must be **explicitly labeled** development bootstrap — not silent fabrication presented as production truth.

---

# 6. Deferred Work

The following remain **outside Version 1** — recorded in Epic 03 freeze, not implementation backlog for this epic:

| Deferred item              | Notes                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| **Region Experience**      | Future Geographic Experience epic — inherits Epic 03 template + region filter |
| **Community Experience**   | Future epic bound to `COMMUNITY_CONTEXT_DECISION.md`                          |
| **Community search**       | Find Your Community — Community Experience primary entry                      |
| **Identity integration**   | Beyond Registration Gateway link to existing Identity entry                   |
| **Live projections**       | Real-time refresh pattern — same blocks, future capability                    |
| **Advanced filters**       | Future Initiatives enhancement — must not replace block sequence              |
| **Bookmarks**              | Future visitor convenience — must not gate public Evidence                    |
| **AI Discovery Assistant** | Explain-only — future; must not violate assistant boundaries                  |

Also deferred from Epic 03 plan:

- Local administrative levels — District, Municipality, City, Village, Indigenous Territory
- Optional secondary block **About Preview**
- National flag governance policy document — required before production copy freeze; bootstrap may use placeholder policy
- Country-scoped projection filter adjunct extension to integration doc — coordinate with Capability 02 owners; Epic 03 consumes, does not redefine projection builders
- Media, Knowledge, Institutions full destination experiences — header links may route to existing stubs

Deferred work is **future epics** — not excuses for partial freeze compliance in Epic 03.

---

# 7. Completion Criteria

Country Experience implementation is **complete only when all** of the following are true:

| Criterion                            | Verification                                                                                                                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **All approved blocks implemented**  | Country Identity, National Interactive Map, National Statistics, National Participation Pipeline, Latest National Initiatives, Trusted National Media (or honest omission), Regional Exploration, Registration Gateway, Footer + Header + Geographic Navigator |
| **Navigation verified**              | Global → Country entry; Country → World ascent; Region stub policy; header, footer, initiative links, registration entry                                                                                                                                       |
| **Projection integration verified**  | All Participation blocks wired through public projection contracts with country filter — no operational access                                                                                                                                                 |
| **Community boundary verified**      | No Find Your Community, community search or community-specific statistics on Country page                                                                                                                                                                      |
| **Architecture verification passed** | Checklist against `EPIC_03_ARCHITECTURE_FREEZE.md`                                                                                                                                                                                                             |
| **Implementation review completed**  | `EPIC_03_IMPLEMENTATION_REVIEW.md` or equivalent — **APPROVED**                                                                                                                                                                                                |
| **Repository clean**                 | No uncommitted Epic 03 slice at closure when commit authorized                                                                                                                                                                                                 |

## Recommended route verification

At closure, verify HTTP 200 (or correct public semantics):

- Country Experience route for bootstrap country
- Global Experience → Country navigation
- Country → World ascent via Geographic Navigator
- Initiative public detail from Latest National Initiatives cards
- Registration Gateway entry route
- Region links — disabled or honest stub with Country return — per launch policy

## Bootstrap dependency

Country Experience demo requires country-scoped public projection bootstrap data from Capability 02 — coordinate bootstrap country and region IDs with existing participation bootstrap pipeline where applicable.

Honest labeling if bootstrap data is synthetic.

Sparse country states must render honestly — architecture forbids fabricated national vibrancy.

---

# 8. Final Statement

**Implementation realizes the approved Country Experience architecture without extending its scope.**

Epic 03 engineering delivers one vertical slice:

**Country-level Country Experience** — one nation's observable civic activity within Humanity Union's unified public square — composed from frozen Experience Blocks, fed by country-filtered public projections, governed by Context Before Evidence and observation-before-participation ethics.

**Every implementation decision must remain consistent with the frozen architectural principles established for Epic 03.**

When implementation choices conflict with freeze:

- stop;
- escalate to Architecture Review;
- do not silently drift.

Sprint sequence preserves narrative, page flow and interaction architecture.

Epic 02 Global Experience provides the reference block behaviour.

Epic 03 applies the country scope parameter and geographic adaptation blocks — Trusted National Media and Regional Exploration — without forking Public Space architecture.

Capability 02 provides public representations.

Capability 03 composes public understanding at national scope.

Community Experience remains downstream — not absorbed into Country delivery.

This plan connects freeze to delivery — it does not replace freeze.

Implementation follows architecture.

Architecture never follows implementation convenience.

One Humanity.

Many Countries.

Shared Future.

---

# Document Status

**Draft**

Epic 03 Implementation Plan — Country Experience Version 1.0

Sprint 1 may begin only after this plan is approved alongside frozen Epic 03 architecture.
