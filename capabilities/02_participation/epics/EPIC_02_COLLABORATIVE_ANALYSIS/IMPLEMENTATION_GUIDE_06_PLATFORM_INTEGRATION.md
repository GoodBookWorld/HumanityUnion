# IMPLEMENTATION_GUIDE_06_PLATFORM_INTEGRATION

## Capability 02 — Participation

### Epic 02 — Collaborative Analysis

Guide 06 of 7

Version 1.0

Status: Ready

---

# Purpose

Integrate Collaborative Analysis into the Humanity Union platform architecture.

This guide verifies that Collaborative Analysis correctly interacts with the Initiative domain while preserving architectural boundaries and platform principles.

No new business functionality is introduced.

---

# Scope

This guide includes:

- Initiative integration;
- platform routing;
- navigation;
- public projection integration;
- architecture verification.

This guide does not include:

- new domain behavior;
- intelligence services;
- authentication;
- authorization;
- moderation.

---

# Integration Points

Verify integration with:

- Initiative
- Public Initiative Projection
- Collaborative Analysis
- Public Collaborative Analysis Projection

Maintain clear aggregate boundaries.

---

# Initiative Integration

Each Initiative owns exactly one Collaborative Analysis.

Verify:

```
Initiative

↓

CollaborativeAnalysis
```

The Initiative references the analysis.

The analysis references the Initiative.

Ownership remains unchanged.

---

# Navigation

Verify platform navigation.

Users should be able to move between:

```
Initiative Workspace

↓

Collaborative Analysis Workspace
```

and

```
Public Initiative

↓

Public Collaborative Analysis
```

Navigation must be intuitive and consistent.

---

# Public Integration

Verify:

```
Initiative

↓

Public Initiative Projection
```

and

```
Collaborative Analysis

↓

Public Collaborative Analysis Projection
```

Public projections remain independent.

---

# Aggregate Independence

Confirm:

Initiative owns:

- initiative lifecycle;
- initiative metadata;
- Progress Policy.

Collaborative Analysis owns:

- Contributions;
- Signals;
- Analysis Summary;
- Metrics;
- Readiness.

Neither aggregate duplicates the other's responsibilities.

---

# Foundation Alignment

Verify compliance with:

- Engineering Foundation;
- Collective Intelligence Foundation;
- Intelligence Service Contract.

Collaborative Analysis consumes platform services without owning them.

---

# Architecture Principles

Confirm preservation of:

- Domain First;
- Domain Ownership;
- Progressive Bootstrap;
- Thin API;
- Explicit Publicity;
- Historical Integrity;
- Human Leadership;
- Independent Lifecycles;
- Derived State.

---

# Repository Structure

Verify that implementation follows the standard platform layout.

Examples:

```
packages/types
apps/api
apps/web
```

No capability-specific architectural deviations.

---

# Verification

Run:

```
pnpm typecheck
```

Expected:

PASS

Run application.

Verify:

- Initiative Workspace;
- Collaborative Analysis Workspace;
- Public Initiative;
- Public Collaborative Analysis.

All pages should render correctly.

---

# Success Criteria

Collaborative Analysis is fully integrated when:

- Initiative links correctly;
- navigation works;
- API endpoints respond;
- public projections work;
- workspace renders;
- aggregate boundaries remain intact;
- platform principles are preserved.

---

# Completion Criteria

Guide 06 is complete when:

- integration verification passes;
- architecture remains consistent;
- typecheck passes;
- no architectural regressions are introduced.

Guide 07 must not be started.
