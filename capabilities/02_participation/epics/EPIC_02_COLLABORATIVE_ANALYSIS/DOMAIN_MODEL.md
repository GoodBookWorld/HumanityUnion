# DOMAIN_MODEL

## Capability 02 — Participation

### Epic 02 — Collaborative Analysis

Version 1.0

---

# Purpose

Define the domain model for Collaborative Analysis.

This model describes how an Initiative is improved through structured Contributions, Signals, Progress Policy, Readiness and Analysis Summary.

No persistence, API, UI or implementation details are described here.

---

# Aggregate Root

## CollaborativeAnalysis

CollaborativeAnalysis is the Aggregate Root of Epic 02.

It belongs to exactly one Initiative.

It manages the structured analytical process that prepares an Initiative for Poll.

---

# Identity

CollaborativeAnalysis contains:

- analysisId
- initiativeId
- createdAt
- updatedAt
- status

The `initiativeId` links the analysis to the Initiative.

CollaborativeAnalysis does not own the Initiative.

---

# Child Entities

## Contribution

A structured analytical input submitted by a participant.

Contribution is the primary unit of participation.

Fields:

- contributionId
- authorId
- contributionType
- title
- content
- createdAt
- relatedContributionId
- metadata

Contribution is immutable after publication.

Corrections are represented as new Contributions.

---

## Signal

A lightweight structured analytical reaction.

Fields:

- signalId
- memberId
- signalType
- targetType
- targetId
- createdAt

Signals complement Contributions.

Signals do not replace reasoning.

---

## AnalysisSummary

A structured summary of the current analytical state.

Fields:

- summaryId
- createdAt
- createdBy
- summaryText
- referencedContributionIds
- status

AnalysisSummary may evolve through new versions.

Previous summaries remain part of analytical history.

---

# Value Objects

## ProgressPolicy

Defines requirements for moving from Collaborative Analysis to Ready for Poll.

May include:

- minimumContributions
- requiredSignalTypes
- minimumSignals
- minimumParticipantCount
- supportThreshold
- expertReviewRequired
- regionalReviewRequired

ProgressPolicy belongs to the Initiative context.

---

## Readiness

Represents current maturity toward the next lifecycle stage.

Contains:

- readinessScore
- satisfiedRequirements
- missingRequirements
- blockingIssues

Readiness is transparent.

---

## AnalysisMetrics

Describes analytical activity.

Contains:

- contributionCount
- signalCount
- participantCount
- evidenceCount
- expertContributionCount
- clarificationCount

Metrics describe analysis.

Metrics do not make decisions.

---

# Contribution Types

Approved Contribution types:

- Evidence
- Question
- Alternative
- Clarification
- Reference
- ExpertOpinion
- SummaryProposal
- Correction

Future Contribution types require architectural review.

---

# Signal Types

Signal taxonomy is defined separately.

Signals may include:

- NeedsClarification
- StrongEvidence
- WeakEvidence
- Duplicate
- NeedsExpertReview
- RegionalImpact
- HighPriority
- ReadyForPoll

---

# Aggregate Rules

CollaborativeAnalysis guarantees:

- Contributions are immutable after publication;
- Corrections are additive;
- Signals reference valid targets;
- Readiness is derived from ProgressPolicy and current analysis state;
- Metrics describe activity but do not determine decisions;
- Analysis history is preserved.

---

# Domain Invariants

## Immutable Contributions

Published Contributions are never edited.

If a Contribution requires correction, a new Correction Contribution is created.

---

## Additive Analysis

Collaborative Analysis evolves by adding Contributions, Signals, Summaries and Corrections.

Analytical history is extended, never rewritten.

---

## Human Decision Boundary

Collaborative Analysis never approves or rejects an Initiative.

It only determines readiness for Poll according to ProgressPolicy.

Formal decision-making belongs to Poll.

---

# Lifecycle

CollaborativeAnalysis lifecycle:

Not Started

↓

Active

↓

Ready for Poll

↓

Closed

Future extensions may include:

- Paused
- Reopened
- Superseded

---

# Relationships

CollaborativeAnalysis references:

- Initiative
- Member
- Community Memory
- Intelligence Services

CollaborativeAnalysis owns:

- Contributions
- Signals
- Analysis Summaries
- Readiness
- Metrics

CollaborativeAnalysis does not own:

- Initiative
- Member
- Community Memory
- Humanity Intelligence Layer

---

# Relationship to Collective Intelligence

CollaborativeAnalysis may consume:

- Community Memory
- Intelligence Services
- Related Knowledge
- Readiness Assistance

It does not own platform intelligence services.

---

# Bootstrap Scope

Initial implementation should include:

- CollaborativeAnalysis aggregate
- Contributions
- Signals
- ProgressPolicy
- Readiness
- AnalysisMetrics

Deferred:

- automatic Insight generation
- advanced Knowledge Integration
- Learning Engine
- automated summarization
- expert routing
- moderation workflow

---

# Engineering Principles

This model follows:

- Domain First
- Domain Ownership
- Progressive Bootstrap
- Historical Integrity
- Immutable Contributions
- Additive Analysis
- Human Leadership
- Explicit Publicity
- Collective Intelligence Foundation

---

# Final Principle

Collaborative Analysis preserves the history of how an Initiative becomes better.
