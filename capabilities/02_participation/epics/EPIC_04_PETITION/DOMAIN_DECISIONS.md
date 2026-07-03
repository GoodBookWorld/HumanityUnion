# DOMAIN_DECISIONS

## Capability 02 — Participation

### Epic 04 — Petition

Version: 1.0

Status: Draft

---

# Purpose

This document records the architectural decisions that define the Petition Aggregate.

These decisions explain *why* the domain is designed as it is.

They protect architectural consistency throughout the evolution of the Participation Capability.

Changes require architectural review.

---

# Decision 01

## Petition Begins Only After an Approved Collective Decision

### Decision

A Petition may begin only when a Collective Decision Outcome is Approved.

Rejected or incomplete decisions do not produce Petition eligibility.

### Rationale

Petition is not a substitute for decision-making.

If Petition could begin without approval, public support would compete with — or bypass — informed collective judgment.

The Participation Pipeline establishes a clear sequence:

Collective Decision establishes legitimacy.

Petition gathers support for a decision already made.

Separating eligibility from endorsement preserves accountability and prevents support from being mistaken for authorization.

### Consequences

- Petition references an approved Collective Decision.
- Petition never reopens ballot questions.
- Eligibility is a precondition, not an automatic creation event.
- Collective Decision remains responsible for deciding; Petition remains responsible for endorsing.

Status:

Accepted

---

# Decision 02

## Petition Is the Public Endorsement Stage

### Decision

Petition is defined as the Public Endorsement stage of the Participation Pipeline.

It is not a generic signature collection mechanism detached from platform context.

### Rationale

Humanity Union participation is staged, not fragmented.

Each stage answers a distinct civic question.

Collective Decision answers:

"What did the community decide?"

Petition answers:

"How strongly does the community support acting on that decision?"

Naming Petition as Public Endorsement clarifies its civic role.

It connects platform participation to society without collapsing decision and support into one undifferentiated action.

### Consequences

- Petition language, lifecycle and projections emphasize endorsement, not re-decision.
- Public support is presented in relation to an approved decision context.
- Future stages can build on endorsement without redefining Petition.

Status:

Accepted

---

# Decision 03

## Community Participation and Public Participation Are Modes of One Aggregate

### Decision

Community Participation and Public Participation are two participation modes within the same Petition Aggregate.

They are not separate Aggregates.

### Rationale

Both modes express support for the same approved decision through the same Signature model.

Splitting them into separate Aggregates would duplicate:

- lifecycle;
- policies;
- statistics;
- public presentation;
- historical records.

The difference is entry path and audience, not domain meaning.

A registered Participant and a Public Visitor who registers both produce Signatures governed by the same rules.

One Aggregate preserves a single source of truth for public support.

### Consequences

- One Petition owns all Signatures regardless of entry mode.
- Support Metrics derive from one participation record set.
- Public and community participation differ in gateway experience, not aggregate ownership.

Status:

Accepted

---

# Decision 04

## Public Visitors May Observe and Share Without Registration

### Decision

Public Visitors may access the public Petition view and use Share Links without registering.

Reading and sharing do not require identity.

### Rationale

Transparency requires accessibility.

If observation required registration, public legitimacy would be weakened by participation friction alone.

Sharing increases visibility without implying endorsement.

Allowing read-only public access supports:

- civic observation;
- media review;
- institutional awareness;
- informed choice before participation.

Registration should be required only when a person intends to act, not when they intend to understand.

### Consequences

- Public Petition projections remain readable without authentication.
- Share Links are permanent public references.
- Sharing is distinct from signing.

Status:

Accepted

---

# Decision 05

## Registration Is Required Before Signing

### Decision

A Signature may be recorded only after a person becomes a registered Participant through the Registration Gateway.

Public Visitors cannot sign anonymously or without identity.

### Rationale

Public support must be accountable.

Anonymous signatures weaken auditability and historical integrity.

Registration establishes:

- participant identity;
- participation history;
- transparent attribution within platform rules;
- continuity into the broader Participation journey.

Requiring registration before signing balances openness with responsibility.

Observation remains public; endorsement remains attributable.

### Consequences

- Registration Gateway sits between public observation and Signature submission.
- Signing is a deliberate authenticated act.
- Participation history can be preserved without exposing unnecessary identity in public projections.

Status:

Accepted

---

# Decision 06

## A Signature Is Immutable Once Recorded

### Decision

A recorded Signature is immutable.

It may not be edited, replaced or silently altered.

Withdrawal, if permitted, is a separate explicit domain action governed by Petition Policy — not mutation of history.

### Rationale

Public endorsement loses credibility if support records can be rewritten.

Historical integrity requires that the platform preserve what was expressed and when.

Immutability supports:

- auditability;
- public trust;
- accountability;
- long-term institutional memory.

Civic participation must leave a truthful record.

### Consequences

- Signatures are append-only within a Petition.
- Corrections require explicit policy-permitted withdrawal or supersession events, not silent edits.
- Public statistics derive from immutable records.

Status:

Accepted

---

# Decision 07

## Petition Owns Endorsement but Never Owns External Aggregates

