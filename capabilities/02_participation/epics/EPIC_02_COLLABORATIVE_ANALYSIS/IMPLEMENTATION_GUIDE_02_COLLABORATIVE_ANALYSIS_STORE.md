# IMPLEMENTATION_GUIDE_02_COLLABORATIVE_ANALYSIS_STORE

## Capability 02 — Participation

### Epic 02 — Collaborative Analysis

Guide 02 of 7

Version 1.0

Status: Ready

---

# Purpose

Implement the in-memory store for Collaborative Analysis.

The store is responsible for maintaining aggregate integrity and enforcing domain invariants during the bootstrap phase.

No API, UI, authentication or persistence is included.

---

# Scope

This guide includes:

- in-memory storage;
- aggregate retrieval;
- aggregate creation;
- controlled updates;
- Readiness evaluation;
- immutable Contribution enforcement.

This guide does not include:

- REST endpoints;
- React components;
- MongoDB;
- authorization;
- Humanity Intelligence integration.

---

# Files to Create

## Store

```
apps/api/src/modules/collaborative-analysis/
    collaborative-analysis.store.ts
```

---

## Bootstrap Sample

```
apps/api/src/modules/collaborative-analysis/
    collaborative-analysis.sample.ts
```

---

## Exports

Update:

```
apps/api/src/modules/collaborative-analysis/index.ts
```

---

# Store Responsibilities

The store owns:

- aggregate storage;
- retrieval;
- creation;
- update validation;
- Readiness calculation.

The store does not own:

- API;
- UI;
- projections;
- business workflows outside the aggregate.

---

# Storage Model

Use:

```
Map<string, CollaborativeAnalysis>
```

All reads and writes must use:

```
structuredClone()
```

to preserve immutability.

---

# Required Operations

Implement:

```
listAnalyses()

getAnalysisById()

getAnalysisByInitiativeId()

createAnalysis()

updateAnalysis()

archiveAnalysis()
```

No additional operations.

---

# Bootstrap Data

Provide one bootstrap analysis.

Suggested identifier:

```
analysis-bootstrap-001
```

The sample should include:

- one Initiative reference;
- several Contributions;
- several Signals;
- ProgressPolicy;
- Readiness;
- AnalysisMetrics.

The data exists only for development.

---

# Readiness Evaluation

The store evaluates Readiness.

Readiness must be derived from:

- ProgressPolicy;
- Contributions;
- Signals;
- Metrics.

Readiness must never be manually stored as an independent decision.

---

# Derived State Principle

Readiness is a derived state.

The implementation must never persist flags such as:

```
readyForPoll = true
```

Instead:

```
Readiness

=

evaluate(

ProgressPolicy,

CurrentAnalysis
)
```

---

# Immutable Contributions

Published Contributions are immutable.

The store must reject updates that modify:

- content;
- title;
- contributionType;
- authorId;
- createdAt.

Corrections require new Contributions.

---

# Signals

Signals:

- may be added;
- may not become votes;
- may reference valid targets only.

Signals support analysis.

Signals do not determine outcomes.

---

# Progress Policy

ProgressPolicy may be updated only through aggregate updates.

Readiness must automatically reflect the updated policy.

---

# Analysis Summary

The store supports:

- creating summaries;
- storing multiple versions.

The store must not generate summaries.

Summary generation belongs to future Intelligence Services.

---

# Archive

archiveAnalysis()

Marks the analysis as Archived.

Historical information remains available.

No data is deleted.

---

# Engineering Principles

Implementation must preserve:

- Domain First;
- Progressive Bootstrap;
- Historical Integrity;
- Immutable Contributions;
- Additive Analysis;
- Human Leadership;
- Derived State Principle.

---

# Verification

Confirm:

- bootstrap analysis loads;
- CRUD operations work;
- Readiness evaluation executes;
- immutable Contribution rules are enforced;
- archive operation preserves history.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Completion Criteria

Guide 02 is complete when:

- store compiles;
- bootstrap data loads;
- Readiness is derived;
- immutable Contributions are protected;
- typecheck passes.

Guide 03 must not be started.
