# COLLECTIVE DECISION ARCHITECTURE

## Humanity Union Platform

## Capability 02 — Participation

### Collective Decision — Constitutional Foundation

Version 1.0

Status: Architecture Approved

TASK-025 — Architecture only. No implementation authorized by this document.

---

# Purpose

Define the constitutional architecture of **Collective Decision** — the public decision-making stage that follows **Decision Session** in the Capability 02 civic lifecycle.

Collective Decision converts prepared civic understanding into a transparent, participant-owned outcome.

This document defines aggregates, participation rules, transparency guarantees, and reopening behavior.

It does **not** authorize database changes, API routes, UI, vote storage, tally engines, or implementation tracking.

---

# Position in the Civic Lifecycle

Collective Decision begins **only after** a published and closed Decision Session.

```
Initiative
  ↓
Civic Compatibility Review          (advisory)
  ↓
Collaborative Analysis
  ↓
Improvement Proposal
  ↓
Steward Decision
  ↓
Revision
  ↓
Decision Session                    (preparation — no voting)
  ↓
Collective Decision                 (public decision — this architecture)
  ↓
[Future] Implementation Commitment
  ↓
[Future] Implementation Tracking
  ↓
[Future] Public Impact
```

**Invariant CD-001:** No initiative may enter Collective Decision without a qualifying closed Decision Session.

**Invariant CD-002:** Decision Session does not collect votes. Collective Decision is the first stage where participant choices are recorded.

---

# Relationship to Legacy Community Poll

The platform contains a legacy **Community Poll** implementation (`CollectiveDecision` aggregate, Epic 03) with Approve/Reject options and a ballot-centric model.

TASK-025 defines the **constitutional successor architecture** for initiative-based public decisions after Decision Session.

Future implementation must:

- treat this document as the authoritative model for the new pipeline;
- not conflate legacy Community Poll routes with the Decision Session gateway;
- migrate or retire legacy patterns through explicit governance, not silent overlap.

This architecture document does not modify legacy code.

---

# Aggregate Overview

## Collective Decision Aggregate

**Aggregate Root:** `CollectiveDecision`

The aggregate coordinates one public decision cycle for one initiative, anchored to one closed Decision Session.

The aggregate **references** but does **not own**:

- Initiative
- Decision Session
- Decision Package (reference-only snapshot from Decision Session)

The aggregate **owns**:

- Decision lifecycle state
- Participation Scope configuration
- Participant vote records (future implementation)
- Decision Result (derived, immutable after close)
- Decision Statistics (derived, transparent)
- Decision Outcome (interpretive summary, not a hidden calculation)

```
CollectiveDecision
├── Decision                    (lifecycle + question + scope)
├── DecisionSessionReference    (mandatory precursor)
├── ParticipationScope          (World | Country | Region | Community)
├── ParticipantVotes[]          (future — one per participant)
├── DecisionResult              (derived at close)
├── DecisionStatistics          (transparent aggregates)
├── DecisionOutcome             (public interpretation)
└── DecisionTimeline            (opened / closed / cancelled)
```

---

# Entity Definitions

## 1. Decision

The operational public decision instance.

| Field                  | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `decisionId`           | Unique identifier                                        |
| `initiativeId`         | Initiative under decision                                |
| `initiativeVersion`    | Version at open time (from Decision Session package)     |
| `decisionSessionId`    | Mandatory reference to closed Decision Session           |
| `decisionQuestion`     | Copied from Decision Session at open (immutable)         |
| `participationScope`   | Eligibility geography (see Participation Scope)          |
| `status`               | `draft` → `opened` → `closed` \| `cancelled`             |
| `openedAt`             | When voting opens                                        |
| `closesAt`             | Scheduled close                                          |
| `closedAt`             | Actual close timestamp                                   |
| `cancelledAt`          | If cancelled before or during open                       |
| `sequenceNumber`       | Monotonic per initiative (1, 2, 3…) — supports reopening |
| `supersedesDecisionId` | Optional link to prior decision when reopened            |
| `createdAt`            | Record creation                                          |
| `updatedAt`            | Last metadata update                                     |

**Status semantics:**

| Status      | Meaning                                                 |
| ----------- | ------------------------------------------------------- |
| `draft`     | Steward prepares decision; not yet open to participants |
| `opened`    | Eligible registered participants may cast one vote      |
| `closed`    | Voting ended; result finalized                          |
| `cancelled` | Decision aborted; no outcome produced                   |

---

## 2. Decision Session Reference

Mandatory precursor. Read-only link to a **closed** Decision Session.