### Decision

Petition owns endorsement data:

- Signatures;
- Petition Policy;
- Support Metrics;
- Petition Outcome;
- public presentation context.

Petition never owns or modifies:

- Initiative;
- Collaborative Analysis;
- Collective Decision.

### Rationale

Each Aggregate in the Participation Pipeline has one lifecycle and one consistency boundary.

If Petition could modify an Initiative or reinterpret a Collective Decision, aggregate independence would collapse.

Petition consumes eligibility and context through references.

It produces support records and civic visibility.

External Aggregates remain authoritative for their own domains.

### Consequences

- Petition references CollectiveDecisionId and InitiativeId.
- Approved decisions are not re-adjudicated inside Petition.
- Initiative lifecycle advancement remains coordinated, not duplicated.

Status:

Accepted

---

# Decision 08

## Petition Intentionally Ends Before Implementation Commitment

### Decision

Petition concludes at public endorsement.

Implementation Commitment is a separate future stage.

Petition does not absorb implementation readiness, volunteer coordination or execution planning.

### Rationale

Support and implementation readiness are different civic questions.

Petition answers:

"Does society support this decision?"

Implementation Commitment answers:

"Who is prepared to participate in implementation?"

Combining them would blur public endorsement with operational commitment.

Participants who support a decision are not necessarily prepared to implement it.

Separating stages preserves clarity and respects different forms of participation.

### Consequences

- Petition Outcome describes endorsement achievement, not implementation status.
- Successful Petition may enable eligibility for Implementation Commitment.
- Implementation Commitment belongs to a future Aggregate or Epic.

Status:

Accepted

---

# Decision 09

## Contribution Recognition Acknowledges Actions, Not Personal Worth

### Decision

Participant-facing communication uses Contribution Recognition.

The platform acknowledges participation actions.

It never evaluates character, morality or personal worth.

### Rationale

Civic platforms should strengthen responsibility without performing judgment on people.

Recognition such as "Your signature has been recorded" confirms action.

Statements such as "You are a good citizen" assign moral value outside platform scope.

Human dignity requires that participation be acknowledged without ranking, praising or diminishing the person.

This aligns with Human Leadership and Audience-Centered Architecture.

### Consequences

- Approved recognition messages describe actions and outcomes only.
- UI copy avoids moral evaluation, hero framing or shame language.
- Recognition is informational, not reputational.

Status:

Accepted

---

# Decision 10

## Recommend Only the Next Meaningful Action

### Decision

After participation, the platform recommends only the Next Meaningful Action based on the participant's actual journey.

It does not present an undifferentiated menu of unrelated options.

### Rationale

Calm interfaces reduce cognitive load.

After signing a Petition, the participant should understand:

- what just happened;
- where they are in the civic journey;
- what one sensible next step exists.

Random navigation treats participation as disconnected clicks.

Journey-based recommendation treats participation as continuity.

The Next Meaningful Action may include:

- returning to the Petition context;
- reviewing related Initiative or Decision context;
- entering Participant Workspace;
- preparing for a future stage when eligible.

Recommendation must follow actual state, not generic promotion.

### Consequences

- Post-signature experience is contextual, not generic.
- Navigation emphasizes continuity within the Participation Pipeline.
- Multiple competing calls to action are avoided.

Status:

Accepted

---

# Decision 11

## Participation Navigator Will Become a Platform-Level Service

### Decision

Future Participation Navigator capabilities will be implemented as a platform-level service.

They will not become part of the Petition Aggregate.

### Rationale

Journey guidance applies across Initiatives, Analysis, Decisions, Petitions and future stages.

If navigation logic lived inside Petition, every Aggregate would eventually duplicate it.

A platform-level service can:

- interpret participant state across Aggregates;
- recommend next actions consistently;
- evolve independently of any one Epic;
- serve Audience-Centered Architecture across the platform.

Petition may consume navigator recommendations.

Petition must not own navigation architecture.

### Consequences

- Petition focuses on endorsement domain responsibilities only.
- Cross-stage journey guidance remains reusable.
- Future navigator service references aggregate state without owning it.

Status:

Accepted

---

# Decision Summary

| ID | Decision | Status |
|----|----------|--------|
| 01 | Petition begins only after Approved Collective Decision | Accepted |
| 02 | Petition is the Public Endorsement stage | Accepted |
| 03 | Community and Public Participation are modes of one Aggregate | Accepted |
| 04 | Public Visitors may read and share without registration | Accepted |
| 05 | Registration required before signing | Accepted |
| 06 | Signature is immutable once recorded | Accepted |
| 07 | Petition owns endorsement, not external Aggregates | Accepted |
| 08 | Petition ends before Implementation Commitment | Accepted |
| 09 | Recognition acknowledges actions, not personal worth | Accepted |
| 10 | Recommend only Next Meaningful Action | Accepted |
| 11 | Participation Navigator is a future platform service | Accepted |

---

# Final Principle

Petition architectural decisions exist to preserve the distinction between decision, endorsement and implementation.

Each decision strengthens transparency, aggregate independence and responsible civic participation across the Humanity Union platform.
