# PUBLIC PROJECTION

## Capability 02 — Participation

### Epic 05 — Implementation Commitment

Version: 1.0

Status: Draft

---

# Purpose

Specify the Public Projection of the **Implementation Commitment** Aggregate.

Public Projection allows anyone to understand the community's readiness to implement an approved initiative.

It is informational.

It is not operational.

The Public Projection provides a transparent, read-only representation of declared community capacity and derived implementation readiness for Public Visitors, civic observers, institutions and society at large.

It answers:

- What approved direction is this commitment preparing to implement?
- How much declared community capacity exists?
- How close is the community to implementation readiness?
- What public needs remain unmet?
- How may a person observe, share or begin accountable participation?

The Public Projection communicates preparedness context and aggregate readiness.

It never exposes operational or participant-specific internals.

This document defines architectural intent only.

It does not define implementation.

Terminology and boundaries must conform to:

- `EXPERIENCE_ARCHITECTURE.md`
- `WORKSPACE_SPECIFICATION.md`
- `PARTICIPATION_ARCHITECTURE_FREEZE.md`

---

# Audience

Primary audience:

- Public Visitor;
- civic observer;
- media;
- institutions;
- community members outside active workspace context.

Secondary audience:

- Participant reviewing the public record after declaring a contribution.

The Public Projection serves transparency.

It does not serve administration, moderation, coordination or operational management.

---

# Relationship to Operational Workspace

Operational Workspace and Public Projection are intentionally separate surfaces.

| Surface | Audience | Purpose | Writable |
|---------|----------|---------|----------|
| Operational Workspace | Registered participants | Informed declaration and personal commitment management | Through operational API commands only |
| Public Projection | Public visitors, observers, society | Transparency and civic observation | Read-only |

**Operational Workspace** supports participation.

It includes personal Contribution Profile, declaration surfaces, withdrawal history, Next Meaningful Action and participant journey continuity.

**Public Projection** supports transparency.

It includes approved public context, aggregated Community Capacity, derived Implementation Readiness, unmet Community Needs, share reference and registration entry guidance.

A person may read the Public Projection without identity.

A person must register before creating or modifying an Implementation Commitment declaration.

Observation is public.

Accountable declaration is operational.

---

# Public Information Model

The Public Projection represents one Implementation Commitment as a dedicated public read model.

It is independent from the Implementation Commitment Aggregate root.

It exposes only approved public fields derived from aggregate state and referenced context.

Conceptual model:

```
PublicImplementationCommitmentProjection

├── commitment identity
├── commitment summary
├── commitment lifecycle status
├── approved initiative context
├── approved collective decision context
├── related petition context
├── public community capacity
├── public implementation readiness
├── public community needs
├── share reference
└── participation entry guidance
```

The projection is built from the Aggregate.

It is not a direct serialization of operational data.

---

# Public Information Hierarchy

Public information appears in civic reading order.

Approved direction precedes derived capacity.

Derived capacity precedes readiness and unmet needs.

Participation entry follows understanding.

```
1. Initiative

↓

2. Collective Decision

↓

3. Petition

↓

4. Community Capacity

↓

5. Implementation Readiness

↓

6. Community Needs

↓

7. Share

↓

8. Registration Gateway
```

Context precedes aggregates.

Aggregates precede entry to accountable participation.

Share and Registration Gateway remain subordinate to informational sections — not primary pressure surfaces.

---

## 1. Initiative

**Purpose:**

Anchor the public record in the approved civic subject.

**Display:**

- Initiative title and public summary approved for display;
- reference to the structured proposal being prepared for implementation;
- statement that Implementation Commitment follows prior pipeline stages.

**Behavior:**

Read-only.

Approved public snapshot only.

Does not expose Initiative operational workspace internals.

---

## 2. Collective Decision

**Purpose:**

Help observers understand what was already decided before readiness is evaluated.

**Display:**

- approved Collective Decision outcome in public terms;
- decision summary sufficient for informed public understanding;
- statement that readiness does not reopen or re-authorize the decision.

**Behavior:**

Read-only.

Does not expose ballot internals, participant votes or decision rules beyond public eligibility summary.

---

## 3. Petition

**Purpose:**

Present related public endorsement context where applicable.

**Display:**

- related Petition public summary;
- aggregate public support indicators approved for cross-reference;
- statement that endorsement expressed public support — not implementation preparedness.

