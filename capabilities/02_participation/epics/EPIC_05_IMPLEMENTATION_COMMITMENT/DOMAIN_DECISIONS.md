# DOMAIN DECISIONS

## Capability 02 — Participation

### Epic 05 — Implementation Commitment

Version: 1.0

Status: Draft

---

# Purpose

This document records the architectural decisions that define the **Implementation Commitment** Aggregate.

These decisions explain why the domain is designed as it is.

They protect architectural consistency throughout the evolution of Capability 02 — Participation.

Changes require Architecture Review.

Terminology must conform to:

- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `PARTICIPATION_ARCHITECTURE_FREEZE.md`

---

# Decision 01

## Support Is Not Commitment

### Decision

Public **Support** (Petition endorsement through Signatures) and **Commitment** (declared preparedness to help implement) are distinct domain concepts.

They must never be used as synonyms.

Recording a Signature does not create an Implementation Commitment.

Declaring a Contribution does not express Petition support.

### Reason

Petition answers whether society supports an approved direction.

Implementation Commitment answers who is prepared to help carry it out.

Conflating support with commitment would:

- treat endorsement as implementation readiness;
- pressure signers into undeclared operational obligation;
- corrupt aggregate statistics across pipeline stages.

The Participation Pipeline preserves distinct civic questions at each stage.

### Consequences

- Petition Signatures remain owned by the Petition Aggregate.
- Contribution Items remain owned by the Implementation Commitment Aggregate.
- Workspace and public copy must use stage-appropriate language.
- Capability matching and readiness derive from commitments — not signature counts.
- Anti-term enforcement: Support ≠ Commitment.

### Status

Accepted

---

# Decision 02

## Implementation Commitment Begins After Petition

### Decision

Implementation Commitment begins only after the Participation Pipeline has progressed through eligible prior stages, including **Petition** in the Version 1 civic path.

Implementation Commitment references approved collective direction and endorsement context.

It does not precede or replace Petition.

### Reason

Implementation Commitment identifies preparedness to help — not whether society supports the direction.

Support must be expressed in its own stage before the platform asks who will help implement.

Beginning commitment before Petition would skip public endorsement accountability and blur decision → support → action sequence.

### Consequences

- Implementation Commitment references `PetitionId` where applicable alongside `CollectiveDecisionId` and `InitiativeId`.
- Eligibility gates reference prior stage outcomes — not automatic aggregate creation.
- Petition lifecycle and commitment lifecycle remain independent.
- Journey presentation shows Petition as a completed or active preceding stage before commitment collection.

### Status

Accepted

---

# Decision 03

## Commitment Measures Capacity, Not Popularity

### Decision

Implementation Commitment measures **declared capacity** — skills, availability, contribution types and resources offered.

It does not measure popularity, visibility, signature volume or engagement metrics.

### Reason

Popularity measures attention.

Capacity measures preparedness.

Using popularity as a proxy for implementation readiness would:

- reward visibility over substance;
- import Petition statistics into the wrong stage;
- encourage engagement optimization incompatible with calm civic participation.

Implementation Commitment exists to understand what the community can realistically contribute.

### Consequences

- Community Capacity derives from Contribution Items — not from Petition Support Count.
- Public projections expose aggregate capacity indicators — not leaderboards or ranking.
- Derived readiness evaluates declared capacity against policy thresholds.
- UI and API must not surface "most popular contributor" or equivalent framing.

### Status

Accepted

---

# Decision 04

## One Active Commitment Per Participant Per Initiative

### Decision

A participant may hold **at most one active commitment declaration** per participant per Implementation Commitment context within Version 1.

Supersession or additional declarations require explicit Frozen Policy rules.

### Reason

Multiple concurrent active declarations for the same initiative context would:

- duplicate capacity in aggregation;
- create ambiguous readiness signals;
- complicate auditability of what the participant actually declared.

One active record preserves clarity while history remains preserved through withdrawal and supersession events where permitted.

### Consequences

- Aggregate invariant IC-002 enforced at command layer.
- Duplicate active declaration attempts are rejected deterministically.
- Contribution Profile groups items under one participant context per commitment aggregate.
- Policy may define explicit revision or supersession flows without silent overwrite.

### Status

Accepted

---

# Decision 05

## Contribution Profile Contains Contribution Items

### Decision

A **Contribution Profile** is the participant-scoped grouping within an Implementation Commitment that contains **Contribution Items**.

Contribution Items are the atomic recorded declarations.

The profile summarizes and references items — it is not a separate aggregate.

### Reason

Participants need a coherent view of what they declared.

The domain needs atomic immutable declarations for aggregation and audit.

Separating profile (grouping/summary) from items (atomic records) preserves both participant orientation and historical precision.

### Consequences

- Contribution Profile is a value object or embedded structure — not an independent aggregate root.
- Contribution Item is the entity recorded by declaration commands.
- Workspace presents profile context while commands operate on items.
- Capability matching evaluates items and profile summaries together.

### Status

Accepted

---

# Decision 06

## Community Capacity Is Derived From Individual Commitments