| Field               | Description                                         |
| ------------------- | --------------------------------------------------- |
| `sessionId`         | Decision Session identifier                         |
| `initiativeVersion` | Version captured at session publish                 |
| `decisionQuestion`  | Public question from session                        |
| `packageReferences` | Reference IDs only (revisions, analyses, proposals) |
| `closedAt`          | Session close timestamp                             |

**Eligibility to open Collective Decision:**

- Decision Session status = `closed`
- Session belongs to same initiative
- Session `decisionQuestion` is non-empty
- Initiative lifecycle permits public decision (projected or equivalent)

The aggregate validates these at open time. No vote collection occurs during Decision Session.

---

## 3. Participation Scope

Defines **who may participate** based on geographic alignment between initiative and participant **Participation Area**.

| Scope       | Description          | Initiative constraint                               |
| ----------- | -------------------- | --------------------------------------------------- |
| `world`     | Global participation | Initiative marked global; no geographic restriction |
| `country`   | Country-level        | Initiative community/country alignment              |
| `region`    | Region-level         | Initiative region alignment                         |
| `community` | Community-level      | Initiative community slug alignment                 |

Participation Scope is set when the Decision opens. It is derived from initiative metadata and steward configuration within constitutional bounds.

**Invariant CD-003:** Eligibility is determined by declared Participation Area, never by IP address, VPN, or inferred geolocation.

---

## 4. Participant Vote (Future Implementation)

One registered participant → one vote. Not implemented in TASK-025.

| Field                     | Description                                                             |
| ------------------------- | ----------------------------------------------------------------------- |
| `voteId`                  | Unique vote record                                                      |
| `decisionId`              | Parent decision                                                         |
| `participantId`           | Voter (registered member)                                               |
| `choice`                  | `support` \| `do_not_support` \| `abstain`                              |
| `verificationLevelAtVote` | Snapshot at cast time                                                   |
| `participationAreaAtVote` | Snapshot at cast time                                                   |
| `castAt`                  | Timestamp                                                               |
| `status`                  | `active` \| `superseded` (only if explicit revision policy added later) |

**Invariant CD-004:** Each eligible participant may have at most one active vote per Decision.

**Invariant CD-005:** Vote values are never weighted. Support = 1, Do Not Support = 1, Abstain = 1 for counting purposes only.

---

## 5. Decision Result

Derived state computed when Decision closes. Immutable after finalization.

| Field                     | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| `resultId`                | Unique identifier                                                     |
| `decisionId`              | Parent decision                                                       |
| `status`                  | `opened` \| `closed` \| `cancelled` (mirrors decision terminal state) |
| `calculatedAt`            | Finalization timestamp                                                |
| `totalParticipation`      | Count of votes cast                                                   |
| `supportCount`            | Support votes                                                         |
| `doNotSupportCount`       | Do Not Support votes                                                  |
| `abstainCount`            | Abstain votes                                                         |
| `verifiedStatistics`      | Counts split by verified participants                                 |
| `unverifiedStatistics`    | Counts split by unverified participants                               |
| `participationRate`       | Votes / eligible population                                           |
| `participationConfidence` | Transparency metric (see Transparency Model)                          |
| `outcomeSummary`          | Plain-language result description                                     |

**Outcome determination:**

The outcome is computed by **simple plurality of Support vs Do Not Support** among all cast votes (Abstain recorded separately, not counted as support or opposition unless future policy explicitly defines abstention semantics in governance).

**Invariant CD-006:** The outcome is never recalculated using verification weights, reputation scores, or AI inference.

---

## 6. Decision Statistics

Live and final transparent aggregates displayed during and after the decision.

| Field                         | Description                                |
| ----------------------------- | ------------------------------------------ |
| `eligibleParticipantCount`    | Participants matching scope + registration |
| `registeredEligibleCount`     | Registered members in scope                |
| `totalVotesCast`              | All votes                                  |
| `verifiedVotesCast`           | Votes from verified participants           |
| `unverifiedVotesCast`         | Votes from unverified participants         |
| `supportCount`                | Total support                              |
| `doNotSupportCount`           | Total do not support                       |
| `abstainCount`                | Total abstain                              |
| `verifiedSupportCount`        | Support from verified                      |
| `verifiedDoNotSupportCount`   | Do not support from verified               |
| `verifiedAbstainCount`        | Abstain from verified                      |
| `unverifiedSupportCount`      | Support from unverified                    |
| `unverifiedDoNotSupportCount` | Do not support from unverified             |
| `unverifiedAbstainCount`      | Abstain from unverified                    |
| `participationRate`           | Participation / eligible                   |
| `participationConfidence`     | Transparency indicator                     |

Statistics describe participation. They are displayed separately for verified and unverified cohorts. They do **not** alter the outcome.

