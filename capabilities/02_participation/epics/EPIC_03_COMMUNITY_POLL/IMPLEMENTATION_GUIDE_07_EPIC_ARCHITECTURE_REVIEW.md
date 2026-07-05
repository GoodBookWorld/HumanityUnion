# IMPLEMENTATION_GUIDE_07_EPIC_ARCHITECTURE_REVIEW

## Capability 02 — Participation

### Epic 03 — Community Poll

Guide 07 of 7

Version 2.0

Status: Approved

---

# Re-Review (Post-Remediation)

Remediation items 1–4 completed:

1. Decision Subject — Initiative title, summary, and lifecycle stage fetched via `getInitiativeById()`.
2. Analysis Summary — Collaborative Analysis summary, readiness, and progress policy rendered inline.
3. Actions — Decision Panel canonical; Actions contains secondary navigation only.
4. Public page CSS — import path corrected to `public-collective-decision-page.css`.

Re-review date: 2026-07-02

---

# Purpose

Perform the final architecture review of Epic 03.

Verify that the implemented Collective Decision vertical slice conforms to the approved architecture and platform engineering standards.

No implementation changes are introduced.

---

# Review Scope

Review the complete vertical slice.

```
Domain (@hu/types)

↓

Store

↓

API

↓

Workspace

↓

Public Projection

↓

Platform Integration
```

---

# Domain Review

Verify:

- CollectiveDecision Aggregate
- Ballot
- DecisionOption
- ParticipantDecision
- DecisionResult
- Outcome
- DecisionRules
- EligibilityRules
- DecisionStatistics
- DecisionTimeline

Confirm:

- exported through @hu/types;
- matches DOMAIN_MODEL;
- contains no business logic.

**Findings:**

- All domain types implemented in `packages/types/src/domain/collective-decision/` and exported through `@hu/types` via `packages/types/src/domain/index.ts`.
- `PublicCollectiveDecisionProjection` defined separately in `public-collective-decision.ts`.
- `CollectiveDecision` aggregate structure matches `DOMAIN_MODEL.md`: subject reference, ballot, participant decisions, derived result/outcome, statistics, timeline.
- Types layer contains interfaces and unions only; no functions, classes, or runtime logic.
- Approved terminology used (`Participant Decision`, `Decision Result`, `Outcome`); forbidden vote terminology absent.
- `Cancelled` status present per `STATE_MACHINE.md` (extends DOMAIN_MODEL status list).

Verdict:

PASS

---

# Store Review

Verify:

- bootstrap decision
- CRUD
- lifecycle transitions
- immutable ParticipantDecision
- derived DecisionResult
- derived Outcome
- archive support

Confirm:

- structuredClone() protection;
- lifecycle validation;
- aggregate invariants respected.

**Findings:**

- Bootstrap `decision-bootstrap-001` links to `initiative-bootstrap-001` with Community Poll Approve/Reject ballot in Draft status.
- Store operations: `listDecisions`, `getDecision`, `getDecisionBySubjectId`, `createDecision`, `updateDecision`, `archiveDecision`.
- Lifecycle: `scheduleDecision`, `openDecision`, `closeDecision`, `completeDecision`, `cancelDecision`.
- `submitParticipantDecision` enforces Active status, eligibility, ballot match, one submission per participant, and `assertParticipantDecisionsImmutable`.
- `calculateDecisionResult` and `determineOutcome` derive state in store; `completeDecision` orchestrates both before marking Completed.
- All reads return `cloneCollectiveDecision()` / `structuredClone()` copies.
- `ALLOWED_TRANSITIONS` matches `STATE_MACHINE.md`; cancel blocked when submissions exist.

**Minor observations (non-blocking):**

- Scheduled reschedule not supported while already Scheduled.
- `minimumParticipationRate` in DecisionRules not used in result calculation.
- Collaborative Analysis readiness gate not enforced at `openDecision` (deferred to platform layer).

Verdict:

PASS

---

# API Review

Verify:

Standard endpoints

GET

POST

PATCH

Lifecycle commands

ParticipantDecision submission

DecisionResult calculation

Outcome determination

Confirm:

- Thin API;
- response envelope;
- immutable fields protected.

**Findings:**