**Behavior:**

Read-only.

Does not expose individual signatures or signer identity.

Does not treat signature counts as Community Capacity.

---

## 4. Community Capacity

**Purpose:**

Show aggregated declared preparedness available for public understanding.

See **Community Capacity** for display rules and privacy boundaries.

---

## 5. Implementation Readiness

**Purpose:**

Show derived readiness as a public civic indicator.

See **Implementation Readiness** for meaning and boundaries.

---

## 6. Community Needs

**Purpose:**

Show unmet public requirements derived from policy evaluation.

See **Community Needs** for factual presentation rules.

---

## 7. Share

**Purpose:**

Enable permanent public observation and voluntary distribution.

See **Share** for link and sharing rules.

---

## 8. Registration Gateway

**Purpose:**

Explain the boundary between public observation and accountable declaration.

See **Registration Gateway** for visitor permissions and registration requirements.

---

# Community Capacity

Community Capacity on the Public Projection displays **only aggregated public information**.

## Public Display Categories

Present capacity in civic language without individual attribution.

Examples:

- **Volunteers** — aggregate volunteer declaration counts and availability summary in public-safe terms;
- **Coordinators** — aggregate coordinator-category coverage where policy defines this dimension;
- **Translators** — aggregate skill-category coverage such as translation capacity;
- **Transportation** — aggregate mobility or logistics resource declarations;
- **Facilities** — aggregate venue or space resource declarations;
- **Expertise** — aggregate professional or skill coverage in policy-aligned labels.

Exact public labels follow Frozen Policy threshold vocabulary where defined.

Generic civic labels apply when policy does not specify finer public categories.

## Aggregation Rules

All public capacity values are **derived**.

They are computed from recorded Contribution Items.

They are never manually edited on the public surface.

They reflect active declared preparedness — not completed implementation work.

Withdrawn declarations affect aggregate totals while individual withdrawal detail remains private.

## Privacy Rule

**Never expose participant identities.**

The Public Projection shows community totals and category distributions only.

It does not show:

- who declared;
- how much any individual declared;
- personal availability windows tied to identifiable participants;
- Contribution Profile contents;
- ranking or comparison among participants.

Version 1 default:

aggregate capacity only, not contributor identity lists.

---

# Implementation Readiness

Implementation Readiness is displayed as a **derived value** on the Public Projection.

## Public Meaning

Readiness reflects how closely current **Community Capacity** satisfies the **Frozen Policy**.

The Public Projection presents:

- readiness reached or not yet reached in civic language;
- high-level threshold progress in public-safe terms;
- optional normalized indicator only where policy defines public scoring;
- brief explanation of what readiness means for this commitment phase.

## Required Public Clarifications

The Public Projection must always communicate:

**Readiness is not approval.**

Implementation Readiness does not re-authorize the Collective Decision.

It does not authorize bypass of governance.

It describes declared preparedness relative to frozen implementation policy — not execution progress, task completion or employment status.

## Derivation Rules

Readiness is read-only on the public surface.

It is recomputed when underlying declarations or governed policy reference changes.

It is never manually set through the Public Projection.

During early lifecycle states where derivation is not yet authoritative, the Public Projection must not present misleading final readiness claims.

---

# Community Needs

Community Needs on the Public Projection display **only unmet public needs**.

## Purpose

Help observers understand what kinds of declared capacity are still insufficient — without turning the public page into a recruitment campaign.

## Display Examples

- One coordinator needed;
- Two translators needed;
- Venue required;
- Transportation resource needed;
- Professional review capacity needed.

Examples follow actual Readiness Threshold and approved subject vocabulary.

Needs are expressed as community requirements — not assigned tasks to specific people.

## Presentation Rules

Needs must be **factual**.

Never **persuasive**.

Required behavior:

- state the gap in policy-aligned civic language;
- connect needs to readiness evaluation factually;
- avoid urgency, shame or failure framing;
- avoid calls to action that substitute for Registration Gateway and operational declaration;
- avoid naming or implying specific participants should fulfill a need.

When no unmet public needs remain:

- state calmly that required public needs are satisfied or that the needs section shows gaps only;
- do not use empty needs as social pressure to declare.

---

# Registration Gateway

Registration Gateway is the public entry point from observation to accountable participation.

## What Public Visitors May Do