---

## 7. Decision Outcome

The public interpretation of a closed Decision Result.

| Field               | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `outcomeId`         | Unique identifier                                               |
| `decisionId`        | Parent decision                                                 |
| `outcomeType`       | `supported` \| `not_supported` \| `inconclusive` \| `cancelled` |
| `summary`           | Public explanation                                              |
| `nextStageGuidance` | Optional pointer to Implementation Commitment (future)          |
| `recordedAt`        | Timestamp                                                       |

Outcome is derived from Decision Result by deterministic rules documented in governance. No AI involvement.

---

# Participation Model

## Registered Participation Requirement

Only **registered participants** (active members) may vote.

Anonymous observers may read public projections. They cannot cast votes.

## One Participant, One Vote

Each eligible participant casts exactly one choice:

| Choice           | Meaning                                               |
| ---------------- | ----------------------------------------------------- |
| `support`        | Participant supports the decision question as framed  |
| `do_not_support` | Participant does not support                          |
| `abstain`        | Participant declines to express support or opposition |

No weighted voting. No delegation in Version 1 architecture.

---

# Participation Area Model

## Participant Participation Area

Each registered participant declares a Participation Area in profile or registration:

```
Country
  ↓
Region
  ↓
Community
```

Represented as:

| Field           | Description                      |
| --------------- | -------------------------------- |
| `countrySlug`   | Selected country                 |
| `regionSlug`    | Selected region within country   |
| `communitySlug` | Selected community within region |

**Invariant CD-007:** VPN, IP address, and network geolocation have no effect on eligibility.

## Eligibility Evaluation

At vote time, the system evaluates:

1. Participant is registered and active
2. Decision status is `opened`
3. Current time is within `[openedAt, closesAt]`
4. Participant has not already voted
5. Participation Area matches Participation Scope rules

### Eligible

| Condition              | Result                                                       |
| ---------------------- | ------------------------------------------------------------ |
| Scope = `world`        | Any registered participant globally                          |
| Scope = `country`      | Participant `countrySlug` matches initiative country         |
| Scope = `region`       | Participant `countrySlug` + `regionSlug` match               |
| Scope = `community`    | Participant full area matches initiative community           |
| Global initiative flag | Scope automatically `world` regardless of community metadata |

### Not Eligible

| Condition                              | Result                                  |
| -------------------------------------- | --------------------------------------- |
| Unregistered visitor                   | Cannot vote; may read public projection |
| Suspended/archived member              | Cannot vote                             |
| Decision not `opened`                  | Cannot vote                             |
| Already voted                          | Cannot vote again                       |
| Participation Area mismatch            | Cannot vote                             |
| Pending area transition not yet active | Uses **current active** area only       |

### Future Participation Area Transition

Architecture supports delayed activation when a participant changes Participation Area:

| Field                  | Description                                  |
| ---------------------- | -------------------------------------------- |
| `pendingCountrySlug`   | Requested country                            |
| `pendingRegionSlug`    | Requested region                             |
| `pendingCommunitySlug` | Requested community                          |
| `requestedAt`          | Change request time                          |
| `effectiveAt`          | When new area becomes active (future policy) |

**Invariant CD-008:** Until `effectiveAt`, eligibility uses the prior active Participation Area. Decisions opened during transition period apply current active area only.

Implementation of transition delay is deferred. Architecture must not assume instant area switching for eligibility.

---

# Transparency Model

Humanity Union displays voting results with full transparency and **without outcome manipulation**.

## Public Display Requirements

The public projection must show:

| Display element                    | Description                                      |
| ---------------------------------- | ------------------------------------------------ |
| Total votes                        | All cast votes                                   |
| Verified votes                     | Subset from verified participants                |
| Unverified votes                   | Subset from unverified participants              |
| Support / Do Not Support / Abstain | Each total and split by verification cohort      |
| Participation rate                 | Votes / eligible population                      |
| Participation confidence           | Indicator of how representative participation is |

## Participation Confidence

A transparency metric describing how strongly the recorded participation reflects the eligible population.

Examples of inputs (policy-defined at implementation):

- participation rate;
- verified share of votes;
- eligible population size;
- decision duration.

**Invariant CD-009:** Participation confidence is informational. It never changes vote counts or outcomes.

## Verified vs Unverified Display

Verified and unverified statistics are displayed **separately** alongside totals.

Participants and society can see:

- what verified members decided;
- what unverified members decided;
- the combined outcome (unweighted).

**Invariant CD-010:** The public outcome is always computed from unweighted totals. Verified/unverified splits are transparency overlays, not alternate outcomes.

---

# Reopening Model

Collective Decision is **revisitable**. Significant initiative changes may require a new public decision.

