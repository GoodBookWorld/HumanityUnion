# GLOBAL EXPERIENCE NARRATIVE

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 02 — Global Experience

Version: 1.0

Status: Draft

Document Type: Narrative Architecture

---

# Purpose

Define the **narrative flow** of Humanity Union Global Experience.

Global Experience tells a **coherent civic story** — not a stack of unrelated content blocks.

Visitors scroll through one unified account of public civic life:

- what Humanity Union is;
- that civic activity is real and visible;
- how participation is structured and measurable;
- how ideas become collective action;
- that participation remains a free and informed choice.

Narrative architecture governs **copy direction, block sequencing and emotional progression**.

It does not govern visual design, component APIs or routing.

Reference:

- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/DISCOVERY_SESSION_01.md`
- `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`
- `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`

Epic 01 frozen **what blocks exist** and **how pages compose**.

This document defines **what story those blocks tell** on the Global Experience.

Implementation must serve the narrative — narrative must not be replaced by promotional messaging at build time.

---

# Narrative Principle

## One Screen — One Message

Each major section communicates **one primary idea**.

A section may contain supporting detail — but visitors must be able to state the section's message in one sentence after reading it.

Forbidden narrative patterns:

- one block carrying identity, statistics, conversion and trust simultaneously;
- competing primary messages above the fold;
- urgency copy layered over orientation copy;
- certification or proof language substituting for observable activity.

Progressive disclosure applies to **narrative** as well as information:

summary message first;

supporting evidence second;

explicit invitation last.

One Screen — One Message implements **One Experience Block — One Responsibility** at the story layer.

---

# Narrative Flow

Global Experience follows five narrative stages in fixed order.

Each stage maps to Information Architecture Flow and Visitor Journey stages without collapsing them.

```
1. Humanity exists.
        ↓
2. Humanity is active.
        ↓
3. Participation is measurable.
        ↓
4. Ideas become collective action.
        ↓
5. You may participate.
```

## Stage 1 — Humanity exists

**Message:** Humanity Union is a real civic platform — a public space for society to observe structured participation.

**Purpose:** Establish identity without hype.

The visitor learns the platform exists, serves civic life and welcomes observation.

This is not a product pitch.

**Narrative job:** answer _What is Humanity Union?_

**Flow alignment:** Identity · Visitor entry

## Stage 2 — Humanity is active

**Message:** Civic activity is happening — geographically distributed and visibly present on the platform.

**Purpose:** Prove aliveness through orientation — not through claims.

The visitor sees where activity occurs and that the platform is not empty.

**Narrative job:** answer _What is happening now?_ and begin _How is humanity participating?_

**Flow alignment:** Orientation · Discover

## Stage 3 — Participation is measurable

**Message:** Collective civic activity can be understood through honest public indicators — counts, stage distribution, derived metrics labeled as derived.

**Purpose:** Make structure legible without gamification or false precision.

The visitor grasps scale and pipeline presence at World scope.

**Narrative job:** deepen _How is humanity participating?_

**Flow alignment:** Understanding · Understand

## Stage 4 — Ideas become collective action

**Message:** Initiatives move through structured civic paths — proposal, understanding, decision, support, commitment, implementation — as observable public journeys.

**Purpose:** Connect abstract statistics to concrete civic stories.

The visitor sees real initiatives as entry points to exploration and evaluation.

**Narrative job:** answer _Where can I explore further?_ and support trust evaluation.

**Flow alignment:** Understanding → Evaluation · Understand → Trust

## Stage 5 — You may participate

**Message:** Registration is available when the visitor chooses — after observation and understanding — not as the price of reading.

**Purpose:** Extend invitation without pressure.

The visitor knows how to join society on the platform — not that they must.

**Narrative job:** optional _Register_ — never forced _Convert_

**Flow alignment:** Participation · Register (informed choice only)

---

# Required Experience Blocks

Each narrative stage maps to **approved Experience Blocks** from Epic 01 freeze.

Architectural names used below.

UI labels may differ per canonical naming registry — narrative mapping uses architectural names.

| Narrative stage                       | Primary message                              | Experience Block             | Narrative role                                           |
| ------------------------------------- | -------------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| **1. Humanity exists**                | Humanity Union is a civic public square      | **Hero**                     | Platform identity; calm framing; one-sentence purpose    |
| **2. Humanity is active**             | Activity is real and geographically present  | **Interactive Map**          | Geographic orientation; scope exploration entry          |
| **3. Participation is measurable**    | Structure and scale are observable honestly  | **Statistics** (World scope) | Aggregate public metrics; derived values labeled         |
| **3. Participation is measurable**    | Pipeline stages are visible at a glance      | **Initiative Levels**        | Stage distribution; civic pipeline vocabulary            |
| **4. Ideas become collective action** | Real initiatives illustrate collective paths | **Latest Initiatives**       | Concrete civic stories; link to exploration              |
| **5. You may participate**            | Joining is invited, not required             | **Registration Gateway**     | Explicit invitation; Join Humanity Union label permitted |
| _(throughout)_                        | Navigation and obligations remain stable     | **Footer**                   | Supporting links; trust and accessibility entry          |

## Global chrome (narrative frame)

| Block                    | Narrative role                                                     |
| ------------------------ | ------------------------------------------------------------------ |
| **Header**               | Persistent orientation — visitor always knows primary destinations |
| **Geographic Navigator** | Scope story — World is a lens, not a separate product              |

## Composition order

```
Header · Geographic Navigator
Hero                          → Stage 1
Interactive Map               → Stage 2
Statistics                    → Stage 3
Initiative Levels             → Stage 3
Latest Initiatives            → Stage 4
Registration Gateway          → Stage 5
Footer
```

No block may appear out of narrative order without Architecture Review.

Optional secondary blocks — About Preview, Trusted Media Carousel — may support Stages 3–4 if added in later specs; they must not introduce a second primary message on the same screen.

---

# Emotional Journey

Global Experience guides emotion as carefully as information.

```
Curiosity