Public Visitors may:

- **read** — understand approved direction, capacity, readiness and unmet needs;
- **understand** — learn what Implementation Commitment means without operational access;
- **share** — distribute the public link for civic observation.

Public Visitors may **not** create or modify an Implementation Commitment through the Public Projection alone.

## What Requires Registration

To **create** or **modify** a Commitment, a visitor must register.

The Public Projection must explain this clearly:

- observation does not record preparedness;
- sharing does not record preparedness;
- registration is required before declaration or profile change;
- after registration, the participant continues in the **Operational Workspace** — not through hidden controls on the public page.

## Gateway Behavior

The gateway enables:

- identity creation or authentication handoff per platform policy;
- transition from Public Visitor to Participant;
- preservation of originating Implementation Commitment context after registration;
- continuation toward operational declaration when aggregate lifecycle and eligibility permit.

The Public Projection presents the gateway.

Identity administration belongs outside the Implementation Commitment Aggregate.

The gateway is part of the participation experience, not the projection data model itself.

## Eligibility Communication

When declaration is not yet available — for example aggregate in **Draft** or **Submitted** — the gateway explains:

- why declaration is not open;
- that public observation remains available;
- what lifecycle change must occur before eligible participants may declare.

When aggregate is **Withdrawn**, **Completed** or **Archived**:

- gateway does not invite new declarations unless explicit future policy defines otherwise;
- public record remains readable.

---

# Humanity Assistant

The Humanity Assistant may appear on the Public Projection as contextual guidance.

It is an experience boundary — not an Aggregate and not a substitute for human judgment.

## Assistant May

The assistant may:

- explain readiness — what derived readiness means and what it does not mean;
- explain community needs — factual gap descriptions aligned to policy thresholds;
- explain policy requirements — Frozen Policy requirements in plain civic language approved for public display.

## Assistant Never

The assistant never:

- **persuades** — no urgency, moral ranking, shame or social comparison;
- **requests commitment** — no pressure to declare or re-declare;
- **creates commitment** — no autonomous recording of contributions on behalf of visitors.

Additional public boundaries:

- never decides whether a visitor should declare;
- never mutates aggregates or projection data;
- never exposes private participant detail;
- never bypasses Registration Gateway for accountable acts;
- never conceals that it is automated guidance.

Public Humanity Assistant follows the frozen platform principles in `PARTICIPATION_ARCHITECTURE_FREEZE.md`.

It supports civic literacy on the public surface.

It does not optimize for conversion or session volume.

---

# Share

Share provides permanent public access to the Implementation Commitment Projection.

## Share Link

Generate **permanent public links** for observation and distribution.

Share Link characteristics:

- stable public URL identity for the projection;
- readable without authentication;
- persistent across lifecycle states where public observation remains permitted;
- updated reflectively when public fields change — without breaking the public reference.

## Social Sharing

Support social sharing through standard share affordances.

Sharing enables:

- civic observation;
- public awareness of community preparedness;
- institutional review;
- media reference;
- voluntary distribution among communities.

Sharing does **not** imply declaration of preparedness.

The Public Projection must state clearly:

- viewing is not declaring;
- sharing is not declaring;
- registration and operational workspace entry are required before commitment is recorded.

## Share vs Participation

Share increases visibility.

It does not increase declared capacity.

Internal engagement measurement remains operational — not a public projection concern.

---

# Privacy

The Public Projection balances civic transparency with participant dignity.

## Never Expose

The Public Projection must never expose:

### Participant Identities

- participant names beyond approved public visibility rules;
- lists of declarants or contributors;
- identifiable attribution tied to capacity totals.

### Commitment History

- individual declaration timelines;
- withdrawal records tied to identifiable participants;
- personal commitment status;
- whether a specific visitor has declared.

### Contribution Details

- Contribution Items;
- Contribution Profiles;
- Contribution Capacity per participant;
- personal Availability windows;
- Contribution Type choices attributable to individuals.

### Internal Workspace Information

- Operational Workspace layout state;
- Next Meaningful Action logic;
- Participation Navigator internals;
- internal policy configuration structures;
- moderation or audit diagnostics;
- platform metadata not approved for public display.

## Public by Design

Public by default:

- commitment existence and lifecycle state in public terms;
- approved Initiative, Collective Decision and Petition context summaries;
- aggregated Community Capacity;
- derived Implementation Readiness;
- unmet Community Needs in factual civic language;
- share reference;
- registration entry guidance.