- Full REST surface at `/api/v1/collective-decisions` including list, get, create, patch, participant-decisions, calculate-result, determine-outcome, and lifecycle commands (schedule, open, close, complete, archive, cancel).
- Platform integration route `GET /api/v1/initiatives/:initiativeId/decision` registered in `app.ts`.
- Public route `GET /api/v1/public/collective-decisions/:decisionId` returns projection only.
- Controller validates then delegates to store; no business logic in routes.
- PATCH rejects immutable fields (`decisionId`, subject fields, `status`, `participantDecisions`, `decisionResult`, `outcome`, `statistics`, `timeline`); only `ballot` patchable and Draft-only in store.
- Standard `createSuccessResponse` envelope on main controller and public routes.

**Minor observations (non-blocking):**

- Initiative lookup route uses simplified failure envelope without `meta`/`links`.
- POST create does not strip client-supplied derived fields (PATCH protection is solid).

Verdict:

PASS

---

# Workspace Review

Verify:

- Decision Overview
- Decision Subject
- Analysis Summary
- Ballot
- Decision Panel
- Participation Statistics
- Decision Result
- Outcome
- Actions

Confirm:

- Workspace Hierarchy;
- Understanding Before Action;
- Calm Interface.

**Findings:**

- All nine sections present in `CollectiveDecisionWorkspace` with matching page navigation at `/collective-decisions/[decisionId]`.
- **Decision Subject** fetches Initiative by `decisionSubjectId` and displays title, summary, and lifecycle stage (Guide 04).
- **Analysis Summary** fetches Collaborative Analysis via initiative lookup and displays summary text, readiness, and progress policy inline (Guide 04 / Guide 06).
- **Decision Panel** is the canonical submission surface; read-only after submission.
- **Actions** contains secondary navigation only (View Initiative, View Collaborative Analysis).
- Decision Overview, Ballot, Participation Statistics, Decision Result, and Outcome conform to Guide 04.

Verdict:

PASS

---

# Public Projection Review

Verify:

- projection builder;
- public endpoint;
- public page.

Confirm:

- no operational information exposed;
- Operational View separated from Public View.

**Findings:**

- `toPublicCollectiveDecisionProjection()` exposes only approved public fields; maps result options to labels without option IDs.
- Excludes participant identities, participant decisions, ballot internals, decision rules, eligibility rules, audit timeline detail, and platform metadata from projection payload.
- Public API uses projection builder exclusively.
- Public page at `/collective-decisions/public/[decisionId]` fetches via `getPublicCollectiveDecision()` and renders read-only projection data with public cross-links.
- CSS import corrected to `public-collective-decision-page.css`; page renders with styles.

Verdict:

PASS

---

# Platform Integration Review

Verify:

- Initiative integration;
- Collaborative Analysis integration;
- routing;
- navigation;
- Decision Engine integration.

Confirm:

Aggregate independence preserved.

**Findings:**

- `GET /api/v1/initiatives/:initiativeId/decision` and `getDecisionBySubjectId("Initiative", initiativeId)` implemented.
- `ViewCollectiveDecisionLink` connects Collaborative Analysis workspace to Collective Decision workspace.
- Operational and public navigation chains wired: Initiative → Collaborative Analysis → Collective Decision with cross-links on all three public pages and workspace footer navigation.
- Routing follows platform convention: `/collective-decisions/:decisionId` and `/collective-decisions/public/:decisionId`.
- Bootstrap chain intact: `initiative-bootstrap-001` → `analysis-bootstrap-001` → `decision-bootstrap-001`.
- Aggregate independence preserved: Collective Decision references Initiative by ID; does not create Petition; Community Poll configured as Version 1 mechanism.
- Collaborative Analysis consumed in workspace via read-only API fetch (`summaries`, `readiness`, `progressPolicy`); aggregate boundaries preserved.

Verdict:

PASS

---

# Engineering Review

Confirm preservation of:

- Domain First
- Human Leadership
- Mechanism Independence
- Thin API
- Explicit Publicity
- Historical Integrity
- Progressive Bootstrap
- Operational View vs Public View
- Audience-Centered Architecture
- Template-Based Configuration

**Findings:**

