# DOMAIN_MODEL

## Capability 02 — Participation

### Epic 03 — Community Poll

## Collective Decision Domain Model

Version 2.0

Status: Approved

---

# Purpose

Define the domain model for the Collective Decision Framework.

Community Poll is the first implementation of this model.

The model is designed to support future decision mechanisms without architectural redesign.

---

# Aggregate Root

## CollectiveDecision

CollectiveDecision is the Aggregate Root.

It coordinates a structured community decision process.

It references a Decision Subject but does not own it.

---

# Identity

CollectiveDecision contains:

- decisionId
- decisionSubjectType
- decisionSubjectId
- decisionMechanism
- status
- createdAt
- updatedAt

Version 1:

decisionSubjectType = Initiative

decisionMechanism = CommunityPoll

---

# Decision Subject

A Decision Subject is the object being decided upon.

Version 1 supports:

- Initiative

Future subject types may include:

- Candidate
- Policy
- Project
- Organization
- Institution
- Program

The Decision Subject remains outside the CollectiveDecision Aggregate.

---

# Decision Mechanism

Decision Mechanism defines how participant decisions are collected.

Version 1 supports:

- CommunityPoll

Future mechanisms may include:

- CandidateSelection
- OptionSelection
- PrioritySelection
- TrustEvaluation
- GovernanceDecision

Mechanism does not redefine the Aggregate.

---

# Child Entities

## Ballot

Ballot defines the structured decision form.

Fields:

- ballotId
- question
- options
- decisionRules
- eligibilityRules
- opensAt
- closesAt

Ballot defines what can be decided.

Ballot does not store final results.

---

## DecisionOption

A selectable option within a Ballot.

Fields:

- optionId
- label
- description
- value
- order

Version 1 options:

- Approve
- Reject

---

## ParticipantDecision

The official decision submitted by a participant.

Fields:

- participantDecisionId
- participantId
- ballotId
- selectedOptionIds
- submittedAt
- status

ParticipantDecision replaces Vote as the domain term.

Each eligible participant may have only one active ParticipantDecision per Ballot.

---

## DecisionResult

The calculated result after the decision closes.

Fields:

- resultId
- calculatedAt
- optionResults
- winningOptionId
- participationRate
- quorumSatisfied
- thresholdSatisfied

DecisionResult is derived from ParticipantDecisions and Ballot rules.

---

## Outcome

The official consequence of a DecisionResult.

Fields:

- outcomeId
- outcomeType
- createdAt
- nextLifecycleStage
- explanation

Examples:

- Approved
- Rejected
- Selected
- Prioritized

Outcome determines what happens next.

---

# Value Objects

## EligibilityRules

Defines who may participate.

May include:

- membershipRequired
- verificationLevelRequired
- regionRequired
- organizationRequired
- minimumAccountAge
- customEligibilityPolicy

Eligibility controls participation access.

Eligibility never controls participant choice.

---

## DecisionRules

Defines how results are calculated.

May include:

- quorumRequired
- minimumParticipationRate
- approvalThreshold
- winningMethod
- tiePolicy
- abstentionPolicy

DecisionRules calculate results.

They do not decide for participants.

---

## DecisionStatistics

Aggregated participation information.

Contains:

- eligibleParticipantCount
- submittedDecisionCount
- participationRate
- completionRate
- abstentionCount

Statistics describe participation.

They do not determine legitimacy unless referenced by DecisionRules.

---

## DecisionTimeline

Defines scheduled lifecycle dates.

Contains:

- createdAt
- scheduledAt
- opensAt
- closesAt
- completedAt
- archivedAt

---

# Statuses

CollectiveDecision status values:

- Draft
- Scheduled
- Active
- Closed
- Completed
- Archived

---

# Domain Invariants

CollectiveDecision guarantees:

- one Decision Subject reference;
- one Decision Mechanism;
- one active ParticipantDecision per participant per Ballot;
- ParticipantDecisions cannot be modified after submission unless revision policy is explicitly enabled;
- DecisionResult is derived from ParticipantDecisions and DecisionRules;
- Outcome is derived from DecisionResult;
- Decision Subject is never owned by CollectiveDecision.

---

# Version 1 Scope

Version 1 implements:

- Initiative as Decision Subject;
- CommunityPoll as Decision Mechanism;
- Approve / Reject options;
- one Ballot per CollectiveDecision;
- one active ParticipantDecision per participant;
- simple result calculation;
- transparent public results.

---

# Deferred

Future versions may support:

- candidate selection;
- ranked decisions;
- trust evaluation;
- multiple ballots;
- vote revision policy;
- delegated voting;
- weighted voting;
- complex governance mechanisms.

These extensions must preserve the CollectiveDecision Aggregate.

---

# Relationship to Collaborative Analysis

CollectiveDecision requires a completed Collaborative Analysis for Initiative-based decisions.

The participant should have access to:

- Initiative Overview
- Analysis Summary
- Readiness
- Progress Policy

before submitting a ParticipantDecision.

---

# Relationship to Petition

If Outcome is Approved, the Initiative may advance to Petition.

Petition belongs to a future Epic.

CollectiveDecision only produces the Outcome.

---

# Relationship to Collective Intelligence

CollectiveDecision may consume:

- Analysis Summary
- Readiness
- public decision context

It does not own:

- Community Memory
- Humanity Intelligence Layer
- Intelligence Services

---

# Engineering Principles

This model follows:

- Domain First
- Independent Aggregate
- Mechanism Independence
- Informed Decision
- Human Leadership
- Derived State
- Explicit Publicity
- Progressive Bootstrap
- Historical Integrity


---

# Execution Model

The CollectiveDecision Aggregate is executed by a reusable Decision Engine.

Version 1 uses the Community Poll decision template.

Future decision templates configure the engine rather than replace the Aggregate.

The Aggregate defines the business domain.

The engine executes the domain.

Templates configure participant interaction.
---

# Final Principle

CollectiveDecision is the domain.

CommunityPoll is the first mechanism.

The architecture must remain reusable for future forms of collective decision-making.