Future policies may adjust visibility boundaries.

Any change requires Architecture Review.

Version 1 preserves aggregate transparency and participant privacy.

---

# Related Navigation

The Public Projection may link to related public projections for pipeline continuity.

Navigation is contextual and read-only.

It does not embed operational data from other Aggregates.

## Public Initiative

Link to the Public Initiative projection for originating proposal context.

## Public Collective Decision

Link to the Public Collective Decision projection for approved direction context.

Does not reopen decision participation.

## Public Petition

Link to the Public Petition projection for related endorsement context.

Does not treat signatures as capacity.

## Future Public Implementation

Link to the Public Implementation projection when:

- Implementation stage is available for this participation path;
- public observation policy permits the link;
- Implementation Commitment lifecycle indicates handoff eligibility.

Link is informational when Implementation is not yet active.

Navigation must not imply that public readiness observation equals execution authorization.

## Presentation Rules

- secondary to informational sections;
- labeled as related public context;
- calm civic language;
- no pressure to proceed through the pipeline.

---

# Lifecycle Visibility

Public Projection availability follows Implementation Commitment lifecycle.

## Draft and Submitted

Public observation may be limited or provisional per policy.

When visible:

- approved context may appear;
- declaration entry must not be offered prematurely;
- readiness claims must not be presented as final.

## Active

Public Community Capacity, Implementation Readiness and Community Needs update reflectively.

Registration Gateway available when declaration is permitted.

Share Link active when public page is published.

## Completed

Collection phase ended successfully.

Final public readiness and capacity summaries visible.

Declaration entry not available unless explicit future policy defines revision windows.

## Withdrawn

Public record reflects withdrawn commitment phase.

Historical aggregate summaries preserved in public-safe terms.

No new declaration entry.

## Archived

Read-only historical public record remains available.

Public meaning preserved.

Active collection language must not remain.

---

# Transparency Principles

The Public Projection follows Explicit Publicity.

## Direction Before Readiness

Approved Collective Decision and related context must be visible enough for informed public understanding before readiness headlines dominate.

## Aggregate Over Individual

Public legitimacy comes from transparent totals and factual needs — not exposed private declaration detail.

## Read-Only Public Record

The Public Projection observes and reports.

It does not mutate Implementation Commitment state except through defined registration and operational entry paths.

## Stable Public Meaning

Public fields use civic language consistent with Domain Language.

Readiness, capacity and needs must remain understandable to non-members.

## Historical Preservation

Completed, Withdrawn and Archived commitments remain publicly understandable where policy permits.

Public records support long-term civic memory.

## No Hidden Readiness Mechanics

Threshold progress and unmet needs appear in public terms.

Internal policy structures remain private beyond public eligibility and threshold summaries.

---

# What the Public Projection Must Never Do

The Public Projection must never:

- expose participant identities or individual contribution detail in Version 1;
- expose personal commitment history or workspace state;
- allow declaration or modification without registration and operational workspace entry;
- manually edit Community Capacity or Implementation Readiness;
- treat Petition signature counts as Community Capacity;
- reopen Collective Decision or Petition participation;
- use persuasive, urgent or gamified language to drive declarations;
- imply that viewing or sharing equals declaring preparedness;
- expose internal platform diagnostics;
- mutate external Aggregates;
- replace the Operational Workspace for registered Participants;
- assign implementation tasks or imply employment from public needs display.

---

# Success Criteria

The Public Projection specification is successful when any Public Visitor can:

- understand the approved initiative direction and related decision context;
- review aggregated Community Capacity and derived Implementation Readiness;
- review factual unmet Community Needs without persuasive pressure;
- share the public record;
- understand that registration is required to create or modify a commitment;

while participant identities, contribution detail and operational workspace information remain private and aggregate civic transparency remains public.

---

# Final Principle

Public Projection explains the community's implementation capacity while protecting individual participants and preserving the distinction between public information and operational participation.

Transparency serves civic legitimacy.

Privacy preserves participant dignity.

Both are required.

Implementation Commitment records voluntary capacity in the operational layer.

The Public Projection makes aggregate preparedness visible to society — never at the cost of individual exposure, never by blurring observation with declaration, and never by substituting public visibility for accountable human choice.