## Reopening Flow

```
Closed Decision (historical, immutable)
        ↓
Significant initiative change
        ↓
New Decision Session (draft → published → closed)
        ↓
New Collective Decision (sequenceNumber + 1)
```

## Rules

| Rule  | Description                                                                         |
| ----- | ----------------------------------------------------------------------------------- |
| R-001 | Historical decisions are never overwritten                                          |
| R-002 | Each new decision references a new closed Decision Session                          |
| R-003 | `sequenceNumber` increments monotonically per initiative                            |
| R-004 | `supersedesDecisionId` links new decision to prior for audit trail                  |
| R-005 | Prior Decision Results remain publicly readable                                     |
| R-006 | Reopening requires governance-defined "significant change" criteria (future policy) |

## What Constitutes Significant Change (Deferred Policy)

Architecture reserves evaluation against:

- new published initiative version;
- material revision summary change;
- steward-initiated reopening request;
- civic compatibility status change to manual review.

Exact policy is deferred. Architecture only requires the **Decision Session gateway** for each new decision cycle.

---

# Constitutional Guarantees

Humanity Union **never**:

| Prohibition                      | Guarantee                                       |
| -------------------------------- | ----------------------------------------------- |
| Weighted voting                  | Every vote counts equally (1)                   |
| Vote value manipulation          | Support/Do Not Support/Abstain values are fixed |
| AI-determined outcomes           | Outcomes are deterministic from vote counts     |
| Reputation-based outcomes        | Member reputation does not alter results        |
| IP-based eligibility             | Participation Area only                         |
| VPN discrimination               | No network-based exclusion                      |
| Skipping Decision Session        | CD-001 enforced                                 |
| Hiding verified/unverified split | Transparency model requires both                |
| Silent decision overwrite        | Reopening creates new records (R-001)           |

Humanity Union **always**:

| Guarantee                | Description                                    |
| ------------------------ | ---------------------------------------------- |
| Transparent totals       | Public can audit counts                        |
| Registered participation | One member, one vote                           |
| Historical integrity     | Past decisions preserved                       |
| Informed preparation     | Decision Session package available before open |
| Human accountability     | Stewards open/close; platform records          |

---

# Future Integration Points

Architecture defines interfaces for downstream stages. Not implemented in TASK-025.

## Implementation Commitment

When Decision Outcome is `supported`:

- Implementation Commitment may be initiated by steward or governance process;
- Commitment references `decisionId`, `decisionSessionId`, and `initiativeVersion`;
- Commitment does not retroactively alter Decision Result.

## Implementation Tracking

Tracks execution progress against committed implementation.

References:

- `decisionId` (what was decided)
- `implementationCommitmentId` (what was promised)

## Public Impact

Reports societal outcomes after implementation.

References:

- Decision → Commitment → Implementation chain
- Public impact projections remain separate from vote tallies

---

# Domain Invariants Summary

| ID     | Invariant                                             |
| ------ | ----------------------------------------------------- |
| CD-001 | Decision Session mandatory before Collective Decision |
| CD-002 | Decision Session does not collect votes               |
| CD-003 | Eligibility by Participation Area, not IP             |
| CD-004 | One active vote per participant per decision          |
| CD-005 | Unweighted vote values                                |
| CD-006 | Outcome never recalculated with weights or AI         |
| CD-007 | VPN has no eligibility effect                         |
| CD-008 | Area transitions use delayed activation (future)      |
| CD-009 | Participation confidence is informational only        |
| CD-010 | Verified/unverified splits are transparent overlays   |

---

# Implementation Boundaries (Explicitly Out of Scope)

The following are **not authorized** by this architecture document:

- Database schemas or migrations
- API routes or services
- Vote storage adapters
- Tally computation engines
- Workspace UI
- Public Experience page changes
- Implementation Commitment implementation
- AI-assisted vote analysis
- Moderation or censorship hooks tied to vote outcomes

Implementation epics require separate governance approval after this architecture baseline.

---

# Engineering Principles

This architecture follows:

- **Decision Session gateway** — preparation before decision
- **Transparent participation** — verified/unverified visibility without weighting
- **Participation Area sovereignty** — participant-declared geography
- **Historical integrity** — no overwrite on reopen
- **Constitutional non-manipulation** — outcomes from counts only
- **Progressive implementation** — architecture before code
- **Separation from legacy** — Epic 03 Community Poll is not this model

---

# Document Status

| Attribute      | Value                 |
| -------------- | --------------------- |
| Task           | TASK-025              |
| Version        | 1.0                   |
| Status         | Architecture Approved |
| Implementation | Not authorized        |
| Code changes   | None                  |
