# PUBLIC EXPERIENCE PRINCIPLES

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 01 — Information Space

Version: 1.0

Status: Draft

Document Type: Architectural Principles

---

# Purpose

Define the **architectural principles** governing Humanity Union Public Space.

This document establishes the non-negotiable rules that all Public Experience work must follow — across discovery, information architecture, navigation, page composition and future epics.

It is a principles document — not an implementation guide, not a visual design system, and not a feature specification.

It answers:

- what Public Experience must always preserve;
- what trade-offs are forbidden;
- how geographic scope, navigation and registration relate to civic trust;
- how future capabilities may extend public space without replacing its foundation.

Reference:

- `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_INFORMATION_MAP.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/USER_JOURNEY.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_PAGE_ARCHITECTURE.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/NAVIGATION_ARCHITECTURE.md`

Capability 02 established operational/public separation, public projection discipline and trust through explainable derived state.

These principles carry that foundation to **platform-scale public experience**.

When implementation choices conflict with these principles, the principles govern.

Architecture review resolves exceptions — implementation convenience does not.

---

# Core Principles

The following principles are **architectural**.

They apply to every Public Experience epic, page, block and navigation decision.

## We create grounds for trust

Trust is not claimed through branding, certification language or engagement metrics.

Trust emerges when public information is:

- accurate to authorized public projections;
- honest about derived civic state;
- explainable from underlying recorded truth;
- bounded about what the platform does and does not claim.

Public Experience creates **grounds** for trust — not rhetorical proof.

## Navigation serves intentions

Navigation maps to visitor intentions — explore, research, learn, verify, participate — not to internal modules, aggregates or engineering structure.

Primary destinations answer civic questions.

Internal capability names must not appear in public navigation chrome.

## One Experience Block — One Responsibility

Every experience block — Hero, Statistics, Latest Initiatives, Related Content, Registration Gateway and all blocks in the Public Experience Block Library — owns **exactly one clear responsibility**.

Blocks must not merge orientation, discovery, conversion and trust into one undifferentiated surface.

Composite pages assemble blocks — blocks do not absorb whole pages.

## Reusable Experiences

Public pages compose **reusable experience blocks** on **shared page structure**.

Forbidden: bespoke page architectures when existing blocks and layouts suffice.

Reuse reduces visitor learning cost and engineering drift.

## Unified Public Space

Humanity Union is **one unified public civic space**.

World, Country and Region are filtered views — not separate products, sites or navigation models.

Participation public projections feed this space — they do not define separate public architectures per aggregate.

## Filter Instead of Duplicate

Geographic scope, content type and capability data vary through **filtering** — not through duplicated templates, navigation trees or block libraries.

One Hero block.

One Initiatives listing pattern.

One footer.

Different datasets.

## Progressive Understanding

Information depth increases naturally:

Discover → Understand → Trust → Register → Participate

First contact orients.

Detail follows choice.

Registration follows understanding.

Public Experience must not front-load completeness on first view.

## Calm Navigation

Navigation minimizes cognitive load.

Primary header destinations remain limited and stable.

No urgency framing.

No registration pressure on orientation.

No menu proliferation to satisfy every future feature request.

Calm is a civic requirement.

## Explainable Navigation

Every navigation label must predict content.

Every destination must have one responsibility.

Visitors should know where they are going before they click.

Breadcrumbs, scope context and page heroes reinforce orientation — they do not replace honest labeling.

## Future Extension Without Redesign

Future destinations, blocks, geographic levels and capability integrations must **extend** Public Space — not replace its architecture.

Reserved scope may be named in documents.

It must not be partially implemented before need and Architecture Review.

Extension adds attachment points — not parallel public platforms.

---

# Experience Principles

These principles govern **how public experience feels and behaves** — regardless of visual design implementation.

## Consistency

One navigation model, one page structure, one block vocabulary, one information hierarchy across all public destinations and geographic scopes.

Visitors must not relearn the platform when scope or destination changes.

## Clarity

Civic language over internal names.

One responsibility per block, destination and page purpose.

Derived values labeled.

Evidence presented as substantiation — not certification.

## Predictability

Header placement stable.

Footer role stable.

Scope changes filter content — not chrome.

Related Content links by civic context — not opaque algorithms.

Return visits behave the same way as first visits structurally.

## Scalability

New pages compose existing blocks.

New data attaches to existing destinations.

New capabilities integrate through projections and widgets — not through header multiplication.

Scalability means **attachment** — not **forking**.

## Accessibility

Public information must remain reachable and comprehensible across abilities and devices.

Accessibility is architectural — not a post-implementation overlay.

Legal and accessibility entry belongs in footer supporting navigation.

Hierarchy preserved on mobile — not collapsed into registration-first flows.

## Low cognitive load

Prefer depth within destinations over breadth in menus.

Prefer progressive disclosure over simultaneous completeness.

Prefer one primary action per stable page state.

Overload destroys calm exploration and undermines trust.

---

# Geographic Principles

Geographic scope organizes **what visitors see** — not **how the platform works**.

## World

Global scope.

