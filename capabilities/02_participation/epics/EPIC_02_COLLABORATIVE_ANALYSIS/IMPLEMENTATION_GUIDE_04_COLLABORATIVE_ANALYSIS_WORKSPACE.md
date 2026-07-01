# IMPLEMENTATION_GUIDE_04_COLLABORATIVE_ANALYSIS_WORKSPACE

## Capability 02 — Participation

### Epic 02 — Collaborative Analysis

Guide 04 of 7

Version 1.0

Status: Ready

---

# Purpose

Implement the Collaborative Analysis Workspace.

The workspace presents the current analytical state of an Initiative through structured information rather than conversation.

This guide implements read-first functionality only.

---

# Scope

This guide includes:

- Collaborative Analysis Workspace
- Analysis Overview
- Readiness Dashboard
- Progress Policy panel
- Contribution Explorer
- Signal Overview
- Analysis Summary
- Actions panel

This guide does not include:

- editing Contributions;
- deleting Contributions;
- Intelligence integration;
- moderation;
- notifications;
- Focus Mode.

---

# Files to Create

## Page

```
apps/web/src/app/collaborative-analysis/[analysisId]/page.tsx

apps/web/src/app/collaborative-analysis/collaborative-analysis-page.css
```

---

## Feature

```
apps/web/src/features/collaborative-analysis/api.ts
```

---

## Components

```
CollaborativeAnalysisWorkspace.tsx

AnalysisOverview.tsx

ReadinessDashboard.tsx

ProgressPolicyPanel.tsx

ContributionExplorer.tsx

SignalOverview.tsx

AnalysisSummary.tsx

AnalysisActions.tsx
```

Component styles:

```
analysis-overview.css

readiness-dashboard.css

progress-policy-panel.css

contribution-explorer.css

signal-overview.css

analysis-summary.css

analysis-actions.css

workspace.css
```

---

# Workspace Layout

```
Collaborative Analysis Workspace

├── Analysis Overview
├── Readiness Dashboard
├── Progress Policy
├── Contribution Explorer
├── Signal Overview
├── Analysis Summary
└── Actions
```

The workspace presents analytical progress.

It does not resemble a discussion forum.

---

# Analysis Overview

Display:

- Initiative title
- Analysis status
- created date
- updated date

Read-only.

---

# Readiness Dashboard

Display:

- readiness percentage
- satisfied requirements
- missing requirements
- blocking issues

No calculations.

Display values returned by the API.

---

# Progress Policy Panel

Display:

- required Contributions
- required Signals
- participant threshold
- expert review requirement
- regional review requirement

Read-only.

---

# Contribution Explorer

Display Contributions grouped by ContributionType.

Supported groups:

- Evidence
- Question
- Alternative
- Clarification
- Reference
- Expert Opinion
- Summary Proposal
- Correction

Provide:

- search
- filtering
- grouping

No editing.

No threaded discussion.

---

# Signal Overview

Display Signal totals grouped by SignalType.

Examples:

- Needs Clarification
- Strong Evidence
- Weak Evidence
- Duplicate
- Needs Expert Review
- Regional Impact
- High Priority
- Ready for Poll

Signals remain analytical indicators.

They are not votes.

---

# Analysis Summary

Display:

- current summary
- author
- creation date

Read-only.

No automatic generation.

---

# Actions

Display only:

- Add Contribution
- Add Signal
- View Progress Policy

Actions may use placeholder handlers during bootstrap.

---

# Data Sources

Use:

```
GET /api/v1/collaborative-analysis/:analysisId
```

and

```
GET /api/v1/initiatives/:initiativeId/analysis
```

No additional endpoints.

---

# Workspace Principles

The implementation follows:

- Read-first Design
- Calm Interface
- Progressive Bootstrap
- Human Leadership
- Thin API
- Domain Ownership

---

# Calm Interface Principle

The interface should:

- minimize visual noise;
- highlight analytical progress;
- avoid distracting elements;
- prioritize understanding.

No social-media interaction patterns.

---

# Bootstrap Scope

Version 1 includes:

- read-only workspace;
- grouped Contributions;
- Readiness display;
- Progress Policy display;
- Signal overview;
- Analysis Summary.

Deferred:

- editing;
- Focus Mode;
- personalized layouts;
- Humanity Intelligence recommendations.

---

# Verification

Confirm:

- workspace renders;
- API data loads;
- Contributions grouped correctly;
- Readiness displays correctly;
- Progress Policy visible;
- Summary visible.

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
- components render correctly;
- API integration succeeds;
- read-only behavior is preserved;
- typecheck passes.

Guide 05 must not be started.
