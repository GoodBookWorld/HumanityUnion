# IMPLEMENTATION_GUIDE_06_PLATFORM_INTEGRATION

## Capability 02 — Participation

### Epic 03 — Community Poll

Guide 06 of 7

Version 2.0

Status: Ready

---

# Purpose

Integrate the Collective Decision Framework into the Humanity Union platform architecture.

This guide verifies that CollectiveDecision correctly interacts with other platform domains while preserving aggregate independence and architectural consistency.

No new business functionality is introduced.

---

# Scope

This guide includes:

- Initiative integration;
- Collaborative Analysis integration;
- platform routing;
- navigation;
- public projection integration;
- architecture verification.

This guide does not include:

- authentication;
- authorization;
- moderation;
- persistence;
- Intelligence Services.

---

# Integration Flow

Version 1

```
Initiative

↓

Collaborative Analysis

↓

Collective Decision

↓

Petition
```

Each Aggregate remains independent.

---

# Initiative Integration

Verify:

Every CollectiveDecision references exactly one Initiative.

The Initiative lifecycle remains independent.

The CollectiveDecision Aggregate never owns the Initiative.

---

# Collaborative Analysis Integration

Verify:

CollectiveDecision consumes:

- Analysis Summary;
- Readiness;
- Progress Policy.

CollaborativeAnalysis remains responsible for understanding.

CollectiveDecision remains responsible for deciding.

---

# Petition Integration

Verify:

Outcome

↓

Petition

CollectiveDecision never creates a Petition.

It only determines whether the Decision Subject is eligible to proceed.

---

# Navigation

Verify user navigation.

Operational flow

```
Initiative Workspace

↓

Collaborative Analysis Workspace

↓

Collective Decision Workspace
```

Public flow

```
Public Initiative

↓

Public Collaborative Analysis

↓

Public Collective Decision
```

Navigation must be consistent across the platform.

---

# Aggregate Independence

Confirm:

Initiative owns:

- proposal;
- metadata;
- lifecycle.

CollaborativeAnalysis owns:

- Contributions;
- Signals;
- Readiness.

CollectiveDecision owns:

- Ballot;
- Participant Decisions;
- DecisionResult;
- Outcome.

Petition owns:

- public support.

No Aggregate duplicates responsibilities.

---

# Platform Routing

Verify:

Operational

```
/initiatives/:initiativeId

/collaborative-analysis/:analysisId

/collective-decisions/:decisionId
```

Public

```
/initiatives/public/:initiativeId

/collaborative-analysis/public/:analysisId

/collective-decisions/public/:decisionId
```

Routing follows a consistent platform convention.

---

# Public Projection Integration

Verify:

```
Public Initiative

↓

Public Collaborative Analysis

↓

Public Collective Decision
```

Each projection represents only its own Aggregate.

---

# Decision Engine Integration

Verify:

Community Poll is configured as the Version 1 Decision Template.

The Decision Engine remains reusable.

Future Decision Templates require configuration rather than architectural redesign.

---

# Foundation Alignment

Confirm compliance with:

- Engineering Foundation;
- Collective Intelligence Foundation;
- Intelligence Service Contract.

CollectiveDecision consumes platform capabilities without owning them.

---

# Engineering Principles

Verify preservation of:

- Domain First;
- Human Leadership;
- Mechanism Independence;
- Thin API;
- Explicit Publicity;
- Historical Integrity;
- Progressive Bootstrap;
- Operational View vs Public View.

---

# Verification

Run:

```
pnpm typecheck
```

Expected:

PASS

Run the application.

Verify:

- Initiative Workspace;
- Collaborative Analysis Workspace;
- Collective Decision Workspace;
- Public Initiative;
- Public Collaborative Analysis;
- Public Collective Decision.

Expected:

HTTP 200

Navigation succeeds.

---

# Success Criteria

CollectiveDecision is fully integrated when:

- Aggregate boundaries remain intact;
- navigation works;
- public projections work;
- platform routing is consistent;
- Decision Engine remains reusable;
- engineering principles are preserved.

---

# Completion Criteria

Guide 06 is complete when:

- platform integration passes;
- routing is verified;
- navigation succeeds;
- architecture remains consistent;
- typecheck passes.

Guide 07 must not be started.
