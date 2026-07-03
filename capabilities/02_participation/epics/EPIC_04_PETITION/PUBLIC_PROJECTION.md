# PUBLIC PROJECTION

## Capability 02 — Participation

### Epic 04 — Petition

Version: 1.0

Status: Draft

---

# Purpose

Specify the Public Projection of the Petition Aggregate.

The Public Projection provides a transparent, read-only representation of a Petition for Public Visitors and society at large.

It answers:

"What is this Petition?"

"What decision does it support?"

"How much public support has it received?"

"How may a person observe, share or begin participation?"

The Public Projection communicates endorsement context and aggregate support.

It never exposes operational or participant-specific internals.

---

# Audience

Primary audience:

- Public Visitor
- civic observer
- media
- institutions
- community members outside active workspace context

Secondary audience:

- Participant reviewing the public record after signing

The Public Projection serves transparency.

It does not serve administration, moderation or operational management.

---

# Public Information Model

The Public Projection represents one approved Petition as a dedicated public read model.

It is independent from the Petition Aggregate root.

It exposes only approved public fields derived from Petition state and referenced context.

Conceptual model:

```
PublicPetitionProjection

├── petition identity
├── petition summary
├── petition lifecycle status
├── petition subject
├── approved decision context
├── public support statistics
├── petition outcome
├── share reference
└── participation entry guidance
```

The projection is built from the Aggregate.

It is not a direct serialization of operational data.

---

# Relationship to Operational Workspace

Operational Workspace and Public Projection are intentionally separate.

Operational Workspace

Supports participation.

Includes:

- personal signing status;
- Endorsement Panel;
- participant journey continuity;
- Next Meaningful Action for registered Participants;
- operational navigation.

Public Projection

Supports transparency.

Includes:

- aggregate petition summary;
- approved decision context;
- public support statistics;
- share reference;
- registration entry for future signing.

The Public Projection never shows:

- whether a specific visitor has signed;
- participant workspace state;
- internal policy mechanics beyond public eligibility summary;
- operational controls.

A person may read the Public Projection without identity.

A person must register before signing.

---

# Visible Information

The Public Projection may expose:

## Petition Identity

- Petition identifier in public form
- public title or subject title
- Support Status
- lifecycle state in public terms

## Petition Summary

- concise description of the Public Endorsement purpose
- statement that the Petition follows an approved Collective Decision
- publication timing where relevant

## Petition Subject

- subject title
- subject summary
- subject type in Version 1: Initiative

## Approved Decision Context

- reference to the supporting Collective Decision in public terms
- approved outcome summary
- decision summary sufficient for informed public understanding
- concise Initiative and analysis context approved for public display

The Public Projection helps observers understand what was already decided before support is expressed.

## Public Support Statistics

- Support Count
- aggregate participation indicators
- threshold status in public terms when policy defines thresholds
- active or final support state depending on lifecycle

Statistics are aggregate only.

## Petition Outcome

When lifecycle permits:

- public endorsement outcome
- final support summary
- statement of what the outcome means publicly

## Share Reference

- permanent Share Link
- public URL identity for observation and distribution

## Participation Entry Guidance

- explanation that registration is required to sign
- Registration Gateway entry
- clear distinction between sharing and signing

---

# Hidden Information

The Public Projection must never expose:

## Participant Identity

- participant names beyond approved public visibility rules
- lists of individual signers unless a future explicit public policy intentionally allows limited public attribution

Version 1 default:

aggregate support only, not signer identity lists.

## Operational Internals

- internal policy configuration details
- withdrawal mechanics
- moderation records
- audit diagnostics
- platform metadata

## Signature Records

- individual Signature objects
- participant signing history
- timestamps tied to identifiable participants in public view

## External Aggregate Internals

- full Initiative operational state
- Collaborative Analysis contributions and signals
- Collective Decision ballot internals
- participant decisions
- decision rules and eligibility rules

Referenced context appears as approved summary only.

## Workspace State

- whether the current viewer has signed
- Participant Workspace contents
- Next Meaningful Action logic
- navigator internals

## Engagement Data

- share counts tied to individuals
- registration funnel analytics
- internal conversion metrics

Public sharing increases visibility.

Internal engagement measurement remains operational.

---

# Public Sharing

Share Link provides permanent public access to the Petition Projection.