### Decision

**Community Capacity** is always **derived** from recorded Contribution Items across participants.

It is never manually entered, edited or overridden.

### Reason

Community preparedness must reflect actual declarations — not administrator opinion or imported metrics.

Manual capacity fields would bypass Human Leadership and weaken public trust in readiness claims.

Derivation preserves Historical Integrity and Explicit Publicity from the Participation Architecture Freeze.

### Consequences

- Store and behavior layers recalculate capacity on declaration and withdrawal events.
- API returns derived snapshots — not editable capacity fields.
- Public projection exposes aggregate indicators computed from declarations.
- Aggregate invariant IC-007 enforced.

### Status

Accepted

---

# Decision 07

## Implementation Readiness Is Derived From Community Capacity and Frozen Policy

### Decision

**Implementation Readiness** is computed from:

```
Community Capacity + Frozen Policy → Implementation Readiness
```

Readiness is always derived.

It is never a manually set flag.

### Reason

Readiness expresses whether declared capacity satisfies governed thresholds.

If readiness were editable, the platform could claim implementation preparedness without evidence.

Binding readiness to capacity and frozen policy makes progression explainable and auditable.

### Consequences

- Readiness Thresholds originate from Frozen Policy reference.
- `readinessReached`, scores and explanations are derivation outputs.
- Workspace and public surfaces display readiness as computed state.
- Progression toward Implementation stage consults derived readiness — not manual approval toggles.
- Aggregate invariants IC-008, IC-009, IC-010 enforced.

### Status

Accepted

---

# Decision 08

## Frozen Policy Cannot Be Modified During Commitment

### Decision

**Frozen Policy** referenced by an active Implementation Commitment is **immutable in place**.

Policy change requires governed lifecycle transition — reference update to a new approved or frozen policy generation — not mutation of the referenced frozen rules during active commitment evaluation.

### Reason

Readiness evaluation requires stable rules for the commitment window.

Allowing in-flight policy mutation would:

- retroactively change readiness meaning;
- invalidate prior declarations' evaluative context;
- break auditability of why readiness changed.

Frozen means intentionally stable until governance authorizes change.

### Consequences

- `frozenPolicyId` references immutable policy snapshot or version.
- Commitment commands do not PATCH policy content.
- Policy evolution occurs through Living Policy lifecycle outside active evaluation mutation.
- Aggregate invariant IC-011 enforced.

### Status

Accepted

---

# Decision 09

## Withdrawal Preserves History

### Decision

When a participant **withdraws** a contribution where policy permits withdrawal, the platform changes **Commitment Status** — it does not delete Contribution Items or erase history.

Withdrawn declarations remain auditable.

### Reason

Civic records must remain truthful.

Deleting history would:

- distort past capacity calculations retroactively without trace;
- weaken accountability;
- violate Historical Integrity platform principles.

Withdrawal is an explicit state transition — not erasure.

### Consequences

- Contribution Items are append-preserving; status moves to `Withdrawn` where applicable.
- Derived Community Capacity and Readiness recalculate excluding withdrawn active capacity while preserving record.
- Audit views may show withdrawal timestamp and prior declaration.
- Aggregate invariants IC-005 and IC-006 enforced.

### Status

Accepted

---

# Decision 10

## Commitment Is Not Project Management

### Decision

Implementation Commitment collects **declarations of preparedness** and derives **readiness**.

It does not perform project management, task assignment, scheduling, backlog management or execution tracking.

### Reason

Project management belongs to the **Implementation** stage — a separate aggregate answering "What is being done?"

Absorbing PM into commitment would:

- collapse pipeline stages;
- assign work before explicit implementation governance;
- transform civic declaration into task ownership prematurely.

Commitment prepares who may help.

Implementation coordinates what is done.

### Consequences

- No task entities, assignees, sprints or Gantt semantics in this aggregate.
- Capability Matching aligns need and capacity — it does not create tasks.
- Coordinator role facilitates — does not unilaterally assign implementation work unless future approved policy says otherwise outside this aggregate.
- Anti-terms enforced: Commitment ≠ Task; Commitment ≠ Project Plan.

### Status

Accepted

---

# Decision 11

## Assistant May Suggest, but Never Decide

### Decision

The **Humanity Assistant** may explain, summarize and suggest next steps.

It must never decide, declare commitments, withdraw contributions, approve readiness or mutate aggregate state on behalf of participants.

### Reason

Human Leadership requires that accountable civic acts remain human choices.

An assistant that records commitments or declares readiness would:

- bypass canonical interaction surfaces;
- obscure responsibility;
- violate Participation Architecture Freeze assistant principles.

Assistants reduce complexity — not responsibility.

### Consequences

- All accountable declarations flow through workspace canonical surfaces and operational API commands.
- Assistant copy is read-only guidance aligned with Next Meaningful Action.
- Assistant must be transparent about automation and uncertainty.
- Anti-term enforced: Assistant ≠ Decision Maker.

### Status

Accepted

---

# Decision 12

## Policy Assistant Helps Create Initial Policy but Does Not Define Final Policy

