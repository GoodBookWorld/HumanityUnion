# IMPLEMENTATION_GUIDE_05_PUBLIC_DECISION_PROJECTION

## Capability 02 — Participation

### Epic 03 — Community Poll

Guide 05 of 7

Version 2.0

Status: Ready

---

# Purpose

Implement the Public Decision Projection.

The Public Projection provides a transparent, read-only representation of a completed Collective Decision.

It communicates the outcome of the decision without exposing operational or participant-specific information.

Community Poll is the Version 1 Decision Template.

---

# Scope

This guide includes:

- Public Decision Projection;
- Projection Builder;
- Public REST endpoint;
- Public web page.

This guide does not include:

- Workspace;
- Decision Panel;
- Ballot interaction;
- participant identities;
- administration.

---

# Files to Create

## Types

```
packages/types/src/domain/public-collective-decision.ts
```

---

## API

```
apps/api/src/modules/collective-decision/public-collective-decision.projection.ts

apps/api/src/modules/collective-decision/public-collective-decision.routes.ts
```

---

## Web

```
apps/web/src/app/collective-decisions/public/[decisionId]/page.tsx

apps/web/src/app/collective-decisions/public/public-collective-decision-page.css
```

---

## Exports

Update:

```
packages/types/src/domain/index.ts

apps/api/src/modules/collective-decision/index.ts

apps/api/src/app.ts
```

Register:

```
GET /api/v1/public/collective-decisions/:decisionId
```

---

# Public Projection

Implement:

```
PublicCollectiveDecisionProjection
```

Expose only:

- decisionId
- decisionSubject
- decisionTemplate
- status
- DecisionResult
- Outcome
- ParticipationStatistics
- completedAt

No internal data.

---

# Projection Builder

Implement:

```
toPublicCollectiveDecisionProjection()
```

Responsibilities:

- map Aggregate to Projection;
- remove operational fields;
- expose only approved public information.

---

# Public Page

Display:

- Decision Summary;
- Decision Subject;
- Final Result;
- Participation Statistics;
- Outcome;
- Next Lifecycle Stage.

Read-only.

---

# Excluded Information

Never expose:

- participant identities;
- Participant Decisions;
- Ballot internals;
- Decision Rules;
- Eligibility Rules;
- internal calculations;
- audit data;
- diagnostics;
- platform metadata.

---

# Public View Principle

The Public Projection answers:

"What did the community decide?"

It does not answer:

"How did individual participants decide?"

Operational information belongs exclusively to the Decision Workspace.

---

# Operational View vs Public View

Operational View

Purpose:

Support participation.

Includes:

- Ballot;
- Decision Panel;
- Analysis Summary;
- participant interaction.

---

Public View

Purpose:

Provide transparency.

Includes:

- Decision Summary;
- Decision Result;
- Participation Statistics;
- Outcome.

No interaction.

---

# Engineering Principles

Preserve:

- Explicit Publicity;
- Operational View Separation;
- Human Leadership;
- Thin API;
- Progressive Bootstrap.

---

# Verification

Confirm:

- public endpoint responds;
- projection excludes operational data;
- public page renders;
- only approved information is exposed.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Completion Criteria

Guide 05 is complete when:

- projection compiles;
- public endpoint works;
- public page renders;
- operational information remains private;
- typecheck passes.

Guide 06 must not be started.
