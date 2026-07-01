# IMPLEMENTATION_GUIDE_01_COLLABORATIVE_ANALYSIS_DOMAIN

## Capability 02 — Participation

### Epic 02 — Collaborative Analysis

Guide 01 of 7

Version 1.0

Status: Ready

---

# Purpose

Implement the domain layer for Collaborative Analysis.

This guide establishes the shared domain types used throughout the Epic.

No persistence, API, UI, authentication, or business workflows are implemented.

---

# Scope

This guide includes:

- domain types;
- aggregate definition;
- child entity types;
- value object types;
- domain exports.

This guide does not include:

- stores;
- API routes;
- React components;
- persistence;
- business rules.

---

# Files to Create

## Domain

```
packages/types/src/domain/collaborative-analysis.ts
packages/types/src/domain/contribution.ts
packages/types/src/domain/signal.ts
packages/types/src/domain/progress-policy.ts
packages/types/src/domain/readiness.ts
packages/types/src/domain/analysis-summary.ts
packages/types/src/domain/analysis-metrics.ts
```

---

## Export

Modify:

```
packages/types/src/domain/index.ts
```

Export all newly created domain types.

---

# Aggregate

## CollaborativeAnalysis

Define the Aggregate Root.

Include:

- analysisId
- initiativeId
- status
- createdAt
- updatedAt

Collections:

- contributions
- signals
- summaries

Objects:

- progressPolicy
- readiness
- metrics

No methods.

No behavior.

---

# Contribution

Define the Contribution entity.

Fields:

- contributionId
- authorId
- contributionType
- title
- content
- relatedContributionId
- metadata
- createdAt

Contribution is immutable after publication.

This guide defines the structure only.

---

# ContributionType

Create a strongly typed union.

Initial values:

- Evidence
- Question
- Alternative
- Clarification
- Reference
- ExpertOpinion
- SummaryProposal
- Correction

---

# Signal

Define Signal.

Fields:

- signalId
- memberId
- signalType
- targetType
- targetId
- createdAt

No validation logic.

---

# SignalType

Create a strongly typed union.

Initial values:

- NeedsClarification
- StrongEvidence
- WeakEvidence
- Duplicate
- NeedsExpertReview
- RegionalImpact
- HighPriority
- ReadyForPoll

---

# ProgressPolicy

Define:

- minimumContributions
- requiredSignalTypes
- minimumSignals
- minimumParticipantCount
- supportThreshold
- expertReviewRequired
- regionalReviewRequired

Type definitions only.

---

# Readiness

Define:

- readinessScore
- satisfiedRequirements
- missingRequirements
- blockingIssues

No calculations.

---

# AnalysisSummary

Define:

- summaryId
- createdAt
- createdBy
- summaryText
- referencedContributionIds
- status

No generation logic.

---

# AnalysisMetrics

Define:

- contributionCount
- signalCount
- participantCount
- evidenceCount
- expertContributionCount
- clarificationCount

No calculations.

---

# Design Rules

The implementation must follow:

- Domain First
- Domain Ownership
- Progressive Bootstrap
- Historical Integrity
- Human Leadership

No implementation logic.

Only domain structure.

---

# Verification

Confirm:

- all domain files compile;
- exports resolve correctly;
- no circular dependencies;
- no business logic introduced.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Completion Criteria

Guide 01 is complete when:

- all domain types exist;
- aggregate structure matches DOMAIN_MODEL;
- exports are available via `@hu/types`;
- typecheck passes.

No additional functionality should be implemented.

Guide 02 must not be started.
