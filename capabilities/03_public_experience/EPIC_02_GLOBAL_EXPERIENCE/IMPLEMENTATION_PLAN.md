# IMPLEMENTATION PLAN

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 02 — Global Experience

Version: 1.0

Status: Draft

---

# 1. Purpose

Define the **implementation strategy** for Epic 02 — **Global Experience**.

This plan transforms the approved architecture into **incremental implementation milestones** while preserving architectural integrity.

Implementation **follows the approved architecture without introducing new architectural decisions**.

| Rule                                     | Meaning                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| **Architecture precedes implementation** | No engineering sprint begins without frozen spec reference                          |
| **Freeze governs**                       | `EPIC_02_ARCHITECTURE_FREEZE.md` is binding                                         |
| **Epic 01 governs platform**             | `EPIC_01_ARCHITECTURE_FREEZE.md` remains binding for blocks, navigation, principles |
| **Projection boundary governs data**     | `CAPABILITY_02_PROJECTION_INTEGRATION.md` is binding for Capability 02 consumption  |

This plan defines **strategy and sequencing only**.

It does not define detailed code, component APIs, CSS or backend endpoints.

Architecture references:

- `EPIC_02_ARCHITECTURE_FREEZE.md`
- `EPIC_02_ARCHITECTURE_REVIEW.md`
- `GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `GLOBAL_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `CAPABILITY_02_PROJECTION_INTEGRATION.md`

Platform references:

- `EPIC_01_ARCHITECTURE_FREEZE.md`
- `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`
- `NAVIGATION_ARCHITECTURE.md`
- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`
- `project/architecture/core/ENGINEERING_METHODOLOGY.md`

---

# 2. Version 1 Scope

Epic 02 Version 1 implementation includes **only**:

| In scope                    | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| **Global Experience**       | World-scoped public square — architectural Global Experience                 |
| **World-level public page** | Single Home-class page at platform root / World entry                        |
| **Public projections**      | Consumption of Capability 02 projection contracts per integration document   |
| **Registration Gateway**    | Secondary-zone entry to Identity registration — not full auth implementation |
| **Footer**                  | Supporting navigation, legal and accessibility links                         |

## Global chrome in scope

- **Header** — six frozen primary destinations
- **Geographic Navigator** — World scope active; Country/Region drill-down **disabled or honest stub** until Geographic epics ship (per architecture review)

## Canonical block sequence (frozen)

1. Civic Introduction (Hero)
2. Interactive World Map
3. Global Statistics
4. Participation Pipeline
5. Latest Global Initiatives
6. Registration Gateway
7. Footer

## Explicitly excluded

- **No Country pages**
- **No Region pages**
- **No new header destinations**
- **No Media, Knowledge, Institutions destination pages** as Epic 02 deliverables — header links may route to stubs only if launch policy requires honest minimal pages; not Epic 02 scope
- **No optional secondary blocks** in required composition — Trusted Media Carousel, About Preview deferred
- **No operational aggregate access**
- **No Capability 02 store or workspace changes** unless required for projection contract fulfillment — out of Epic 02 ownership unless jointly agreed

---

# 3. Implementation Principles

All Epic 02 engineering must confirm:

| Principle                           | Application                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Vertical slices**                 | Each sprint delivers demonstrable public surface increment — not horizontal layer-only sprints that block verification |
| **Incremental delivery**            | Repository remains demonstrable after every sprint                                                                     |
| **Repository always buildable**     | `typecheck` passes; web app serves Global Experience route without broken build                                        |
| **Architecture-first**              | Sprint work references freeze sections — drift triggers review stop                                                    |
| **Projection-only public data**     | Capability 03 reads only public projection layer for Participation blocks                                              |
| **Read-only public experience**     | No public mutations of Participation state                                                                             |
| **No operational aggregate access** | No operational API or workspace models on Global Experience page                                                       |

Additional frozen Epic 02 principles preserved throughout:

- Context Before Evidence in every block
- Observation precedes participation
- Public Space never persuades — reveals
- One Experience Block — One Responsibility
- Every interaction increases understanding

---

# 4. Sprint Structure

Seven sprints.

Each sprint ends with verification per Section 5.

No sprint begins until prior sprint review completes — except documented parallel prep that does not merge incomplete architecture.

---

## Sprint 1 — Public Experience shell

**Goal:** Establish Global Experience route and public chrome foundation.

### Deliverables

- Global Experience route at World entry (architectural Global Experience URL)
- **Header** — six primary destinations per Navigation Architecture
- **Geographic Navigator** — World scope displayed; Country/Region transitions disabled or stubbed per launch policy
- Responsive page foundation implementing `PUBLIC_PAGE_TEMPLATE_STANDARD.md` zones — global chrome, page context slot, primary content slot, secondary slot — without final block content
- Epic 03 module structure aligned with existing web app conventions — no architectural fork

### Architectural checkpoints

- Header labels match frozen destinations — civic language only
- No Registration Gateway in header
- Template zones exist — layout serves architecture, not invented structure

### Sprint 1 verification

- Route HTTP 200
- Header navigation present and stable
- Typecheck passes

---

## Sprint 2 — Civic Introduction · Interactive World Map

**Goal:** Implement Identity and Orientation narrative stages.

### Deliverables

- **Civic Introduction (Hero)** block
  - Context Introduction per Content Architecture
  - no statistics, initiatives or registration in Hero
- **Interactive World Map** block
  - frozen reference Context Introduction (Title + copy per Epic 02 freeze Section 9) or equivalent tone-approved copy
  - **Context Before Evidence** structure
  - map interaction architecture per Interaction doc — scope exploration entry only; no Country/Region page navigation until Geographic epics unless stub policy approved

### Projection integration

- Wire map to **Public Geographic Participation Projection** contract — mock or bootstrap projection acceptable for sprint if labeled development bootstrap; must not use operational aggregates

### Sprint 2 verification

- Hero + Map render in canonical order
- Context Introduction precedes map Evidence
- No narrative stage violation (registration absent)
- Typecheck passes

---

## Sprint 3 — Global Statistics · Participation Pipeline

**Goal:** Implement Understanding narrative stage — measurable participation.

### Deliverables

- **Global Statistics** block
  - Context Introduction per Content Architecture
  - derived values labeled in presentation layer
  - honest empty/sparse World state supported
- **Participation Pipeline** block (Initiative Levels)
  - Capability 02 stage vocabulary
  - Context Introduction precedes Evidence

### Projection integration

- **Participation Public Statistics Projection** → Global Statistics
- **Participation Pipeline Public Projection** → Participation Pipeline
- Verify read-only consumption — no operational fields
- Verify projection rules: no participant identity, no operational identifiers beyond public-safe links

### Sprint 3 verification

- Statistics and Pipeline follow Hero and Map in sequence
- Projection contract respected — integration checklist from `CAPABILITY_02_PROJECTION_INTEGRATION.md`
- Derived labeling visible where applicable
- Typecheck passes

---

## Sprint 4 — Latest Global Initiatives

**Goal:** Implement collective action narrative stage and exploration entry.

### Deliverables

- **Latest Global Initiatives** block
  - initiative summary cards from **Initiative Public Projection**
  - Context Introduction per Content Architecture
  - links to Initiative public detail routes (Capability 02 existing public pages where available)
- **Initiative navigation** — card → public detail interaction
- **Related links** — minimal Related Content pattern where initiative cards imply exploration; no duplicate header paths

### Projection integration

- **Initiative Public Projection** list at World scope
- Recency or curated ordering transparent if curated

### Sprint 4 verification

- Latest Initiatives after Statistics and Pipeline
- Initiative links resolve to public projection pages — HTTP 200 on bootstrap data
- No operational workspace URLs as primary public CTA
- Typecheck passes

---

## Sprint 5 — Registration Gateway · Footer

**Goal:** Complete Participation and Supporting Navigation stages.

### Deliverables

- **Registration Gateway** block (Join Humanity Union display label permitted)
  - secondary zone placement — after Evidence blocks
  - calm copy per Content Architecture — no urgency
  - links to Identity registration entry — not full auth epic
- **Footer**
  - legal, accessibility, contact supporting links
  - no primary civic Evidence duplication
  - platform configuration source — not Participation projections

### Architectural checkpoints

- Registration Gateway not in Hero or primary Evidence zone
- Footer does not compete with Registration as second conversion stack
- Public reading not gated

### Sprint 5 verification

- Full canonical block sequence complete
- Registration Gateway position correct
- Footer complete per Navigation Architecture
- Typecheck passes

---

## Sprint 6 — Accessibility · Responsive · Performance

**Goal:** Non-functional verification without architecture change.

### Deliverables

- **Accessibility review** — Context Introduction and Evidence reachable; heading hierarchy; interactive map accessibility policy documented
- **Responsive verification** — information hierarchy preserved desktop / tablet / mobile per Page Template Standard — not registration-first mobile collapse
- **Performance review** — acceptable load for World page with bootstrap projections; no architectural change to solve performance — document findings only

### Sprint 6 verification

- Responsive hierarchy checklist passed
- Accessibility issues triaged — blockers fixed within architecture
- Performance baseline recorded
- Typecheck passes
- No architectural drift introduced

---

## Sprint 7 — Architecture verification · Implementation review · Epic closure

**Goal:** Close Epic 02 with formal review.

### Deliverables

- **Architecture verification** against `EPIC_02_ARCHITECTURE_FREEZE.md` checklist
- **Projection integration verification** against `CAPABILITY_02_PROJECTION_INTEGRATION.md`
- **Interaction verification** against Learning Path and interaction principles
- **Implementation review document** — APPROVED or REMEDIATION REQUIRED
- **Documentation update** — implementation review, any sprint notes, bootstrap demo description
- **Repository clean** at closure (when authorized by engineering process)

### Sprint 7 verification

- All completion criteria Section 7 satisfied
- Epic 02 closure recorded

---

# 5. Verification Rules

**Every sprint** must satisfy:

| Rule                                              | Verification                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Typecheck passes**                              | `npm exec pnpm -- typecheck` or equivalent monorepo command                                   |
| **No architectural drift**                        | Sprint diff reviewed against Epic 02 freeze — block order, principles, scope                  |
| **Projection contract respected**                 | Participation blocks consume projection layer only — checklist Section 4 integration doc      |
| **Navigation preserved**                          | Six header destinations; Registration Gateway not in header; three-step rule not regressed    |
| **No placeholder logic hidden as implementation** | Mock data explicitly bootstrap/labeled — not silent fabrication presented as production truth |

## Sprint review gate

Each sprint records:

- deliverables completed;
- verification evidence (typecheck, route check);
- architecture drift assessment — none or escalated to review;
- deferred items unchanged.

Sprint may not close with known freeze violations marked "TODO later."

---

# 6. Deferred Work

The following remain **outside Version 1** — recorded in Epic 02 freeze, not implementation backlog for this epic:

| Deferred item              | Notes                                                        |
| -------------------------- | ------------------------------------------------------------ |
| **Country Experience**     | Future Geographic Experience epic                            |
| **Region Experience**      | Future Geographic Experience epic                            |
| **Search**                 | Future exploration capability                                |
| **Bookmarks**              | Future visitor convenience                                   |
| **AI Discovery Assistant** | Explain-only — future; must not violate assistant boundaries |
| **Live Civic Activity**    | Future projection refresh pattern                            |
| **Personalization**        | Must not gate public Evidence                                |
| **Advanced filters**       | Future Initiatives enhancement                               |

Also deferred from Epic 02 plan:

- Media, Knowledge, Institutions full destination experiences
- Optional secondary blocks — Trusted Media Carousel, About Preview
- District-level and extended geographic hierarchy implementation
- Capability 02 projection builder work **beyond contracts required for Global Experience** — coordinate with Capability 02 owners; Epic 02 consumes, does not redefine

Deferred work is **future epics** — not excuses for partial freeze compliance in Epic 02.

---

# 7. Completion Criteria

Epic 02 implementation is **complete only when all** of the following are true:

| Criterion                                      | Verification                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **All approved experience blocks implemented** | Hero, Interactive Map, Statistics, Pipeline, Latest Initiatives, Registration Gateway, Footer + Header + Geographic Navigator |
| **Projection integration verified**            | All Participation blocks wired through public projection contracts — no operational access                                    |
| **Navigation verified**                        | Header, Footer, initiative links, registration entry, scope behavior                                                          |
| **Architecture review satisfied**              | `EPIC_02_IMPLEMENTATION_REVIEW.md` or equivalent — **APPROVED**                                                               |
| **Repository clean**                           | No uncommitted Epic 02 slice at closure when commit authorized                                                                |
| **Documentation updated**                      | Implementation review published; bootstrap demo noted                                                                         |

## Recommended route verification

At closure, verify HTTP 200 (or correct public semantics):

- Global Experience World entry route
- Header destination routes — or documented stub policy for undeferred destinations
- Initiative public detail from Latest Initiatives cards
- Registration Gateway entry route

## Bootstrap dependency

Global Experience demo requires World-scope public projection bootstrap data from Capability 02 — coordinate bootstrap IDs with existing participation bootstrap pipeline where applicable.

Honest labeling if bootstrap data is synthetic.

---

# 8. Final Statement

**Implementation realizes the approved architecture without extending scope.**

Epic 02 engineering delivers one vertical slice:

**World-level Global Experience** — Humanity Union's public civic square — composed from frozen Experience Blocks, fed by public projections, governed by Context Before Evidence and observation-before-participation ethics.

**Every implementation decision must remain consistent with the frozen architectural principles established for Epic 02.**

When implementation choices conflict with freeze:

- stop;
- escalate to Architecture Review;
- do not silently drift.

Sprint sequence preserves narrative, page flow and interaction architecture.

Capability 02 provides public representations.

Capability 03 composes public understanding.

This plan connects freeze to delivery — it does not replace freeze.

Implementation follows architecture.

Architecture never follows implementation convenience.

---

# Document Status

**Draft**

Epic 02 Implementation Plan — Global Experience Version 1.0

Sprint 1 may begin only after this plan is approved alongside frozen Epic 02 architecture.