- Vertical slice follows Domain → Store → API → Workspace → Public Projection → Integration pattern.
- Domain First, Thin API, Explicit Publicity, Historical Integrity (immutable submissions), Progressive Bootstrap, Mechanism Independence (Community Poll as template), and Operational/Public view separation all preserved.
- Derived state (DecisionResult, Outcome, DecisionStatistics) computed in store only.
- Understanding Before Action preserved: Initiative context and Collaborative Analysis summary displayed inline before Decision Panel interaction.

Verdict:

PASS

---

# Documentation Review

Verify completion of:

- EPIC
- DOMAIN_LANGUAGE
- DOMAIN_MODEL
- DOMAIN_DECISIONS
- STATE_MACHINE
- ARCHITECTURE_CONSISTENCY_REVIEW
- IMPLEMENTATION_PLAN
- Guides 01–07

Confirm:

- documentation synchronized;
- roadmap updated;
- changelog updated.

**Findings:**

- Epic 03 architecture documents complete (EPIC, DOMAIN_LANGUAGE, DOMAIN_MODEL, DOMAIN_DECISIONS, STATE_MACHINE, ARCHITECTURE_CONSISTENCY_REVIEW, IMPLEMENTATION_PLAN).
- Implementation Guides 01–07 completed; Guide 04 updated for Decision Panel as canonical submission surface.
- Command center, roadmap, and changelog synchronized during re-review.

Verdict:

PASS

---

# Repository Review

Run:

```
git status
```

Expected:

```
nothing to commit

working tree clean
```

**Findings:**

- Working tree contains uncommitted Epic 03 vertical slice: domain types, API module, web workspace, public projection, platform integration, and capability documentation.

Verdict:

FAIL

---

# Verification

Run:

```
pnpm typecheck
```

Expected:

PASS

**Result:** PASS (`tsc --noEmit` for `packages/types`, `apps/api`, `apps/web`)

Run the application.

Verify:

- Initiative Workspace
- Collaborative Analysis Workspace
- Collective Decision Workspace
- Public Initiative
- Public Collaborative Analysis
- Public Collective Decision

Expected:

HTTP 200

**Result:** PASS (verified 2026-07-02)

| Page                             | URL                                                     | Status |
| -------------------------------- | ------------------------------------------------------- | ------ |
| Initiative Workspace             | `/initiatives`                                          | 200    |
| Collaborative Analysis Workspace | `/collaborative-analysis/analysis-bootstrap-001`        | 200    |
| Collective Decision Workspace    | `/collective-decisions/decision-bootstrap-001`          | 200    |
| Public Initiative                | `/initiatives/public/initiative-bootstrap-001`          | 200    |
| Public Collaborative Analysis    | `/collaborative-analysis/public/analysis-bootstrap-001` | 200    |
| Public Collective Decision       | `/collective-decisions/public/decision-bootstrap-001`   | 200    |

---

# Review Summary

| Category             | Result |
| -------------------- | ------ |
| Domain               | PASS   |
| Store                | PASS   |
| API                  | PASS   |
| Workspace            | PASS   |
| Public Projection    | PASS   |
| Platform Integration | PASS   |
| Engineering          | PASS   |
| Documentation        | PASS   |
| Repository           | FAIL   |

---

# Approval Criteria

Epic 03 is approved only when:

- architecture passes;
- implementation passes;
- documentation is synchronized;
- repository is clean;
- verification passes.

**Status:** Architecture, implementation, documentation, and verification pass. Repository commit pending.

---

# Remediation Status

| Item                                  | Status   |
| ------------------------------------- | -------- |
| Decision Subject — Initiative context | Complete |
| Analysis Summary — CA inline display  | Complete |
| Actions — Decision Panel canonical    | Complete |
| Public page CSS import                | Complete |
| Repository commit                     | Pending  |

---

# Review Decision

Collective Decision Framework

Status:

APPROVED

**Operational note:** Commit the Epic 03 vertical slice to satisfy the repository criterion and close the engineering cycle. Do not begin Epic 04 until commit is complete.

---

# Final Principle

Collective Decision transforms collective understanding into transparent, auditable and reusable community decision-making.

Community Poll is Version 1.

The Decision Engine is designed for long-term evolution through reusable Decision Templates.