↓

Orientation

↓

Confidence

↓

Inspiration

↓

Invitation
```

## Curiosity

**When:** arrival and Hero.

**Feeling:** _Something real may be here worth looking at._

**Not:** hype, fear of missing out, or immediate signup demand.

## Orientation

**When:** Interactive Map and early scan.

**Feeling:** _I know where I am and what kind of place this is._

**Not:** disorientation from scope tricks or navigation overload.

## Confidence

**When:** Statistics and Initiative Levels.

**Feeling:** _I can understand what is happening without being an insider._

**Not:** false precision, unlabeled derived metrics, or certification language.

## Inspiration

**When:** Latest Initiatives.

**Feeling:** _Collective civic action is possible and visible._

**Not:** hero worship of individuals, ranking pressure, or engagement gamification.

## Invitation

**When:** Registration Gateway.

**Feeling:** _I may join if I choose — when I am ready._

**Not:** guilt, urgency, or implied obligation to register after browsing.

## Humanity Union never pressures visitors

Emotional journey ends in **Invitation** — not **Coercion**.

Calm exit — explore Initiatives, read About, share a link, return later — is narrative success.

Registration is a valid outcome.

Non-registration is a valid outcome.

Pressure is never a valid outcome.

---

# Trust Narrative

Trust in Global Experience is built through **transparency** — not **persuasion**.

## Transparency replaces persuasion

The platform does not ask visitors to believe.

It shows what is recorded publicly and how to verify presentation honesty.

| Persuasion (forbidden) | Transparency (required)                       |
| ---------------------- | --------------------------------------------- |
| "Trusted by millions"  | Observable activity with honest scope         |
| "Verified complete"    | Derived indicators labeled derived            |
| "Official proof"       | Evidence as substantiation on detail paths    |
| "Join now before…"     | Registration Gateway after comprehension      |
| Certification badges   | About path and explainable public projections |

## Trust narrative beats

1. **Hero** — bounded platform claim: what Humanity Union is and is not.
2. **Interactive Map** — activity is locatable and explorable — not hidden.
3. **Statistics / Initiative Levels** — aggregate truth with honest labeling and sparse-data acknowledgment.
4. **Latest Initiatives** — traceable civic subjects link to public detail — verification possible.
5. **Registration Gateway** — no trust bargain ("sign up to see the truth"); public truth remains public.
6. **Footer** — accessibility, legal clarity and contact — institutional seriousness without marketing.

## Trust Through Verification

Visitors who scrutinize — Verification Seekers — must find audit paths without a separate "trust mode."

Derived labels, About entry and initiative detail links are part of the trust narrative — not footnote afterthoughts.

Explainable Honesty is narrative requirement — not copywriter preference.

---

# Final Statement

**Global Experience communicates Humanity Union through observable civic activity rather than promotional messaging.**

The narrative is sequential:

Humanity exists → Humanity is active → Participation is measurable → Ideas become collective action → You may participate.

Each stage is One Screen — One Message.

Each message maps to an approved Experience Block.

Emotional journey moves from Curiosity to Invitation — never to Pressure.

Trust is earned through transparency — not requested through persuasion.

Copy, design and implementation must serve this narrative.

Blocks without narrative purpose must not appear.

Narrative without block architecture must not be invented.

Epic 02 builds the Global Experience **story** within Epic 01 **structure**.

This document does not define implementation.

It defines the civic story the Global Experience exists to tell.

---

# References

| Document                     | Path                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Epic 02 Discovery Session 01 | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/DISCOVERY_SESSION_01.md`            |
| Global Experience Vision     | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`        |
| Epic 01 Architecture Freeze  | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`     |
| Experience Block Library     | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md` |

---

# Document Status

**Draft**

Global Experience Narrative — Epic 02

Copy specifications, visual design briefs and implementation guides must align with this narrative before build proceeds.