Sharing enables:

- civic observation;
- public awareness;
- institutional review;
- media reference;
- voluntary distribution.

Sharing does not imply endorsement.

The Public Projection must state clearly:

- viewing is not signing;
- sharing is not signing;
- registration is required before support is recorded.

Share Link remains stable across Published, Open, Closed and Archived states unless a future governance policy explicitly supersedes it.

---

# Registration Gateway

Registration Gateway is the public entry point from observation to participation.

On the Public Projection, the gateway enables:

- identity creation;
- transition from Public Visitor to Participant;
- continuation toward signing when the Petition is Open;
- preservation of originating Petition context after registration.

The Public Projection presents the gateway.

Identity administration belongs outside the Petition Aggregate.

The gateway is part of the participation experience, not the projection data model itself.

Public Visitors may:

- read;
- share;
- register.

Public Visitors may not sign until registration is complete and the Petition is Open.

---

# Public Statistics

Public statistics are aggregate and derived.

They may include:

- Support Count;
- total signatures;
- threshold progress in public terms;
- active or final outcome indicators;
- high-level participation trend summaries approved for public display.

Public statistics must:

- be derived from immutable Signature records;
- never be manually edited;
- remain understandable without operational knowledge;
- avoid ranking individuals or groups.

Public statistics answer:

"How much support exists?"

They do not answer:

"Who signed?" unless a future explicit public policy changes that boundary.

---

# Transparency Principles

The Public Projection follows Explicit Publicity.

## Decision Before Support

The approved Collective Decision context must be visible enough for informed public understanding.

## Aggregate Over Individual

Public legitimacy comes from transparent totals, not exposed private participation detail.

## Read-Only Public Record

The Public Projection observes and reports.

It does not mutate Petition state except through defined participation entry paths.

## Stable Public Meaning

Public fields use civic language consistent with Domain Language.

Support Status, outcome and statistics must remain understandable to non-members.

## Historical Preservation

Closed and Archived Petitions remain publicly understandable.

Public records support long-term civic memory.

## No Hidden Endorsement Mechanics

Thresholds and outcomes appear in public terms.

Rules are not obscured, but internal policy structures remain private.

---

# Privacy Boundaries

The Public Projection balances transparency with participant dignity.

Public by design:

- petition existence;
- subject context;
- approved decision context;
- aggregate support;
- public outcome;
- share reference.

Private by default:

- participant identity;
- individual signature records in public view;
- personal participation history;
- operational workspace state.

Future policies may adjust visibility boundaries.

Any change requires architectural review.

Version 1 preserves aggregate transparency and participant privacy.

---

# Lifecycle Visibility

Public Projection availability follows Petition lifecycle.

## Published and Later

Public page available.

Share Link active.

Observation and sharing permitted.

Registration Gateway available.

Signing guidance appears according to lifecycle state.

## Open

Public support statistics update reflectively.

Registration and signing entry are available through the participation path.

## Closed

Signing is no longer available publicly.

Final public statistics and outcome become visible.

## Archived

Read-only historical public record remains available.

Public meaning is preserved.

Active endorsement language must not remain.

---

# Cross-Projection Relationships

The Public Petition Projection may reference public projections of related Aggregates.

Examples:

- Public Initiative
- Public Collaborative Analysis
- Public Collective Decision

Relationships are navigational and contextual.

The Petition Public Projection does not embed operational data from other Aggregates.

Each projection represents only its own approved public model.

---

# What the Public Projection Must Never Do

The Public Projection must never:

- expose participant-only operational information;
- reveal individual signer identities in Version 1;
- reopen Collective Decision participation;
- allow signing without registration;
- imply that viewing or sharing equals endorsement;
- present engagement-optimized social pressure mechanics;
- expose internal platform diagnostics;
- mutate external Aggregates;
- replace the Operational Workspace for registered Participants.

---

# Success Criteria

The Public Projection specification is successful when any Public Visitor can:

- understand the Petition;
- review the supporting approved decision context;
- share the Petition;
- register in order to sign when the Petition is Open;

while operational participant information remains private and aggregate civic transparency remains public.

---

# Final Principle

The Public Projection makes collective endorsement visible to society.

It preserves accountability without exposing participant-only operational detail.

Transparency serves civic legitimacy.

Privacy preserves participant dignity.

Both are required.
