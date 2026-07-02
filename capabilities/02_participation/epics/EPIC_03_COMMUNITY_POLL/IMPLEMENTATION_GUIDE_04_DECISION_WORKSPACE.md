# IMPLEMENTATION_GUIDE_04_DECISION_WORKSPACE

## Capability 02 — Participation

### Epic 03 — Community Poll

Guide 04 of 7

Version 2.0

Status: Ready

---

# Purpose

Implement the Collective Decision Workspace.

The workspace provides a structured environment for understanding, participating in and reviewing collective decisions.

Community Poll is implemented as the Version 1 Decision Template.

---

# Scope

This guide includes:

- Decision Workspace;
- Decision Overview;
- Decision Subject;
- Analysis Summary;
- Ballot;
- Decision Panel;
- Participation Statistics;
- Decision Result;
- Outcome;
- Actions.

This guide does not include:

- editing Decision Rules;
- administration;
- notifications;
- authentication;
- advanced templates.

---

# Files to Create

## Page

```
apps/web/src/app/collective-decisions/[decisionId]/page.tsx

apps/web/src/app/collective-decisions/collective-decision-page.css
```

---

## Feature

```
apps/web/src/features/collective-decision/api.ts
```

---

## Components

Create:

```
CollectiveDecisionWorkspace.tsx

DecisionOverview.tsx

DecisionSubject.tsx

AnalysisSummary.tsx

Ballot.tsx

DecisionPanel.tsx

ParticipationStatistics.tsx

DecisionResult.tsx

OutcomePanel.tsx

DecisionActions.tsx
```

Component styles:

```
workspace.css

decision-overview.css

decision-subject.css

analysis-summary.css

ballot.css

decision-panel.css

participation-statistics.css

decision-result.css

outcome-panel.css

decision-actions.css
```

---

# Workspace Layout

```
Collective Decision Workspace

├── Decision Overview
├── Decision Subject
├── Analysis Summary
├── Ballot
├── Decision Panel
├── Participation Statistics
├── Decision Result
├── Outcome
└── Actions
```

The interface follows the natural decision-making process.

---

# Decision Overview

Display:

- title;
- status;
- decision template;
- created date;
- opening date;
- closing date.

Read-only.

---

# Decision Subject

Display the object being decided.

Version 1:

- Initiative title;
- Initiative summary;
- current lifecycle stage.

Future templates may display other Decision Subjects.

---

# Analysis Summary

Display:

- Collaborative Analysis Summary;
- Readiness;
- Progress Policy summary.

The summary is always visible.

The participant should not be required to navigate elsewhere before understanding the decision.

---

# Ballot

Display:

- decision question;
- available options;
- decision rules summary.

Version 1:

Options:

```
Approve

Reject
```

Read-only while the participant has not yet entered the Decision Panel.

---

# Decision Panel

The canonical participant submission surface.

Version 1 supports:

- Submit Decision (Approve or Reject);
- Approve
- Reject

After submission, display:

```
Decision Submitted
```

The panel becomes read-only after submission.

Future templates may support:

- Candidate Selection;
- Priority Ranking;
- Trust Evaluation;
- Multi-option Decisions.

---

# Participation Statistics

Display:

- eligible participants;
- submitted decisions;
- participation rate;
- completion rate.

No personal information.

---

# Decision Result

Display only when the decision has reached Closed or later.

Include:

- totals;
- percentages;
- winning option;
- quorum status.

Never expose calculation internals.

---

# Outcome

Display only after Completed.

Examples:

- Approved;
- Rejected.

Future templates may display:

- Selected;
- Prioritized.

Outcome explains what happens next.

---

# Actions

Version 1:

Display secondary navigation only:

- View Initiative;
- View Collaborative Analysis.

Participant submission does not appear in Actions. The Decision Panel is the canonical submission surface.

---

# Data Sources

Use:

```
GET /api/v1/collective-decisions/:decisionId
```

Version 1 only.

---

# Workspace Hierarchy Principle

The workspace presents information in the order participants naturally think.

```
What is being decided?

↓

Why is this decision happening?

↓

What are the available options?

↓

What is my decision?

↓

What has the community decided?

↓

What happens next?
```

The interface should support understanding before interaction.

---

# Calm Interface Principle

The workspace should:

- minimize visual noise;
- emphasize clarity;
- avoid social-media interaction patterns;
- encourage deliberate participation.

---

# Version 1 Scope

Implements:

- Initiative Decision Subject;
- Community Poll template;
- Approve / Reject;
- one Ballot;
- one ParticipantDecision.

Future templates reuse the same workspace.

---

# Engineering Principles

Preserve:

- Human Leadership;
- Informed Decision;
- Workspace Hierarchy;
- Explicit Publicity;
- Progressive Bootstrap.

---

# Verification

Confirm:

- workspace renders;
- Decision Subject displays;
- Analysis Summary displays;
- Ballot renders;
- Decision Panel works;
- statistics display;
- Result and Outcome follow lifecycle rules.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Completion Criteria

Guide 04 is complete when:

- workspace compiles;
- all components render;
- Decision Panel functions;
- lifecycle visibility rules are respected;
- typecheck passes.

Guide 05 must not be started.