### Decision

The **Policy Assistant** may help draft and explain **Initial** or **Refined** Living Policy for human review.

It does not approve, freeze or enforce final policy.

Final policy authority remains with governed human review and approval processes.

### Reason

Policy governs civic eligibility and readiness thresholds.

Automated final policy definition would:

- remove human governance from rule-making;
- create unreviewed constraints on participation;
- conflate guidance with authority.

The Policy Assistant supports comprehension and drafting — not policy ownership.

### Consequences

- Living Policy progresses Suggested → Initial → Refined → Approved → Frozen → Satisfied through governance — not assistant command.
- Policy Assistant output is provisional until Approved or Frozen.
- Implementation Commitment references only Approved or Frozen policy generations for enforcement.
- Policy Assistant remains distinct from Humanity Assistant scope.

### Status

Accepted

---

# Decision 13

## Living Policy Evolves From Suggested to Satisfied

### Decision

Implementation Policy follows the **Living Policy Lifecycle**:

```
Suggested → Initial → Refined → Approved → Frozen → Satisfied
```

Policy is not binary draft/live.

Each stage has distinct governance meaning.

### Reason

Participation rules require deliberate evolution before becoming binding constraints.

A single undifferentiated "draft" state would obscure when policy is enforceable.

The Satisfied stage preserves historical policy generations while allowing successor policies.

### Consequences

- Only Approved or Frozen policy may govern active commitment enforcement.
- Suggested, Initial and Refined policies are non-binding for readiness evaluation.
- Satisfied policies remain auditable but no longer govern new participation.
- Policy Satisfaction within the aggregate aligns with evaluative outcome — distinct from lifecycle Satisfied stage but semantically related.

### Status

Accepted

---

# Decision 14

## Readiness Is Not Approval

### Decision

**Implementation Readiness** indicates that declared Community Capacity satisfies Frozen Policy thresholds.

It does **not** re-approve the Collective Decision, re-open the ballot or substitute for governance authorization to proceed.

### Reason

Approval belongs to Collective Decision.

Endorsement belongs to Petition.

Readiness belongs to Implementation Commitment.

Conflating readiness with approval would create a shadow decision stage and confuse participants about what was already legitimately decided.

### Consequences

- Readiness language avoids "approved to implement" unless explicitly distinguished from collective approval.
- Workspace copy clarifies readiness as preparedness — not re-authorization.
- Public projection presents readiness in aggregate civic terms — not as a second vote outcome.
- Anti-term enforced: Readiness ≠ Approval.

### Status

Accepted

---

# Decision 15

## Implementation Commitment Ends Before Implementation Execution

### Decision

Implementation Commitment concludes at **readiness and declared capacity collection** for the commitment phase.

**Implementation execution** — coordinating work, tracking progress and measuring completion — belongs to the **Implementation** Aggregate (Stage 7).

Implementation Commitment does not absorb execution lifecycle.

### Reason

Preparedness and execution are different civic questions.

Participants who declare availability are not yet performing implementation tasks under execution governance.

Combining commitment and execution would:

- blur declaration with delivery;
- prematurely assign operational responsibility structures;
- violate One Aggregate — One Responsibility.

### Consequences

- Implementation Commitment lifecycle ends at commitment-phase completion or archival semantics defined in state machine.
- Progression to Implementation workspace requires separate aggregate eligibility — not implicit in commitment declaration alone unless policy connects them explicitly.
- Commitment Outcome or equivalent derived summary describes preparedness achievement — not task completion.
- Aligns with Epic 04 Decision 08 inverse: Petition ends before Commitment; Commitment ends before Implementation.

### Status

Accepted

---

# Decision Summary

| ID | Decision | Status |
|----|----------|--------|
| 01 | Support is not Commitment | Accepted |
| 02 | Implementation Commitment begins after Petition | Accepted |
| 03 | Commitment measures capacity, not popularity | Accepted |
| 04 | One active commitment per participant per initiative | Accepted |
| 05 | Contribution Profile contains Contribution Items | Accepted |
| 06 | Community Capacity is derived from individual commitments | Accepted |
| 07 | Implementation Readiness is derived from Community Capacity and Frozen Policy | Accepted |
| 08 | Frozen Policy cannot be modified during Commitment | Accepted |
| 09 | Withdrawal preserves history | Accepted |
| 10 | Commitment is not project management | Accepted |
| 11 | Assistant may suggest, but never decide | Accepted |
| 12 | Policy Assistant helps create Initial Policy but does not define final Policy | Accepted |
| 13 | Living Policy evolves from Suggested to Satisfied | Accepted |
| 14 | Readiness is not Approval | Accepted |
| 15 | Implementation Commitment ends before Implementation execution | Accepted |

---

# Final Principle

Implementation Commitment architectural decisions exist to preserve the distinction between **support**, **preparedness** and **execution**.

Each decision strengthens aggregate independence, derived truth, human leadership and responsible civic participation across the Humanity Union Participation Pipeline.

Changes to these decisions require Architecture Review.

Implementation must conform.