Visitor question: **"What is happening across Humanity Union?"**

World uses the same architecture as all other levels.

Datasets aggregate or span globally per page and block rules.

## Country

National scope filter.

Visitor question: **"What matters in this country?"**

Country uses identical navigation, page structure and blocks as World.

Only dataset scope and contextual framing differ.

## Region

Local or regional scope filter.

Visitor question: **"What matters near me?"**

Region uses identical navigation, page structure and blocks as World and Country.

Interactive Map may assist selection — map is orientation aid, not alternate architecture.

## Future geographic levels

Additional levels — municipality, district, constituency or other governed geography — may be introduced through Architecture Review.

Future levels must:

- attach as scope filter parameters;
- reuse one public architecture;
- not introduce parallel navigation or page template families.

## One architecture · Different filtered datasets

```
Scope parameter (World | Country | Region | future)
                    │
                    ▼
         Same navigation · Same pages · Same blocks
                    │
                    ▼
              filter(datasets, scope)
                    │
                    ▼
         Different rows · Same experience
```

Forbidden:

- World site vs Region site as separate public products;
- country-specific header items;
- region-only page architectures;
- geographic mode that hides primary destinations.

Geographic principles enforce **Filter Instead of Duplicate** at platform scale.

---

# Registration Philosophy

Public Experience ends at the boundary of **informed choice**.

## Understanding precedes registration

Visitors may browse, read, verify and learn **without an account**.

Public civic information is not withheld to force registration.

Initiative public projections, institutional profiles, media and knowledge remain open at architecture level.

Journey sequence is mandatory in principle:

Discover → Understand → Trust → **then** Register

Registration must not appear as the implied goal of first orientation.

## Participation follows informed choice

Registration Gateway is **explicit secondary navigation** — not primary header competition.

Register means: the visitor chooses accountable participation after sufficient public understanding.

Participate means: cross into operational Capability 02 workspaces — beyond Public Experience ownership.

Humanity Union never pressures visitors into registration.

Calm exit — share, bookmark, return later, continue reading — is a successful journey outcome.

Registration follows understanding.

Participation follows registration.

Pressure follows neither.

Capability 02 established that public transparency must not expose individual dignity.

Registration philosophy extends visitor **autonomy** — society may observe without being converted.

---

# Future Evolution

Public Space will grow.

Growth must preserve principles — not erode them.

## Extension rules

Future Public Experience work may:

- add blocks to the Public Experience Block Library;
- add sections within existing destinations;
- add footer secondary links;
- add scope filter levels;
- add public projections from new capabilities;

Future Public Experience work must not:

- fork navigation architecture per geography;
- duplicate page templates per capability;
- expose internal aggregate structure in public chrome;
- merge operational workspaces into public pages;
- introduce registration gating on public reading;
- partially implement reserved future concepts before review.

## New capabilities

Future capabilities integrate into Public Space through:

- dataset feeds to existing blocks;
- detail sections on existing page types;
- Related Content cross-navigation;
- Initiatives or Institutions destinations where civic activity belongs;

—not through one new header item per backend module.

## New primary destinations

Header expansion requires Architecture Review and proven civic-level importance.

Default expansion path: footer → block library → destination depth → header last.

## Relationship to Capability 02

Participation aggregates remain authoritative for civic action.

Public Experience remains authoritative for **how society discovers and understands** that action in public.

Future Participation stages — Impact, additional public projections — extend data and blocks.

They must not redefine Public Space architecture.

Future evolution **extends** Public Space.

It does not **replace** it.

---

# Final Statement

**These principles govern all future Public Experience work within Humanity Union.**

Every epic, page, block, navigation decision and geographic scope implementation must conform to:

- trust through explainable public information;
- intention-serving navigation;
- reusable experience blocks with single responsibilities;
- one unified public space filtered by scope;
- progressive understanding without registration pressure;
- calm, clear, predictable, scalable and accessible experience;
- future extension without architectural redesign.

When documents conflict, resolve upward to these principles.

When principles conflict with implementation convenience, principles govern.

Public Experience is the front door of civic legitimacy for Humanity Union.

It must remain worthy of that responsibility.

This document does not define implementation.

It defines the architectural conscience of Public Space.

---

# References

| Document                        | Path                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Discovery Session 01            | `capabilities/03_public_experience/EPIC_01_PUBLIC_INFORMATION_ARCHITECTURE/DISCOVERY_SESSION_01.md` |
| Public Information Map          | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_INFORMATION_MAP.md`             |
| User Journey                    | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/USER_JOURNEY.md`                       |
| Public Page Architecture        | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_PAGE_ARCHITECTURE.md`           |
| Public Experience Block Library | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md`    |
| Navigation Architecture         | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/NAVIGATION_ARCHITECTURE.md`            |
| Capability 02 Retrospective     | `capabilities/02_participation/CAPABILITY_02_RETROSPECTIVE.md`                                      |

---

# Document Status

**Draft**

Public Experience Principles — Information Space Epic 01

Architecture freeze, domain language and implementation guides for Capability 03 must align with this document before engineering begins.
