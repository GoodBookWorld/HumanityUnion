# IMPLEMENTATION_GUIDE_05_COLLABORATIVE_ANALYSIS_PUBLIC_PROJECTION

## Capability 02 — Participation

### Epic 02 — Collaborative Analysis

Guide 05 of 7

Version 1.0

Status: Ready

---

# Purpose

Implement the public projection for Collaborative Analysis.

The public projection provides a read-only representation of the analytical state of an Initiative.

It exposes only information explicitly approved for public visibility.

---

# Scope

This guide includes:

- public projection type;
- projection builder;
- public REST endpoint;
- public read-only page.

This guide does not include:

- editing;
- authentication;
- moderation;
- Humanity Intelligence;
- Community Memory integration.

---

# Files to Create

## Types

```
packages/types/src/domain/public-collaborative-analysis.ts
```

---

## API

```
apps/api/src/modules/collaborative-analysis/public-collaborative-analysis.projection.ts

apps/api/src/modules/collaborative-analysis/public-collaborative-analysis.routes.ts
```

---

## Web

```
apps/web/src/app/collaborative-analysis/public/[analysisId]/page.tsx

apps/web/src/app/collaborative-analysis/public/[analysisId]/public-collaborative-analysis-page.css
```

---

## Exports

Update:

```
packages/types/src/domain/index.ts
```

```
apps/api/src/modules/collaborative-analysis/index.ts
```

```
apps/api/src/app.ts
```

Register:

```
GET /api/v1/public/collaborative-analysis/:analysisId
```

---

# Public Projection

Create:

```
PublicCollaborativeAnalysisProjection
```

Approved fields:

- analysisId
- initiativeId
- initiativeTitle
- status
- readiness
- progressPolicySummary
- analysisSummary
- contributionStatistics
- signalStatistics
- createdAt

Only public information is exposed.

---

# Projection Builder

Implement:

```
toPublicCollaborativeAnalysisProjection()
```

Responsibilities:

- map aggregate → public projection;
- remove internal fields;
- preserve read-only representation.

---

# Public API

Implement:

```
GET /api/v1/public/collaborative-analysis/:analysisId
```

Returns:

```
{
  success,
  data,
  meta,
  links,
  message
}
```

404 if analysis is not found.

---

# Public Page

Display:

- Initiative title
- Analysis status
- Readiness
- Progress summary
- Analysis Summary
- Contribution statistics
- Signal statistics

Read-only.

---

# Excluded Fields

Never expose:

- internal identifiers beyond public keys;
- authorId;
- reviewer information;
- draft summaries;
- Community Memory references;
- intelligence recommendations;
- internal metrics;
- calculation details;
- platform diagnostics.

---

# Public Projection Principle

Public Projection communicates:

"What is the current state?"

It does not communicate:

"How the platform internally reached this state."

---

# Engineering Principles

Implementation preserves:

- Explicit Publicity
- Read-only Design
- Thin API
- Human Leadership
- Progressive Bootstrap

---

# Verification

Confirm:

- public endpoint responds;
- projection excludes internal fields;
- public page renders;
- 404 returned for missing analysis.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Completion Criteria

Guide 05 is complete when:

- projection type exists;
- builder compiles;
- public endpoint works;
- public page renders;
- internal information remains hidden;
- typecheck passes.

Guide 06 must not be started.
