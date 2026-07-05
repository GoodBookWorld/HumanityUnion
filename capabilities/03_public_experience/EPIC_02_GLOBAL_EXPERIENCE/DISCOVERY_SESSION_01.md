# DISCOVERY SESSION 01

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 02 — Global Experience

Version: 1.0

Status: Draft

Document Type: Discovery

---

# Purpose

Define the goals of Humanity Union's **Global Experience**.

This Epic transforms the approved Public Space Architecture into Humanity Union's **first public civic experience** — the first build expression of Capability 03 at World scope.

The Global Experience is Humanity Union's **primary public civic space**.

It is the **first destination for most visitors** — platform root, search entry, shared links and direct visits converge here.

It is not a marketing homepage.

It is the World-scoped **public square** defined in Epic 01 — architecturally named **Global Experience**.

This discovery session records **what Epic 02 must achieve** before specification and implementation begin.

It does not define implementation.

It does not authorize code, routes, components or visual design.

Reference:

- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`

Epic 01 frozen the architecture.

Epic 02 discovery defines the **goals and boundaries** for implementing that architecture at World level.

---

# Objectives

The Global Experience should enable visitors to:

## Observe humanity

See that real civic activity exists on the platform globally — structured participation, not empty marketing shell.

## Understand current civic activity

Grasp what is happening now through honest public summaries — initiatives, pipeline stage presence and aggregate indicators labeled appropriately.

## Navigate naturally

Move to Initiatives, Institutions, Media, Knowledge and About through stable header navigation without relearning structure.

## Discover initiatives

Find live civic paths through Latest Initiatives and map exploration — entry to detail without registration.

## Develop trust

Evaluate platform legitimacy through explainable information — derived values labeled, bounded claims, paths to About and verification — not persuasion.

## Choose participation freely

Encounter Registration Gateway only as explicit choice after orientation — never as pressure on arrival.

Objectives align with Epic 01 Visitor Journey: Discover → Understand → Trust → Register → Participate.

Registration and workspace entry are valid outcomes — not required outcomes.

---

# Public Questions

The Global Experience should answer the following questions **naturally** — through block composition and navigation, not interruptive onboarding.

## What is Humanity Union?

A civic participation platform where society may observe and eventually join structured civic life.

Answered by: **Hero**, header context, calm platform framing.

## What is happening now?

Live and recent civic activity at global scope.

Answered by: **Latest Global Initiatives**, **Global Statistics**, **Initiative Levels**.

## How is humanity participating?

Distribution of civic activity across geographies and Participation pipeline stages.

Answered by: **Interactive World Map**, **Initiative Levels**, **Global Statistics**.

## Where can I explore further?

Clear paths to primary destinations and geographic scope exploration.

Answered by: **Header**, **Interactive World Map**, initiative preview links, **Footer**.

## Why can this platform be trusted?

Explainable public information — not certification rhetoric.

Answered by: honest derived labeling, **Global Statistics** transparency, paths to **About** and Knowledge — not Hero conversion copy.

Questions map to Experience Blocks — not modal wizards or forced tutorials.

---

# Scope

This Epic defines the **complete public experience of the World level**.

## In scope

- **Global Experience** — Home-class page composition at World scope;
- global chrome required by architecture — Header, Geographic Navigator, Footer;
- frozen Experience Blocks listed below;
- World-scoped datasets feeding blocks;
- entry from platform root and primary visitor entry points;
- conformance with Epic 01 Architecture Freeze.

## Out of scope for Epic 02

- **Country experiences** — later epic;
- **Region experiences** — later epic;
- destination epics for Institutions, Media, Knowledge full listing and detail beyond navigation entry;
- backend capability implementation for Media, Knowledge, Institutions content;
- Registration flow implementation beyond Registration Gateway block entry;
- operational Participation workspaces.

Country and Region are **Geographic Experience** variants of the same architecture — handled by later epics, not Epic 02.

Epic 02 delivers **one vertical slice**: World public square composed from approved blocks.

---

# Required Experience Blocks

Epic 02 confirms the following **required blocks** in architectural order.

Global chrome precedes page composition per Epic 01.

## Global chrome (architecture-required)

| Block                 | Architectural name   |
| --------------------- | -------------------- |
| Primary navigation    | Header               |
| Scope control         | Geographic Navigator |
| Supporting navigation | Footer               |

## Page composition (frozen order)

| #   | UI name (World scope)     | Architectural name       |
| --- | ------------------------- | ------------------------ |
| 1   | Hero                      | Hero                     |
| 2   | Interactive World Map     | Interactive Map          |
| 3   | Global Statistics         | Statistics (World scope) |
| 4   | Initiative Levels         | Initiative Levels        |
| 5   | Latest Global Initiatives | Latest Initiatives       |
| 6   | Join Humanity Union       | Registration Gateway     |
| 7   | Footer                    | Footer                   |

Footer appears in global chrome and completes page composition per Block Library.

Registration Gateway may use **Join Humanity Union** display label — architectural name remains **Registration Gateway**.

No additional blocks are required for Epic 02 discovery.

Optional secondary blocks — Trusted Media Carousel, About Preview — may appear in later specifications if they do not violate progressive disclosure; they are **not** required at discovery stage.

## Block order

```
Header · Geographic Navigator
Hero
Interactive World Map
Global Statistics
Initiative Levels
Latest Global Initiatives
Registration Gateway
Footer
```

Order follows Information Architecture Flow: Identity → Orientation → Understanding → Evaluation → Participation.

Full block definitions: `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`.

Composition reference: `GLOBAL_EXPERIENCE_VISION.md`.

---

# Architectural Constraints

Epic 02 introduces **no new architectural concepts**.

Implementation planning and build must follow frozen Epic 01 documents:

| Constraint source                | Governs                                                   |
| -------------------------------- | --------------------------------------------------------- |
| **Public Space Architecture**    | Public Space model, axiom, Capability 02 relationship     |
| **Navigation Architecture**      | Primary and secondary navigation                          |
| **Experience Block Library**     | Block catalog, naming, composition, data responsibility   |
| **Public Experience Principles** | Trust, calm, progressive disclosure, filter-not-duplicate |

## Binding rules

- one unified public architecture — World scope is filter context, not product fork;
- navigation serves intentions — not implementation structure;
- one block — one responsibility;
- business logic outside Experience Blocks — Capability 02 public projections feed Participation blocks;
- Registration Gateway secondary — not Hero replacement;
- observation precedes participation;
- architectural terminology precedes UI wording per canonical naming registry.

Any proposed deviation requires Architecture Review — not Epic 02 implementation convenience.

Epic 02 **implements** frozen architecture — it does not **extend** it.

---

# Success Criteria

Epic 02 Global Experience discovery succeeds when the following are achievable by specification and later implementation — not assumed today.

## Thirty-second comprehension

A **first-time visitor** should understand within approximately **thirty seconds** without creating an account:

- Humanity Union exists as a civic platform;
- civic activity is visibly present;
- exploration is open without registration;
- trust is supported through transparency — not demanded through rhetoric.

Thirty seconds measures **orientation** — not full pipeline mastery.

## Exploration over registration

The experience should **encourage exploration** rather than registration.

Success includes visitors who:

- browse Latest Initiatives;
- explore the map;
- navigate to Initiatives or About;
- leave successfully without registering.

Registration Gateway present — prominent registration pressure absent.

## Architectural conformance

Delivered experience must map one-to-one to frozen block catalog and Global Experience composition.

No undocumented blocks.

No alternate World page architecture.

## Honest global presentation

Global Statistics and Initiative Levels present derived data with honest labeling and acceptable empty or sparse states — not fabricated activity.

---

# Non-Goals

Epic 02 discovery explicitly **does not** design or authorize:

| Non-goal                   | Handled by                                 |
| -------------------------- | ------------------------------------------ |
| **Country pages**          | Future Geographic Experience epic          |
| **Region pages**           | Future Geographic Experience epic          |
| **Media capability**       | Future capability epic                     |
| **Knowledge capability**   | Future capability epic                     |
| **Institutions page**      | Future destination epic                    |
| **Implementation details** | Later specification and engineering guides |

Non-goals are **scope boundaries** — not rejected forever.

They prevent Epic 02 from absorbing future epic responsibilities.

---

# Final Statement

**Epic 02 begins implementation of Humanity Union Public Space by creating its Global Experience.**

Epic 01 established the architectural foundation — frozen in `EPIC_01_ARCHITECTURE_FREEZE.md`.

Epic 02 is the first **build epic** — transforming that foundation into the World-scoped public civic square most visitors encounter first.

The Global Experience:

- observes humanity;
- answers public questions naturally;
- composes approved Experience Blocks only;
- encourages exploration before registration;
- earns trust through transparency rather than persuasion.

Downstream artifacts — page specification, visual design brief, implementation plan and engineering guides — must conform to this discovery and Epic 01 freeze.

This document does not define implementation.

It defines **what Epic 02 exists to achieve**.

---

# References

| Document                     | Path                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Epic 01 Architecture Freeze  | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`     |
| Public Space Architecture    | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_SPACE_ARCHITECTURE.md`       |
| Global Experience Vision     | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`        |
| Experience Block Library     | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md` |
| Navigation Architecture      | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/NAVIGATION_ARCHITECTURE.md`         |
| Public Experience Principles | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_PRINCIPLES.md`    |

---

# Document Status

**Draft**

Discovery Session 01 — Epic 02 Global Experience

Specification and implementation planning may proceed after discovery approval.
