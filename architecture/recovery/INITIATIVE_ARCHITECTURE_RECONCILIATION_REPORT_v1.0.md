# Initiative Architecture Reconciliation Report

## Canonical Initiative Architecture Reconciliation and Dependency Trace — v1.0

**Document type:** Evidence-gathering / architecture-reconciliation report (read-only investigation)
**Produced:** 2026-07-28
**Scope:** Full repository — `apps/api`, `apps/web`, `packages/types`, and all documentation trees
**Invariant under evaluation:** *"INITIATIVE IS THE CENTRAL CIVIC ENTITY OF THE PLATFORM"* (product owner directive, current task)
**Constraint:** No source code, documentation, routes, or dependencies were modified in the production of this report. Only this file was created.

---

## 1. Executive Summary

The repository contains **three parallel, largely non-communicating implementations** of the same conceptual civic-participation lifecycle (concern → collaboration → proposal → decision → implementation → impact), plus **two mutually contradictory sets of "authoritative" architecture documentation** that disagree about which entity — **Initiative** or **Activity** — is the platform's central civic anchor.

**The three implemented pipelines:**

1. **Initiative / "Capability‑02" pipeline** — `apps/api/src/modules/initiatives` plus 15 `initiative-*`-prefixed downstream modules. The oldest, most complete, most richly cross-validated (referential integrity via `getInitiativeById()` lookups), most search/notification-integrated, and — critically — **the pipeline the live frontend actually drives** (header nav, Workspace Home, the public initiative experience page, ~100 `verify-*.ts` e2e scripts). Built over 5 weeks (2026-07-01 → 2026-07-07) across ~30 commits.
2. **Older "Stage" pipeline** — bare `collaborative-analysis`, `collective-decision`, `petition`, `implementation-commitment`, `implementation` modules. In-memory, single-bootstrap-record, no domain events, no automated tests, but genuinely frontend-reachable (view/sign/contribute, not create) and in several cases (`petition`, `implementation-commitment`, `implementation`) directly and strongly typed to `initiativeId`.
3. **Activity pipeline** — `apps/api/src/modules/{activity,discussion,proposal,decision}`. The newest code (added 2026-07-26, the same day as the current HEAD commit), Mongo-backed, transactional-outbox event-driven, has the *only* files covered by the real `npm test` suite (29 test files) — and has **zero frontend integration of any kind**. It was built to satisfy a brand-new architecture document set (ADR‑002, "Activity Engine Specification") that explicitly declares Activity "the universal starting object," a claim not reconciled with the pre-existing, live Initiative pipeline.

**The documentation conflict is not a simple "old doc vs. new doc" situation.** The newest documentation bundle (`blueprint/05–18`, `engineering/`, `governance/`, `implementation/`, `integration/`, `validation/`, `platform/`, and `architecture/ARCHITECTURE_DECISION_RECORDS.md` — 56 files, ~98,000 lines) was added in a **single commit** (`a722b9f`, 2026-07-26, current HEAD) and is **internally self-contradictory**: `ADR-002` and `integration/00_ACTIVITY_ARCHITECTURE_INTEGRATION_REVIEW.md` declare Activity the "civic trace anchor" and "universal starting object," while, in the very same commit, `engineering/00_UBIQUITOUS_LANGUAGE.md` (v2.0, the platform's own canonical terminology authority) lists "Activity-centric collaboration" as **legacy** Version‑1.x terminology superseded by "Initiative-centric collaboration" as **canonical** Version‑2.0 terminology, and `blueprint/05_ACTIVITY_ENGINE_SPECIFICATION.md` itself explicitly disclaims that Activity manages workflows, governance, or decisions at all. A third document from the same commit, `implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md`, resolves the conflict unilaterally by declaring the entire Initiative pipeline "**LEGACY — ISOLATE**" while simultaneously mandating "*The Initiative-centered civic chain SHALL NOT be removed during MVP implementation*." The repository's own `governance/02_DOCUMENTATION_UPDATE_PLAN.md` admits **268 of 346 documents remain in "UPDATE" status** and schedules — but has not executed — a 4–6 month, 5-wave reconciliation.

**Net effect for the product owner's invariant:** the evidence in this repository — chronological (Initiative existed first, in working code, for 5 weeks, before Activity existed at all), volumetric (11 live `initiative-*` modules vs. 1 `activity` module), functional (Initiative is what the shipped frontend, search, and notifications actually use), and even documentary (the same commit that introduced Activity's supremacy claim also contains a canonical terminology document calling Activity-centric collaboration "legacy") — is **strongly consistent with, not contradictory to**, "Initiative is the central civic entity." The one document that argues otherwise (`ADR-002`) is an un-superseded outlier that was never reconciled against its own sibling documents, let alone the pre-existing, live Initiative implementation.

**Key structural findings:**

- Two live, parallel "recent activity" / Workspace systems are mounted simultaneously in `apps/api/src/app.ts`: a canonical, event-driven `GET /api/v1/workspace` (fed exclusively by the Activity pipeline, and called by **zero** frontend code) and a source-comment-`@deprecated` `GET /api/v1/workspace/home` (fed exclusively by the Initiative pipeline, and the **only** one the shipped frontend calls).
- Test coverage is almost perfectly inverted from usage: the Activity pipeline has ~29 files in the real `npm test` suite and 0 e2e `verify-*.ts` scripts; the Initiative pipeline has ~45+ `verify-*.ts` e2e scripts and 0 files in `npm test`. Neither pipeline has HTTP/route-level tests (no `supertest` anywhere).
- Three of the twelve tracked identifiers (`proposalId`, `analysisId`, `decisionId`/`collectiveDecisionId`, `implementationCommitmentId`) each denote **two or three structurally distinct, independently-persisted aggregates** in the codebase today, a direct, code-level duplication of civic concepts.
- The Initiative pipeline enforces referential integrity via manual `getInitiativeById()` lookups (no database foreign keys anywhere in the system); two Initiative-scoped modules (`initiative-comments`, `initiative-support`) perform **no** integrity check inside their own service layer, relying entirely on the Express route boundary.

This report answers Parts 1–10 of the task in the sections below, then concludes with the required risk and sequencing sections.

---

## 2. Documentation Authority Findings

### 2.1 Two documentation corpora, one commit apart in git history — but 19 days apart in reality

| Corpus | Representative paths | Git history | Anchor claim |
|---|---|---|---|
| **A — "Initiative" corpus** | `capabilities/02_participation/**`, `PLATFORM_ARCHITECTURE_BASELINE_V1.md`, `PLATFORM_CAPABILITY_MAP.md`, `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`, `blueprint/BLUEPRINT_CHANGELOG.md`, `blueprint/ARCHITECTURE_AUDIT.md`, `blueprint/Book_01_Foundation/00_BLUEPRINT_INDEX.md` (original) | ~30 commits, 2026-06-28 → 2026-07-07 (last touch `e76ef1d`), then 2 more commits through 2026-07-07 continuing Initiative-based implementation | **Initiative** — consistently, in every document, for 5+ weeks |
| **B — "Blueprint v2.0 / Activity" corpus** | `blueprint/05–18_*.md`, all of `Book_01_Foundation`/`Book_02_Engineering` (re-added), `engineering/*`, `governance/*`, `implementation/*`, `integration/*`, `validation/*`, `platform/*`, `architecture/ARCHITECTURE_DECISION_RECORDS.md`, `docs/CIVIC_ACTIVITY.md` | **Single commit** `a722b9f` ("Checkpoint before ESLint/TypeScript configuration changes"), 2026-07-26 19:21 — the **current HEAD** — 56 files / ~97,884 lines added at once, 19 days after Corpus A's last edit | **Contested even within itself** (see §2.3) |

The pivot point: commit `1e1f135` ("Complete Architecture Version 2.0 baseline before implementation"), 2026-07-26 12:39 — 7 hours before `a722b9f` — added the first `apps/api/src/modules/activity/` code (11 files). Both `1e1f135` and `a722b9f` are the two newest commits in the repository's entire ~66-commit history.

**Methodology caution confirmed:** internal "Date" fields inside Corpus B documents (`ADR-002: Date 2026-07-21`; `governance/00_DOCUMENTATION_AUDIT.md: Audit date 2026-07-21`) **predate** their actual git commit timestamp (2026-07-26) by 5 days. Internal dates and internal "Frozen"/"Approved" status labels are not reliable proxies for chronological authority in this repository — only `git log` is. `PLATFORM_ARCHITECTURE_BASELINE_V1.md` says "Frozen" and looks terminal, but is chronologically the **older** document relative to Corpus B by three weeks.

### 2.2 Per-document findings (10 requested concepts)

| # | Concept | Most current relevant doc(s) | Version | Status | Last commit | Anchor claim | Superseded? |
|---|---|---|---|---|---|---|---|
| 1 | **Initiative** | `capabilities/02_participation/CAPABILITY_02_PARTICIPATION.md` | 1.0 | (content: Frozen/Complete) | `e76ef1d` 2026-07-04 | **Initiative** — *"The central domain of this capability is: Initiative … Proposal, Discussion, Poll, Petition, and Implementation are not independent systems. They are different phases of one Initiative."* | Functionally re-labeled "Legacy — Isolate" by `implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md` (Corpus B), but never formally superseded via ADR against this specific document, and Corpus B's own `engineering/00_UBIQUITOUS_LANGUAGE.md` treats Initiative as canonical (see §2.3) |
| 1 | Initiative (alt.) | `PLATFORM_ARCHITECTURE_BASELINE_V1.md`, `PLATFORM_CAPABILITY_MAP.md` (root) | 1.0 | **Frozen** / Living Document | `e76ef1d` 2026-07-04 | **Initiative** — *"Idea → Initiative → Collaborative Analysis → Collective Decision → Petition → Implementation Commitment → Implementation → Impact"*; *"Participation architecture through Implementation is architecturally complete in Version 1."* | Not touched by the `a722b9f` bulk commit at all — Corpus B never amends or references this file |
| 1 | Initiative (freeze) | `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md` | 1.0 | **Approved** | `e76ef1d` 2026-07-04 | **Initiative** — states *"architectural drift requires an explicit review and approved change"*; no ADR referencing this document exists | No |
| 2 | **Activity** | `blueprint/05_ACTIVITY_ENGINE_SPECIFICATION.md` | 2.0 | Foundational Architectural Standard | `a722b9f` 2026-07-26 (new) | **Explicitly NOT an anchor** — *"the Activity Engine does not manage workflows, governance, collaboration, or decision-making… serves as Humanity Union's institutional memory"* | N/A (newest doc on this topic) |
| 2 | Activity (alt.) | `architecture/ARCHITECTURE_DECISION_RECORDS.md` ADR‑002; `integration/00_ACTIVITY_ARCHITECTURE_INTEGRATION_REVIEW.md` | 2.0 / 1.0 | Accepted / (integration authority) | `a722b9f` 2026-07-26 (new) | **YES, explicitly** — *"Activity is the universal starting object… Every significant civic interaction SHALL begin with an Activity."* Directly contradicts sibling doc `blueprint/05` above (both from the same commit) | `Supersedes: None / Superseded By: None` (self-declared, unsuperseded, per the ADR registry's own status field) |
| 3 | **Member Journey** | `implementation/01_MEMBER_JOURNEY_SPECIFICATION.md` (v2.0, "Canonical") vs. `blueprint/Book_01_Foundation/06_HUMAN_JOURNEYS.md` (older, Corpus A/B mixed — file itself re-added in `a722b9f` but the *concept* predates it) | 2.0 | Canonical (self-declared) | `a722b9f` 2026-07-26 | Lists "Activity Architecture" and "Decision Lifecycle Architecture" as Blueprint dependencies; does not cross-reference the Initiative-based journey in `capabilities/02_participation` | No formal supersession recorded either direction |
| 4 | **Participation lifecycle** | `capabilities/02_participation/PARTICIPATION_PIPELINE.md` (Initiative-anchored) vs. `blueprint/17_PROPOSAL_AND_MEMBER_SIGNAL_FRAMEWORK.md` (Corpus B, but itself Initiative-anchored — see §2.3) | 1.0 | Active | `e76ef1d` / `a722b9f` | Both describe an **Initiative-anchored** lifecycle diagram (`Initiative → Collaborative Analysis → Collective Decision/Petition → Implementation → Impact`), despite one being in Corpus A and one in Corpus B | Neither formally supersedes the other; they agree with each other |
| 5 | **Discussion** | `apps/api/src/modules/discussion` (Activity-pipeline code) vs. `blueprint/06_DISCUSSION_AND_COLLABORATION_MODEL.md` (Corpus B) vs. `engineering/00_UBIQUITOUS_LANGUAGE.md` Legacy→Canonical table: **"Discussion" is explicitly listed as a legacy term, canonically replaced by "Collaborative Analysis"** | 2.0 | Normative | `a722b9f` 2026-07-26 | Contradicts the code: a live, tested `discussion` Mongo module exists, yet the platform's own canonical vocabulary calls "Discussion" a legacy term | Ubiquitous Language v2.0 supersedes v1.0 per its own header |
| 6 | **Proposal** | `apps/api/src/modules/proposal` (Activity-scoped) vs. `apps/api/src/modules/initiative-improvement-proposal` vs. `blueprint/17_PROPOSAL_AND_MEMBER_SIGNAL_FRAMEWORK.md`: *"Every Proposal belongs to an Initiative. A Proposal cannot exist independently from an Initiative."* | — | Approved (ADR-009 related) | `a722b9f` | **Initiative** — the Blueprint's own Proposal framework document is Initiative-anchored, not Activity-anchored, despite being part of Corpus B | `engineering/00_UBIQUITOUS_LANGUAGE.md` further marks "Proposal Aggregate" legacy → canonical is "Proposal Entity inside Initiative" |
| 7 | **Collective Decision** | `blueprint/12_DECISION_LIFECYCLE_ARCHITECTURE.md` (Corpus B) vs. `apps/api/src/modules/{collective-decision, initiative-collective-decision, decision, decision-session}` (four code implementations) | — | Approved | `a722b9f` | Ambiguous in code (4 implementations); Ubiquitous Language table: "Decision" legacy → "Decision Session or Collective Decision (context-dependent)" canonical | Not resolved |
| 8 | **Petition** | `capabilities/02_participation/epics/EPIC_04_PETITION/EPIC_04_PETITION.md` (Corpus A, Initiative-anchored: *"Petition is the stage where an approved community decision becomes a visible, accountable request for action"*) | 1.0 | Draft | `e76ef1d`/`315c9b4` | **Initiative** | No Corpus B document defines a competing Petition model — Petition is the one stage where both corpora are silent/agree |
| 9 | **Implementation** | `capabilities/02_participation/epics/EPIC_05/06` (Corpus A) vs. `implementation/modules/*` (Corpus B, generic "Implementation" specs written for the Activity chain) | 1.0 / 2.0 | Draft / Approved | mixed | Both corpora define an Implementation stage; Corpus A's is Initiative-anchored, Corpus B's is written for the Activity→Decision→Implementation chain | Not resolved |
| 10 | **Impact** | `implementation/modules/07_IMPACT_SPECIFICATION.md` (Corpus B: Activity-chain Impact) vs. `apps/api/src/modules/initiative-public-impact` (Corpus A code, live) | 2.0 | Approved for MVP | `a722b9f` | Corpus B's Impact spec assumes an Activity-chain (`Discussion→Analysis→Proposal→Decision→Implementation→Impact`); the only **implemented** Impact code is Initiative-anchored (`initiative-public-impact`) | Not resolved; Corpus B's Impact spec has no corresponding code yet |

### 2.3 The decisive internal contradiction — found within the *same* commit

Three documents added in the identical commit `a722b9f` disagree on the central anchor:

1. **`architecture/ARCHITECTURE_DECISION_RECORDS.md`, ADR‑002 — "Activity as Universal Starting Object"** (Status: Accepted, `Supersedes: None`, `Superseded By: None`): *"Activity is the universal starting object for meaningful civic participation. Every significant civic interaction SHALL begin with an Activity… Parallel civic entry objects SHALL NOT emerge."* Its own "Alternatives Considered" table evaluates Discussion, Proposal, Notification, and "multiple parallel entry objects" as rejected alternatives — it **never evaluates or even mentions Initiative**, despite Initiative being a live, working, 11-module aggregate already in the repository at the time this ADR was authored.
2. **`engineering/00_UBIQUITOUS_LANGUAGE.md` v2.0** (self-declared: *"All future engineering artefacts must conform to the terminology defined here"*, `Supersedes: Version 1.0`), Section 15 "Concept Evolution" table:

   | Version 1.x | Version 2.0 |
   |---|---|
   | Discussion | Collaborative Analysis |
   | Proposal Aggregate | Proposal Entity (inside Initiative) |
   | Decision | Decision Session / Collective Decision |
   | Proposal Lifecycle | **Initiative Lifecycle** |
   | **Activity-centric collaboration** | **Initiative-centric collaboration** |

   This table, from the platform's own canonical terminology authority, explicitly frames "Activity-centric collaboration" as the **superseded Version 1.x** model and "Initiative-centric collaboration" as the **current Version 2.0 canonical** model — the exact opposite of ADR-002's claim, published in the same commit.
3. **`implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md` v2.0** (Status: Approved) resolves the tension unilaterally, by fiat, not by ADR: it classifies the entire Initiative pipeline (`initiatives`, `initiative-collaborative-analysis`, `initiative-improvement-proposal`, `decision-session`, `initiative-collective-decision`, `initiative-implementation-commitment`, `initiative-implementation-tracking`, `initiative-public-impact`, plus the older `petition`/`collective-decision`/`collaborative-analysis`/`implementation` stage modules, plus `workspace-home`) as **"LEGACY — ISOLATE"** (repeated in at least 6 separate tables throughout the document), while simultaneously stating: *"The repository contains a mature Initiative-centered implementation. Although operationally stable, this implementation does not represent the Blueprint v2.0 civic lifecycle"* and *"The Initiative-centered civic chain SHALL NOT be removed during MVP implementation… Until then, Initiative modules remain part of the Legacy Compatibility Layer."*

4. **`governance/02_DOCUMENTATION_UPDATE_PLAN.md`** confirms none of this has been reconciled: *"268 documents remain in UPDATE status"*; a 5-wave, 4–6 month plan is only **proposed**, and explicitly schedules "all Capability 02 Initiative docs" for a still-future Wave 3. Its own governance rule #7 states: *"ADR before structural change — new aggregates, events, bounded contexts, **Initiative write model**"* — implicitly acknowledging Initiative remains a live write-model requiring governed change control, not a dead concept.

5. Self-certifying documents in the same tree (`engineering/ENGINEERING_DOCUMENTATION_ALIGNMENT_REPORT_v1.0.md`, `ENGINEERING_ARCHITECTURE_CONSISTENCY_REVIEW.md`) claim **"0 Terminology conflicts," "0 Critical" architectural inconsistencies, and "CERTIFIED"** alignment — a claim directly contradicted by finding (2) above, indicating these self-audits did not actually catch the Activity/Initiative terminology conflict they were meant to certify against.

6. `engineering/CANONICAL_EVENT_CATALOGUE.md` v2.0 (also from the same commit) offers a **third, distinct model**: it treats Activity and Initiative as two **co-existing, cross-referencing** bounded contexts (`ActivityCreated` consumed by "Initiative, Institutional Memory"; `InitiativeCreated` consumed by "Activity, Working Groups, Search"), an event topology that matches neither ADR-002's "Activity is sole root" model nor the Ubiquitous Language's "Activity is legacy" model, and matches **none** of what is actually implemented in code (the real Activity and Initiative pipelines have zero code-level cross-references).

7. Even within Corpus B's own Blueprint layer, `blueprint/17_PROPOSAL_AND_MEMBER_SIGNAL_FRAMEWORK.md` and `blueprint/09_WORKSPACE_ARCHITECTURE.md` (both `a722b9f`) describe an **Initiative Lifecycle** diagram (`Initiative → Collaborative Analysis → …`) and state *"Every Proposal belongs to an Initiative. A Proposal cannot exist independently from an Initiative"* and *"My Initiatives … helps Participants understand and continue their relationship with Initiatives throughout their complete constitutional lifecycle"* — again Initiative-anchored, contradicting ADR-002 from within the same document bundle.

8. `blueprint/BLUEPRINT_CHANGELOG.md` (Corpus A, `e76ef1d`) lists "preferred terminology" as `Member, Initiative, Capability, Community, Impact, Reflection, Opportunity, Knowledge, Growth` — Initiative is present; **Activity is absent**. `blueprint/ARCHITECTURE_AUDIT.md` (also Corpus A) — an audit whose every single check is still marked **"Pending"**, never completed — lists "Initiative" in its Terminology/Domain/Service/Event/API audit checklists and never mentions "Activity" at all.

**Conclusion for Part 1:** Authority, by volume of consistent documentation, by chronological precedence, by implementation completeness, and even by the newest documentation bundle's own internal canonical-terminology table, favors **Initiative**. The single document asserting the opposite (ADR‑002) is an outlier that (a) never engaged with the pre-existing Initiative architecture, (b) is contradicted by a sibling document from the identical commit, and (c) has not been through the repository's own required reconciliation process (`governance/02_DOCUMENTATION_UPDATE_PLAN.md` Wave 3, not yet executed).

---

## 3. Initiative Pipeline Map

### 3.1 Core aggregate (`apps/api/src/modules/initiatives`)

```91:106:packages/types/src/domain/initiative.ts
export interface Initiative {
  initiativeId: InitiativeId;
  stewardId: MemberId;
  createdAt: string;
  updatedAt: string;
  title: InitiativeTitle;
  description: InitiativeDescription;
  status: InitiativeStatus;
  lifecyclePhase: InitiativeLifecyclePhase;
  visibility: InitiativeVisibility;
  metadata: InitiativeMetadata;
  revisions: InitiativeRevision[];
  contributions: InitiativeContribution[];
  timeline: TimelineEvent[];
  sourceReferences?: InitiativeNewsSourceReference[];
}
```

- **Two status vocabularies:** `InitiativeStatus` (informational pipeline-stage label: draft/proposal/discussion/revision/ready_for_poll/poll/petition/implementation/completed/archived/revived/superseded/merged) and `InitiativeLifecyclePhase` (the one with real state-machine enforcement: `draft → published → projected → archived`, transition table in `initiative-lifecycle.ts`).
- **Commands/services** (`initiative.service.ts`): `createInitiativeDraft`, `saveInitiativeDraft`, `updatePublishedInitiative`, `updateManagedInitiative`, `publishInitiative`, `republishInitiative`, `archiveInitiative`, `listMyInitiatives`. Ownership enforced everywhere via `assertInitiativeOwnership`.
- **Repository/store:** in-memory `Map<initiativeId, Initiative>` (`initiative.store.ts`), persisted via a pluggable adapter.
- **Persistence adapters:** `resolve-initiative-persistence.ts` — env var `INITIATIVE_PERSISTENCE` = `file` (default, `.runtime/initiatives.json`) | `memory` | `mongodb`.
- **Routes:** `/api/v1/initiatives` (owner CRUD + publish/republish/archive), `/api/v1/public/initiatives/:id` (public projection), `/api/v1/public/initiatives/:id/experience` (aggregator), `/api/v1/public/projections/world-initiatives`, `/api/v1/public/projections/communities*`.
- **Public projections:** `public-initiative.projection.ts` (computed live per-request), `initiative-projection.store.ts` (pre-computed community/world card cache, synced synchronously on every mutation), `public-initiative-experience.service.ts` (the big aggregator pulling all 10+ downstream modules by `initiativeId` into one page payload).
- **Frontend:** `apps/web/src/app/initiatives/**` (list, create, owner studio at `/initiatives/[id]`, public experience at `/initiatives/public/[id]`, revision detail); feature folders `features/initiatives/` (37 files), `features/initiative-owner-studio/`, `features/public-initiative-experience/`.
- **Events:** No class-based domain-event system — a flat, synchronous, string-typed `emitCivicNotificationEvent(...)` call (not outbox-based) plus an inline `Initiative.timeline[]` history array recorded directly on the aggregate.
- **Tests:** **Zero** files in the real `apps/api/test/**` suite reference Initiative or any downstream module. Coverage exists exclusively via ~45+ standalone `verify-*-e2e.ts` scripts, none of which run as part of `npm test`.

### 3.2 Downstream modules (all keyed by `initiativeId`, directly or transitively)

| Module | Relationship to Initiative | Identifier | Enforced or implied? | Persistence | Frontend |
|---|---|---|---|---|---|
| `initiative-collaborative-analysis` | `initiativeId` required field | `analysisId` | **Enforced** — `assertEligibleInitiative` calls `getInitiativeById`, requires `lifecyclePhase` published/projected | file/memory/mongo (`INITIATIVE_ANALYSIS_PERSISTENCE`) | `features/initiative-collaborative-analysis/` (editor + workspace) |
| `initiative-improvement-proposal` | `initiativeId` + `analysisId` required | `proposalId` | **Enforced indirectly** — derives `initiativeId` from the validated, published analysis rather than trusting client input | file/memory/mongo | `features/initiative-improvement-proposal/` |
| `decision-session` | `initiativeId` required + `initiativeVersion` snapshot | `sessionId` | **Enforced richly** — eligibility requires initiative `projected`, published revision, ≥1 published analysis, ≥1 reviewed proposal | file/memory/mongo | `features/decision-session/` (component never imported anywhere — orphaned UI) |
| `initiative-collective-decision` | `initiativeId` + `decisionSessionId` required | `decisionId` | **Enforced** — validates session belongs to initiative, is closed, rejects duplicate decisions per session, cross-checks `supersedesDecisionId` belongs to same initiative | file/memory/mongo | `features/initiative-collective-decision/` (read + my-vote only; no vote-casting UI) |
| `initiative-implementation-commitment` | `initiativeId` + `decisionId` required | `implementationCommitmentId` | **Enforced** — requires decision to exist, belong to initiative, be closed | file/memory/mongo | `features/initiative-implementation-commitment/` (API-only, zero components) |
| `initiative-implementation-tracking` | `commitmentId` required, `initiativeId` derived | `trackingId` | **Enforced**, derived not trusted | file/memory/mongo | `features/initiative-implementation-tracking/` (API-only, zero components) |
| `initiative-public-impact` | `trackingId` required, `initiativeId` derived | `impactId` | **Enforced** — verification additionally requires steward ownership of the *initiative*, not just impact authorship | file/memory/mongo | `features/initiative-public-impact/` (API-only, zero components) |
| `initiative-version-revision` | `initiativeId` required | `revisionId` | **Enforced**, and this module **writes back** into the live Initiative aggregate on publish | file/memory/mongo | `features/initiative-version-revision/` |
| `initiative-comments` | `initiativeId` field on record | `commentId` | **NOT enforced inside the service** — only at the Express route boundary (`resolveInitiativeOr404`) | memory/mongo | consumed via `public-initiative-experience` |
| `initiative-comment-reactions` | `initiativeId` + `commentId` | `reactionId` | **Enforced** — cross-checks `comment.initiativeId === input.initiativeId` | memory/mongo | via `public-initiative-experience` |
| `initiative-decision-vote` ("initiative voting") | `decisionId` → transitively `initiativeId` | `voteId` | **Enforced**, multi-layered (decision window + community/geography eligibility) | file/memory/mongo | via `initiative-collective-decision` client |
| `initiative-support` | `initiativeId` field on every record | — | **NOT enforced inside the service** — route-boundary only, same pattern as comments | memory/mongo | via `public-initiative-experience` |
| `participation-eligibility` | Stateless helper (community-slug based, not ID-based) | — | N/A | none | sole caller is `initiative-decision-vote` |
| `workspace-assistant` | `initiativeId` required in request body | — | **Enforced**, plus tamper-check of client-sent context snapshot | none (stateless) | `/api/v1/workspace-assistant` |
| `notifications` | Resolves `initiativeId` transitively for every downstream module | — | **Enforced** via `resolveInitiativeIdFromEntity` re-derivation | notification store | fire-and-forget, synchronous |
| `global-search` | Indexes every downstream record **keyed by `initiativeId`**, gated by `isPublicInitiative()` | — | **Enforced** | in-memory cache, invalidated synchronously on mutation | `/search` |

**Cross-cutting pattern:** There are no database foreign keys anywhere in this system — every "enforced" relationship is a manual `getXById()` call plus a thrown `Error`. Two modules (`initiative-comments`, `initiative-support`) have no defense-in-depth at the service layer, a real integrity gap if either service is ever called from a non-HTTP context.

---

## 4. Activity Pipeline Map

### 4.1 The four modules

| Module | Aggregate fields | Identifier | Route (mounted) | Mongo collection | Events (outbox) | Initiative reference |
|---|---|---|---|---|---|---|
| `activity` | `activityId, creatorMemberId, title, description, activityType("civic_participation"), visibility, status("open"), aggregateVersion` | `activityId` | `POST/GET /api/v1/activities` | `activities` | `ActivityCreated` ✅ | **None** |
| `discussion` | `discussionId, activityId (required), creatorMemberId, title, openingMessage, status, visibility (inherited)` | `discussionId` | `POST/GET /api/v1/discussions` | `discussions` | `DiscussionCreated` ✅ | **None** |
| `proposal` | `proposalId, activityId (required), discussionId (nullable), title, summary, proposalText, status(draft\|submitted)` | `proposalId` | `POST /api/v1/proposals`, `POST /:id/submit` | `proposals` | `ProposalCreated`, `ProposalSubmitted` ✅ | **None** |
| `decision` | `decisionId, proposalId, activityId, title, status("open")` | `decisionId` | `POST/GET /api/v1/decisions` | `decisions` | `DecisionOpened` ✅ | **None** |

All four are transactionally outbox-backed (event inserted into the Mongo `outbox` collection in the same transaction as the aggregate write), dispatched by a background poller, and feed exactly one consumer: the `workspace` module's canonical projection handlers.

### 4.2 Frontend reality

**Zero.** An exhaustive grep of `apps/web/src` for `/api/v1/activities`, `/api/v1/discussions`, `/api/v1/proposals`, `/api/v1/decisions`, and the canonical `GET /api/v1/workspace` root path returns **no matches whatsoever**. No page, component, or API client anywhere in the frontend references this pipeline. The one endpoint this pipeline was built to feed (`GET /api/v1/workspace`, self-documented in its own source as *"Canonical MVP Workspace read endpoint — projection-only, no legacy initiative data"*) is never called; the frontend instead calls the sibling, source-comment-`@deprecated` `GET /api/v1/workspace/home`.

### 4.3 Tests

Fully covered by the real `npm test` suite (Node's built-in test runner): 4 unit + 2 integration files for `activity`; 2 unit + 2 integration for `discussion`; 3 unit + 3 integration for `proposal`; **0 dedicated test files for `decision`** (only exercised indirectly via shared workspace-projection tests). Plus 5 workspace-projection-handler unit tests and 4 workspace-projection integration tests covering the event → projection path. No HTTP/route-level tests exist for any of it.

---

## 5. Older Stage Pipeline Map

`CollaborativeAnalysis → CollectiveDecision → Petition → ImplementationCommitment → Implementation`

| Stage | Path | Primary ID | Relationship to Initiative | Persistence | Routes | Frontend | Events | Tests | Deprecated marker | Mounted | UI can create? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CollaborativeAnalysis | `apps/api/src/modules/collaborative-analysis` | `analysisId` | **Direct, typed** `initiativeId` field | in-memory `Map`, no Mongo, no auth middleware on routes | `/api/v1/collaborative-analysis*`, `/api/v1/initiatives/:id/analysis`, `/api/v1/public/collaborative-analysis/:id` | Yes — `/collaborative-analysis/[id]` reads it | None | None | None found | Yes (`app.ts:220`) | `createCollaborativeAnalysis` exists in the API client but is **never called** by any UI |
| CollectiveDecision | `apps/api/src/modules/collective-decision` | `decisionId` | **Indirect/generic** — `decisionSubjectType: "Initiative"\|...` + untyped `decisionSubjectId: string` (not `InitiativeId`) | in-memory `Map`, single bootstrap record, no auth on routes | `/api/v1/collective-decisions*`, `/api/v1/initiatives/:id/decision`, `/api/v1/public/collective-decisions/:id` | Yes — `/collective-decisions/[id]` + `Ballot.tsx`/`DecisionPanel.tsx` submit participant decisions | None | None | None found | Yes (`app.ts:221`) | No create endpoint exported by the frontend API client at all |
| Petition | `apps/api/src/modules/petition` | `petitionId` | **Direct, typed** `subject.initiativeId` | in-memory `Map`, single bootstrap record, no auth on routes | `/api/v1/petitions*`, `/api/v1/public/petitions/:id` | Yes — `/petitions/[id]` + `SignatureSection.tsx` calls `signPetition` | None | None | None found | Yes (`app.ts:222`) | No create UI; petitions are lifecycle-derived (auto-created after approved decision), not member-authored — by design, not gap |
| ImplementationCommitment | `apps/api/src/modules/implementation-commitment` | `implementationCommitmentId` | **Direct, typed** `initiativeId` **+** `collectiveDecisionId` **+** `petitionId` | in-memory `Map`, no Mongo, no auth on routes | `/api/v1/implementation-commitments*`, `/api/v1/public/implementation-commitments/:id` | Yes — real contribution/profile mutation forms wired | None | None | None found | Yes (`app.ts:223`) | Can mutate existing bootstrap record (add contribution items, withdraw), cannot create new top-level commitment |
| Implementation | `apps/api/src/modules/implementation` | `implementationId` | **Direct, typed** `initiativeId` **+** cross-validated `implementationCommitmentId` | in-memory `Map`, no Mongo, no auth on routes | `/api/v1/implementations*`, `/api/v1/public/implementations/:id` | Yes — achievement/evidence recording forms wired | None | None | None found | Yes (`app.ts:224`) | Can record achievements/evidence on existing bootstrap record, cannot create new top-level implementation |

**Important nuance for reconciliation:** unlike what a filename-based assumption might suggest, this "older Stage" pipeline is **not disconnected from Initiative** — `collaborative-analysis`, `petition`, `implementation-commitment`, and `implementation` all carry a properly-typed `initiativeId` field. Only `collective-decision`'s Initiative reference is generic/untyped. Distinguishing "code that exists" from "code that is mounted" from "code used by frontend": **all five stages are mounted AND frontend-reachable** for viewing/mutating a single seeded bootstrap chain, but **none can create a new top-level record from the UI**, and none emit domain events, notifications, or are covered by any automated test.

---

## 6. Identifier Relationship Matrix

| Identifier | Created by | Stored by | Referenced by | Initiative ancestry determinable? | Referential integrity validated? | Duplication risk |
|---|---|---|---|---|---|---|
| `initiativeId` | `initiatives` (`createInitiativeDraft`) | `initiative.store.ts` (file/memory/mongo) | 15 `initiative-*` modules, `petition`, `implementation-commitment`, `implementation` (typed), `collective-decision` (untyped generic), `workspace-assistant`, `notifications`, `global-search` | Yes (self) | N/A (root) | None — single Initiative concept |
| `activityId` | `activity` | Mongo `activities` | `discussion`, `proposal` (transitively), `decision` (transitively) | **None — zero cross-reference to `initiativeId` anywhere in the codebase** | Enforced (existence checked on create) | **High** — structurally parallel "root civic entity" to `initiativeId`; both meant to anchor a lifecycle per docs, neither references the other in code |
| `discussionId` | `discussion` (Activity pipeline) | Mongo `discussions` | `proposal.discussionId` (optional) | None | Enforced | **Medium** — `engineering/00_UBIQUITOUS_LANGUAGE.md` marks "Discussion" a legacy term canonically replaced by "Collaborative Analysis" (Initiative-scoped); a third, unrelated "Discussion" UI tab on the public initiative page is actually powered by `initiative-comments`, not `discussionId` at all — three-way naming collision |
| `proposalId` | **Three separate implementations:** `proposal` (Activity), `initiative-improvement-proposal` (Initiative) | Mongo `proposals` / initiative-improvement-proposal store | `decision.proposalId` (Activity); `initiative-collective-decision` indirectly (via analysis chain) | Activity-pipeline `proposalId`: none. Initiative-pipeline `proposalId`: yes, via `analysisId → initiativeId` | Activity: enforced. Initiative: enforced indirectly (derives `initiativeId` from validated analysis) | **High** — two independently-persisted "Proposal" aggregates; Ubiquitous Language further states canonical Proposal should be "an Entity inside Initiative," implying even the standalone `initiative-improvement-proposal` module may not be the final intended shape |
| `analysisId` | **Two separate implementations:** `collaborative-analysis` (old Stage), `initiative-collaborative-analysis` (Initiative) | in-memory Map / file-memory-mongo | Both reference `initiativeId` (both typed) | Yes for both | Enforced for both | **High** — both frontend-reachable; `/collaborative-analysis/[id]` page reads the old-Stage module while `initiative-collaborative-analysis` is the actively-developed one — a genuine duplicate implementation of the same concept, both anchored to Initiative |
| `decisionSessionId` | `decision-session` (sole implementation) | file/memory/mongo | `initiative-collective-decision.decisionSessionId` | Yes (`initiativeId` required field) | Enforced richly | Low — no competing implementation under this exact name |
| `decisionId` | **Three separate implementations:** `decision` (Activity), `collective-decision` (old Stage, generic subject), `initiative-collective-decision` (Initiative) | Mongo `decisions` / in-memory Map / file-memory-mongo | `initiative-implementation-commitment.decisionId`, `initiative-decision-vote.decisionId` | Activity: none. Old-Stage: generic/untyped. Initiative: yes, typed | Activity: enforced (proposal must be submitted). Old-Stage: none. Initiative: enforced richly | **Highest in the system** — three structurally distinct "Decision" aggregates coexist |
| `collectiveDecisionId` | Alias used by old-Stage `petition`/`implementation-commitment`/`implementation` to reference `collective-decision.decisionId`; also used in some initiative-collective-decision route names | Same stores as `decisionId` above | `petition.collectiveDecisionId`, `implementation-commitment.collectiveDecisionId`, `implementation.collectiveDecisionId` | Old-Stage: indirect via generic subject. Depends which "Decision" module the caller means | Enforced for old-Stage cross-checks (e.g. `assertApprovedCollectiveDecision`) | Ambiguous naming — same term used for two different backing modules depending on route |
| `petitionId` | `petition` (sole implementation) | in-memory Map | `implementation-commitment.petitionId`, `implementation.petitionId` | Yes, typed (`subject.initiativeId`) | Enforced | Low — single implementation |
| `implementationCommitmentId` | **Two separate implementations:** `implementation-commitment` (old Stage), `initiative-implementation-commitment` (Initiative) | in-memory Map / file-memory-mongo | `implementation.implementationCommitmentId` (old); `initiative-implementation-tracking.commitmentId` (new) | **Both** reference `initiativeId` directly and with proper typing | Enforced for both | **High** — genuine duplicate; old-Stage version is frontend-reachable via direct URL only, new version is API-only with zero UI components but is what Workspace Home actually surfaces |
| `implementationId` | `implementation` (old Stage; no directly-named Initiative-pipeline equivalent — closest analogue is `initiative-implementation-tracking`, keyed by `trackingId`) | in-memory Map | terminal record | Yes, typed | Enforced | Medium — duplicate-by-function (not by name) against `initiative-implementation-tracking` |
| `impactId` | `initiative-public-impact` (sole implementation; old baseline explicitly said Impact was "defined, not yet implemented") | file/memory/mongo | terminal record | Yes, derived from `trackingId → initiativeId` | Enforced (incl. steward-only verification) | Low — not duplicated |

### ASCII diagram of the three implemented pipelines

```
PIPELINE 1 — INITIATIVE / "CAPABILITY-02" (oldest, most complete, frontend-driven)
====================================================================================

Idea
  |
  v
Initiative ---------------------------------------------------------------+
  |                                                                        |
  |-- initiative-comments / initiative-comment-reactions                  |
  |-- initiative-support (signals, bookmarks, views)                      |
  |-- initiative-version-revision  (writes back into Initiative)          |
  |                                                                        |
  v                                                                        |
initiative-collaborative-analysis (analysisId)                            |
  |                                                                        |
  v                                                                        |
initiative-improvement-proposal (proposalId, derives initiativeId)        |
  |                                                                        |
  v                                                                        |
decision-session (sessionId)  --packageReferences--> [revisions, analyses, proposals]
  |                                                                        |
  v                                                                        |
initiative-collective-decision (decisionId)  <---- initiative-decision-vote (voting)
  |                                                                        |
  v                                                                        |
initiative-implementation-commitment (implementationCommitmentId)         |
  |                                                                        |
  v                                                                        |
initiative-implementation-tracking (trackingId, derives initiativeId)     |
  |                                                                        |
  v                                                                        |
initiative-public-impact (impactId, derives initiativeId)                 |
                                                                            |
     cross-cutting, all keyed by initiativeId: <-------------------------+
     workspace-assistant, notifications, global-search,
     civic-action-package, official-response, civic-accountability,
     public-civic-archive, civic-nomination(-voting)


PIPELINE 2 — OLDER "STAGE" PIPELINE (in-memory, single bootstrap chain, no events)
====================================================================================

collaborative-analysis (analysisId, initiativeId typed)
     |
     v
collective-decision (decisionId, decisionSubjectId: string [generic, untyped])
     |
     v
petition (petitionId, subject.initiativeId typed, collectiveDecisionId)
     |
     v
implementation-commitment (implementationCommitmentId, initiativeId + collectiveDecisionId + petitionId, all typed)
     |
     v
implementation (implementationId, initiativeId + implementationCommitmentId + collectiveDecisionId, all typed)

     [ frontend: viewable/mutable via direct URL to the single seeded
       bootstrap-001 chain; no nav links; no creation forms; no events;
       no automated tests ]


PIPELINE 3 — ACTIVITY (newest code, Mongo + outbox, zero frontend integration)
====================================================================================

activity (activityId)  --outbox--> ActivityCreated  --> workspace projection (canonical, unused by UI)
     |
     v
discussion (discussionId, activityId required)  --outbox--> DiscussionCreated --> workspace projection
     |
     v
proposal (proposalId, activityId + discussionId)  --outbox--> ProposalCreated, ProposalSubmitted --> workspace projection
     |
     v
decision (decisionId, proposalId + activityId)  --outbox--> DecisionOpened --> workspace projection

     [ ZERO references to initiativeId anywhere in this pipeline.
       ZERO frontend pages/components/API clients call any of its endpoints.
       Fully covered by npm test; zero verify-*.ts e2e scripts. ]
```

---

## 7. Frontend Exposure Matrix

Full route inventory, navigation reachability, and API-client endpoint verification were traced exhaustively (see agent methodology note at end of report). Summary classification:

| # | Pipeline | Class | Evidence | Confidence |
|---|---|---|---|---|
| 1 | **Initiative** (`initiatives`) | **A — Fully exposed** | `features/initiatives/api.ts` → `/api/v1/initiatives*`; header nav "Initiatives"; `/initiatives/create` form; `/initiatives/[id]` owner studio; `/initiatives/public/[id]` public page | High |
| 2 | **Activity** (`activity`) | **E — Dead/unreachable from UI** | Zero references to `/api/v1/activities` anywhere in `apps/web/src` | High |
| 3 | **Discussion** (`discussion`) | **E — Dead/unreachable from UI** | Zero references to `/api/v1/discussions`. The UI's "Discussion" tab actually calls the unrelated `initiative-comments` module | High |
| 4 | **Proposal — activity-scoped** (`proposal`) | **E — Dead/unreachable from UI** | Zero references to `/api/v1/proposals`. `features/initiative-improvement-proposal` calls a different module (`/api/v1/improvement-proposals`) entirely | High |
| 5 | **Initiative Improvement Proposal** | **A — Fully exposed** | Rendered live inside the owner studio at `/initiatives/[id]`, reachable from header nav | High |
| 6a | **Collective Decision — old Stage** (`collective-decision`) | **B — Partially exposed** (reachable only via direct URL; seed data only; no nav link; no creation form) | `features/collective-decision/api.ts` → `/api/v1/collective-decisions*` | High |
| 6b | **Initiative Collective Decision** | **B — Partially exposed** (nav-reachable read/my-vote only; no vote-casting or creation UI, though the backend endpoint exists) | `features/initiative-collective-decision/api.ts` | High |
| 6c | **Decision** (`decision`, Activity pipeline) | **E — Dead/unreachable from UI** | Zero references to `/api/v1/decisions` | High |
| 6d | **Decision Session** (`decision-session`) | **B — Partially exposed** (read/list fully nav-reachable via Workspace Home + public experience; creation component `DecisionSessionWorkspace.tsx` exists but is never imported anywhere — orphaned dead UI code) | `features/decision-session/api.ts` | High |
| 7 | **Petition** | **A\* — Fully exposed** (no creation form exists, but this is by domain design — petitions are lifecycle-derived, not member-authored) | `/initiatives/public/[id]#petition` → `/petitions/public/[id]` → "Sign this Petition" live action | Medium-High |
| 8a | **Implementation — old Stage** (`implementation` + `implementation-commitment`) | **B — Partially exposed** (real mutation UI exists, but reachable only via direct URL — not linked from any nav, Workspace Home, or the public initiative lifecycle experience) | `/implementations/[id]`, `/implementation-commitments/[id]` | High |
| 8b | **Initiative Implementation** (`initiative-implementation-commitment` + `-tracking`) | **B — Partially exposed** (fully nav-reachable for reading via Workspace Home and `/civic-activity`; zero creation/mutation UI components exist anywhere) | `features/initiative-implementation-commitment/api.ts`, `-tracking/api.ts` | High |
| 9 | **Initiative Public Impact** | **B — Partially exposed** (nav-reachable public detail page; no creation form anywhere) | `features/initiative-public-impact/api.ts` | High |

**Key structural finding:** the "new" initiative-namespaced pipelines (`initiative-collective-decision`, `initiative-implementation-commitment`, `initiative-implementation-tracking`, `decision-session`, `initiative-improvement-proposal`, `initiative-public-impact`) are what actually drives Workspace Home, `/civic-activity`, and the public initiative lifecycle experience today. The "old" Stage pipelines are not dead code — their endpoints are called by real, functioning components — but are structurally orphaned from all navigation, reachable only by already knowing a hardcoded `*-bootstrap-001` seed ID. The Activity pipeline (`activity`/`discussion`/`proposal`/`decision`) has no frontend footprint of any kind.

---

## 8. Event and Projection Matrix

| Event | Publisher | Outbox? | Subscribers | Workspace effect | Notification effect | Search effect | Public projection effect |
|---|---|---|---|---|---|---|---|
| `MemberRegistered` | `member` | ✅ | `workspace.member-registered.v1` | Initializes empty projection | None | None | N/A |
| `ActivityCreated` | `activity` | ✅ | `workspace.activity-created.v1` | Adds recent-activity card | **None** | **None** (not indexed) | N/A |
| `DiscussionCreated` | `discussion` | ✅ | `workspace.discussion-created.v1` | Adds card | None | None | N/A |
| `ProposalCreated` / `ProposalSubmitted` | `proposal` | ✅ | `workspace.proposal-*.v1` | Adds/transitions card | None | None | N/A |
| `DecisionOpened` | `decision` | ✅ | `workspace.decision-opened.v1` | Adds card | None | None | N/A |
| `initiative_published` (notification-type string, **not** a catalogue event) | `initiatives` | ❌ direct synchronous call | notification recipient resolver only | **None** — `workspace` module has zero references to "Initiative" | "Initiative published" → steward; also fans out `initiative_interest_match` | ✅ `invalidateGlobalSearchIndex()` called synchronously | Community card map updated synchronously (`syncProjectedInitiativeCard`) |
| `analysis_published`, `proposal_submitted`/`_decided`, `revision_published`, `decision_opened`/`_closed`, `commitment_published`, `tracking_updated`, `impact_verified`, `civic_action_package_issued`, `official_response_*`, `civic_accountability_*`, `archive_published`, `civic_nomination_*` (all Initiative-pipeline "events") | respective `initiative-*` modules | ❌ none of these use the outbox | notification recipient resolver only | None | Yes, per-type (steward/participant) | ✅ Indexed | Varies |

**The only real event-driven publish/subscribe infrastructure in the codebase** (transactional outbox + in-memory handler registry) is used exclusively by the Activity pipeline and its sole consumer, the `workspace` module. The entire Initiative pipeline uses a parallel, simpler, synchronous, non-transactional "fire and forget" notification mechanism (`emitCivicNotificationEvent`) that is a structurally different type (`CivicNotificationEventType`) from the outbox's `CATALOGUE_EVENTS`. Of 29 event names formally defined in `catalogue-events.ts`, only 6 are ever actually constructed anywhere in the codebase — all 6 belong to the Activity pipeline.

**Confirmed duplication/contradiction risk — two parallel "Workspace" systems, live simultaneously:**

- `apps/api/src/app.ts` mounts both `workspaceRouter` (`GET /api/v1/workspace`, self-documented *"Canonical MVP Workspace read endpoint — projection-only, no legacy initiative data"*) and `workspaceHomeRouter` (`GET /api/v1/workspace/home`, self-documented *"@deprecated Legacy initiative-centric Workspace home. Canonical MVP read model: GET /api/v1/workspace"*) at overlapping URL prefixes, simultaneously.
- The frontend (`apps/web/src/features/workspace-home/workspace-home-api.ts`) calls **only** the deprecated `/api/v1/workspace/home` endpoint. A repo-wide grep found **zero** frontend callers of the canonical `/api/v1/workspace` root endpoint.
- Net effect: a member who creates an Activity/Discussion/Proposal/Decision today gets a real, event-driven Workspace projection record written to Mongo — but it is **invisible in the shipped UI**. A member who publishes an Initiative/Analysis/Proposal/Decision/Commitment/Tracking/Impact record is what the UI actually shows, via a direct-read mechanism that produces no event trail. The two "recent civic activity" concepts are architecturally and operationally disjoint, and the module marked canonical in its own source comments is the one currently orphaned from the UI.

**Search:** `global-search.index.ts` builds its index by directly reading each module's store on demand (no event-driven indexing at all). Indexed: all `initiative-*` modules, the old-Stage `petition` module, `civic-media-center`, `knowledge-center`, `civic-nomination`. **Not indexed:** `activity`, `discussion`, `proposal`, `decision` (Activity pipeline), nor the other four old-Stage modules (`collaborative-analysis`, `collective-decision`, `implementation-commitment`, `implementation`).

---

## 9. Test Coverage Matrix

| | Initiative pipeline | Activity pipeline | Older Stage pipeline |
|---|---|---|---|
| **Unit tests** (`apps/api/test/unit`) | **0** | 16 files (activity, discussion, proposal, workspace handlers, shared infra) | **0** |
| **Integration tests** (`apps/api/test/integration`) | **0** | 13 files (create/submit/rollback/workspace-projection per module) | **0** |
| **e2e verification scripts** (`apps/api/src/scripts/verify-*.ts`) | **~45+** (`verify-initiative-e2e`, `verify-decision-session-e2e`, `verify-initiative-collective-decision-e2e`, `verify-initiative-implementation-*`, `verify-initiative-public-impact-*`, `verify-civic-archive-*`, etc.) | **0** | **0** |
| **Architectural validation scripts** | `scripts/verify-barrel-integrity.ts` checks type-barrel export hygiene (includes `implementation`, `implementation-commitment`, `petition`, `collective-decision` barrels) but does not check Initiative-vs-Activity boundaries | Same | Same |
| **Event contract tests** | N/A (no outbox usage) | `event-envelope.test.ts`, `event-serialization.test.ts` — **excluded from `apps/api/tsconfig.json`'s `include`**, so typed ESLint rules cannot resolve against them | N/A |
| **Route/HTTP tests** | **None found anywhere in the repository** — no `supertest` dependency, no `request(app)` pattern. All "integration" tests call service functions directly, not HTTP. | Same | Same |
| **`npm test` (Node's built-in runner) coverage** | **0%** — no reference to "initiative" anywhere in the executed suite | ~100% of implemented modules | **0%** |

**Executed as part of this audit (narrowly scoped, per task instruction to avoid the full verification catalogue):** `node --import tsx --test apps/api/test/unit/activity/create-activity-aggregate.test.ts` → **PASS** (4/4). No equivalent test exists for Initiative aggregate creation to run — confirmed via exhaustive glob search, not merely unexecuted. All other integration tests were not executed as they require a live MongoDB connection.

**Coverage is almost perfectly inverted from usage:** the pipeline the frontend never uses (Activity) has the entire automated regression safety net; the pipeline the frontend fully depends on (Initiative) has none, relying entirely on manually-invoked, non-CI-integrated e2e scripts.

---

## 10. Provisional Module Classification

| Module | Path | Category | Evidence | Affected dependencies | Confidence |
|---|---|---|---|---|---|
| `initiatives` | `apps/api/src/modules/initiatives` | **1 — Canonical Initiative lifecycle component** | Root aggregate; 5 weeks of dedicated build-out; sole entity referenced by 15+ downstream modules, search, notifications, and the live frontend | Every downstream `initiative-*` module | High |
| `initiative-collaborative-analysis`, `initiative-improvement-proposal`, `decision-session`, `initiative-collective-decision`, `initiative-implementation-commitment`, `initiative-implementation-tracking`, `initiative-public-impact`, `initiative-version-revision`, `initiative-comments`, `initiative-comment-reactions`, `initiative-decision-vote`, `initiative-support` | `apps/api/src/modules/initiative-*` | **1 — Canonical Initiative lifecycle component** | All directly or transitively typed to `initiativeId`; enforced eligibility chains; frontend-wired (fully or partially) | Search, notifications, workspace-home, public-initiative-experience | High |
| `activity` | `apps/api/src/modules/activity` | **2 — Potentially reusable Initiative subcomponent** | Well-built transactional-outbox pattern, clean domain/persistence separation, real test coverage; zero product usage today. The *infrastructure* (outbox integration, Mongo persistence pattern, event envelope) is reusable even if the *aggregate root* is not adopted as-is | `workspace` module's canonical projection handlers | Medium |
| `discussion`, `proposal` (Activity-scoped), `decision` | `apps/api/src/modules/{discussion,proposal,decision}` | **6 — Unclear, requires product decision** | Functionally overlaps with `initiative-collaborative-analysis`/`initiative-improvement-proposal`/`initiative-collective-decision`, but is a materially different, simpler data model (no lifecycle eligibility chain). Could be genuinely redundant, or could represent an intentionally lighter-weight "quick civic action" concept the product owner still wants — cannot be inferred from code alone | Outbox infra, workspace canonical projection | Medium |
| `workspace` (canonical, event-driven) | `apps/api/src/modules/workspace` | **5 — Supporting cross-cutting service** (infrastructure) / **6 — Unclear** (whether it should project Initiative events instead of/in addition to Activity events) | Well-architected projection pattern; currently wired only to Activity events and unused by the frontend | `activity`/`discussion`/`proposal`/`decision` events | Medium |
| `workspace-home` | `apps/api/src/modules/workspace-home` | **1 — Canonical Initiative lifecycle component** (functionally) but **4 — Legacy implementation** (per its own `@deprecated` source comment and per `implementation/audits/03_ACTIVITY_CODE_TECHNICAL_AUDIT.md`'s "LEGACY — ISOLATE" classification) | This is the single most product-critical module currently in "deprecated" status — it is what the live frontend actually renders | Every `initiative-*` module it directly reads from | High (on the contradiction; Low on what to do about it) |
| `collaborative-analysis` (old Stage) | `apps/api/src/modules/collaborative-analysis` | **3 — Duplicate implementation** | Duplicates `initiative-collaborative-analysis`'s purpose; both typed to `initiativeId`, both frontend-reachable, one page (`/collaborative-analysis/[id]`) even reads across both | `initiative-collaborative-analysis`, public-experience aggregator | High |
| `collective-decision` (old Stage) | `apps/api/src/modules/collective-decision` | **4 — Legacy implementation** | Generic, untyped `decisionSubjectId` reference to Initiative (weaker integrity than its `initiative-collective-decision` counterpart); no events; no tests; reachable only via hardcoded bootstrap ID | `petition`, `implementation-commitment`, `implementation` (old-Stage cross-references) | Medium-High |
| `petition` | `apps/api/src/modules/petition` | **1 — Canonical Initiative lifecycle component** (sole implementation, strongly typed to Initiative, actively used in the public initiative lifecycle nav) despite living in the "old Stage" folder structure | No competing implementation exists | `implementation-commitment`, `implementation` (old-Stage cross-references), `public-initiative-experience` | Medium (path/location is legacy-looking, but functional role is canonical) |
| `implementation-commitment` (old Stage) | `apps/api/src/modules/implementation-commitment` | **3 — Duplicate implementation** | Duplicates `initiative-implementation-commitment`; both strongly typed to `initiativeId`; old version has real mutation UI, new version has zero UI components | `initiative-implementation-commitment`, `petition`, `collective-decision` | High |
| `implementation` (old Stage) | `apps/api/src/modules/implementation` | **3 — Duplicate implementation** (functionally overlapping with `initiative-implementation-tracking`, though not identically named or shaped) | Strongly typed to `initiativeId`; real achievement/evidence UI; no events, no tests | `implementation-commitment`, `petition`, `collective-decision` | Medium (functional overlap, not exact structural duplicate) |
| `decision` (Activity pipeline) | `apps/api/src/modules/decision` | **6 — Unclear** | Weakest-tested member of the Activity chain (no dedicated test file); smallest surface area; unclear if intended to survive any reconciliation | `proposal`, `workspace` canonical projection | Low |
| Outbox / event-envelope / event-handler-registry infrastructure | `apps/api/src/infrastructure/{outbox,events,integration}` | **5 — Supporting cross-cutting service** | Well-designed, reusable, pipeline-agnostic transactional messaging infrastructure currently used by only one pipeline | Any future event-driven Initiative work would depend on this | High |
| `global-search`, `notifications` | `apps/api/src/modules/{global-search,notifications}` | **5 — Supporting cross-cutting service** | Both independently implement an `entityType → initiativeId` resolution table across every Initiative-scoped module; both are Initiative-only today | Every `initiative-*` module | High |

**Explicit answer to the Activity-reusability question posed by the task:** Activity's *aggregate model* is not currently integrated with Initiative and duplicates ground already covered by `initiative-collaborative-analysis` (its closest functional analogue would be an "Activity as first contribution/interaction record"). However, Activity's **infrastructure** — the transactional outbox pattern, the domain-event envelope with correlation/causation metadata, the idempotent handler-registry dispatch, and its real, working automated test suite — is genuinely reusable engineering investment that the Initiative pipeline currently lacks entirely (the Initiative pipeline's "events" are synchronous, non-transactional, and untested). A reconciliation that discarded Activity's code wholesale would also discard the only proven event-infrastructure pattern in the repository.

---

## 11. Architecture Decision Questions

These are product/architecture decisions that cannot safely be inferred from code alone. None restate the already-settled invariant that Initiative is central.

### Q1 — What should happen to the Activity pipeline's proven event infrastructure?

- **Conflicting implementations:** Activity pipeline uses a transactional outbox + idempotent event dispatch (tested, working). Initiative pipeline uses synchronous, non-transactional, untested `emitCivicNotificationEvent` calls for the equivalent role.
- **Affected modules:** `apps/api/src/infrastructure/{outbox,events,integration}`, all 16 `initiative-*` modules, `workspace`, `workspace-home`, `notifications`.
- **Why the answer matters:** If Initiative should gain real domain events (for reliability, replay, and audit-trail reasons), the Activity pipeline's outbox infrastructure is the only tested implementation to build on — but wiring 16 modules to it is a substantial migration, not a deletion.
- **Options:** (a) Migrate Initiative's notification calls onto the existing outbox infrastructure, retiring the synchronous mechanism; (b) leave Initiative's synchronous mechanism as-is and treat the outbox as Activity-specific legacy to be retired with Activity; (c) run both mechanisms in parallel indefinitely, formally documented as two intentionally different guarantees (fire-and-forget vs. transactional).
- **Safest default (not implemented here):** (c), since it requires no code change and preserves current behavior while a decision is made — but it should be an explicit, documented decision, not silent status quo.

### Q2 — Which "Workspace" endpoint is the real canonical one?

- **Conflicting implementations:** `GET /api/v1/workspace` (source-labeled canonical, Activity-fed, unused by frontend) vs. `GET /api/v1/workspace/home` (source-labeled `@deprecated`, Initiative-fed, exclusively used by frontend).
- **Affected modules:** `apps/api/src/modules/{workspace,workspace-home}`, `apps/web/src/features/workspace-home`.
- **Why the answer matters:** The module currently labeled "legacy" in its own source code is the one carrying 100% of real user-facing Workspace functionality. Removing it per its label, without first migrating the frontend and the Initiative pipeline's data onto the "canonical" endpoint, would break the product.
- **Options:** (a) Re-label `workspace-home` as canonical and retire `workspace` (formalizes present reality); (b) migrate `workspace-home`'s Initiative-sourced data into the `workspace` projection model (keeps the outbox architecture, requires the Q1 migration first); (c) merge both into one endpoint that reads from both pipelines until Q1/Q3 are resolved.
- **Safest default:** (a) in the short term (it matches what users already experience and requires no data migration), while flagging it as provisional pending Q1/Q3.

### Q3 — Should `activity`/`discussion`/`proposal`/`decision` be retired, repurposed, or integrated as Initiative subcomponents?

- **Conflicting implementations:** This four-module chain has zero frontend usage but full test coverage and a working event pipeline; `initiative-collaborative-analysis`/`initiative-improvement-proposal`/`initiative-collective-decision` cover materially the same conceptual ground for the Initiative pipeline.
- **Affected modules:** `apps/api/src/modules/{activity,discussion,proposal,decision}`, their 29 test files, the outbox infrastructure, `workspace`.
- **Why the answer matters:** These modules represent completed, tested engineering effort. Whether that effort is discarded, repurposed (e.g., "Activity" becomes the append-only civic-trace log the Blueprint's own `05_ACTIVITY_ENGINE_SPECIFICATION.md` describes it as — "institutional memory," not a competing anchor), or left dormant has very different cost implications.
- **Options:** (a) Retire the four modules and their routes entirely once Q1 is resolved; (b) repurpose `activity` alone as a non-authoritative, append-only "civic trace" log that Initiative-lifecycle actions write into (matching the Blueprint's original, non-anchor framing of Activity in `05_ACTIVITY_ENGINE_SPECIFICATION.md`), retiring `discussion`/`proposal`/`decision`; (c) leave all four mounted, untouched, and undocumented as intentionally dormant/experimental.
- **Safest default:** (c) for this task's immediate purposes (no code changes were authorized), with (b) flagged as the option most consistent with the Blueprint's own (non-ADR-002) framing of Activity.

### Q4 — Which of the three duplicate "Decision" concepts should the platform standardize on?

- **Conflicting implementations:** `decision` (Activity-scoped, untested, unused), `collective-decision` (old Stage, generic Initiative reference, no events, frontend-reachable via bootstrap ID only), `initiative-collective-decision` (strongly Initiative-typed, richly validated, nav-reachable but read/vote-view only, no vote-casting UI wired despite a working backend endpoint).
- **Affected modules:** all three plus `decision-session`, `initiative-decision-vote`, `petition` (old-Stage `collective-decision` is a prerequisite for old-Stage `petition`), `initiative-implementation-commitment` (Initiative-side prerequisite).
- **Why the answer matters:** These are not interchangeable — old-Stage `collective-decision` and `initiative-collective-decision` have different eligibility rules, different persistence, and different downstream chains (old-Stage feeds old-Stage `petition`; new feeds `initiative-implementation-commitment`). Picking one affects which downstream chain survives.
- **Options:** (a) Standardize fully on `initiative-collective-decision` + `decision-session` (matches the Initiative-anchored invariant and has the richer validation), sunsetting `collective-decision` and `decision`; (b) merge `collective-decision`'s generic multi-subject-type flexibility (it can decide on Candidates/Policies/Programs, not just Initiatives) into the Initiative-typed model as an explicit `subjectType` extension; (c) leave all three active, clearly scoped to different use cases, and document the scoping.
- **Safest default:** (a), since it is the most Initiative-consistent, most validated, and already the one the live product surfaces for reading.

### Q5 — Is the "old Stage" `implementation`/`implementation-commitment` pair a duplicate to retire, or a parallel UI worth keeping?

- **Conflicting implementations:** Both old-Stage modules have real, working mutation UI (contribution items, achievement/evidence recording) that their `initiative-*` counterparts entirely lack (zero components).
- **Affected modules:** `implementation`, `implementation-commitment`, `initiative-implementation-commitment`, `initiative-implementation-tracking`.
- **Why the answer matters:** Retiring the old-Stage pair outright, as a naive "old = legacy = delete" read would suggest, would delete the platform's *only* working implementation-tracking UI (contribution profiles, evidence attachment) — functionality the "canonical" `initiative-*` pair does not yet have a UI for at all.
- **Options:** (a) Port the old-Stage UI components onto the `initiative-implementation-commitment`/`-tracking` data model, then retire the old-Stage backend; (b) keep the old-Stage backend as the interim implementation surface until the Initiative-side UI catches up, then migrate; (c) treat this as two intentionally distinct capabilities (old-Stage = detailed contribution tracking, Initiative-side = summary/reporting) and keep both.
- **Safest default:** (b) — porting UI is lower-risk than porting data models, and it avoids a product regression (loss of the only working contribution UI) while the reconciliation proceeds.

---

## 12. Risks of Immediate Deletion

Deleting any pipeline immediately, without following the sequencing in §14, carries the following concrete risks, evidenced directly by this audit:

1. **Deleting the Activity pipeline** (`activity`/`discussion`/`proposal`/`decision`) would delete the repository's only tested, transactional, event-driven infrastructure pattern (outbox + idempotent dispatch), along with its 29 passing/executable test files — a proven pattern that could otherwise be reused for a future Initiative event system (Q1). It would also delete the sole consumer wiring for the "canonical" `GET /api/v1/workspace` endpoint, though that endpoint currently has no frontend caller regardless.
2. **Deleting `workspace-home`** (per its own `@deprecated` label or the Activity Code Technical Audit's "LEGACY — ISOLATE" classification) **would break the live product immediately** — it is the only Workspace implementation the shipped frontend calls. This is the single highest-risk deletion identified in this audit.
3. **Deleting the old-Stage `implementation`/`implementation-commitment` modules** would delete the platform's only working contribution-tracking and achievement/evidence-recording UI, since their `initiative-*` counterparts have zero UI components today (Q5).
4. **Deleting the old-Stage `petition` module** would delete the platform's only Petition implementation entirely — there is no `initiative-petition` module to fall back to. Petition is currently a single point of failure regardless of reconciliation direction.
5. **Deleting `collaborative-analysis` or `collective-decision` (old Stage)** without first confirming no other module (e.g., `implementation-commitment`'s `assertApprovedCollectiveDecision` chain) still depends on them at runtime would break the old-Stage chain's remaining, frontend-reachable stages (`petition`, `implementation-commitment`, `implementation`), since those explicitly call into `collective-decision.store.ts`/`petition.store.ts` via direct in-process function calls, not HTTP.
6. **Deleting any Initiative-pipeline module** without first migrating `global-search` and `notifications`, which both hard-code an `entityType → initiativeId` resolution table enumerating every one of these modules by name, would silently break search indexing and steward notifications for the remaining modules (a partial-deletion, not just a full-pipeline-deletion, risk).
7. Across the board: **no module in this repository is protected by database foreign keys**. Every "referential integrity" check is an application-layer `getXById()` call. Deleting a module removes the function it exports, which will throw a runtime `undefined is not a function`-class error in every caller at request time, not a build-time or migration-time error — meaning partial deletions are highly likely to surface as production incidents rather than being caught by `pnpm typecheck` or `pnpm build`.

---

## 13. Risks of Leaving All Pipelines Active

1. **User-facing data loss/invisibility, ongoing.** As documented in §8, any civic action a member takes via the Activity pipeline today is written to Mongo but never seen by that member (the UI reads the Initiative-fed `workspace-home` endpoint exclusively). This is a live, present-tense product defect, not a future risk.
2. **Search and notification blind spots persist.** Activity-pipeline actions are invisible to `global-search` and generate no notifications; a member cannot discover or be notified about content created through that pipeline, indefinitely, as long as it remains mounted but unintegrated.
3. **Continued engineering cost with no corresponding product value.** ~45+ Initiative `verify-*.ts` scripts and 29 Activity `npm test` files must both continue to be maintained/kept green through future refactors, doubling maintenance surface for conceptually overlapping functionality, with no automated safety net for the pipeline (Initiative) actually used by the product.
4. **Governance and documentation debt compounds.** `governance/02_DOCUMENTATION_UPDATE_PLAN.md` already flags 268 unreconciled documents on a 4–6 month plan; every additional sprint of parallel development in both pipelines before that plan executes increases the size of the eventual reconciliation, and increases the chance that new code is written against the wrong (soon-to-be-superseded) model by contributors who read Corpus B's documentation in good faith.
5. **Referential-integrity drift risk grows.** With three "Decision" implementations, two "Analysis" implementations, and two "Proposal" implementations, contributors risk wiring new features to the wrong one (e.g., a new feature reading `decisionId` might silently target the wrong of three backing stores, compiling successfully since all use plain `string` typing in several places — e.g. `collective-decision`'s untyped `decisionSubjectId`).
6. **The self-certifying alignment reports create false confidence.** `ENGINEERING_DOCUMENTATION_ALIGNMENT_REPORT_v1.0.md` and `ENGINEERING_ARCHITECTURE_CONSISTENCY_REVIEW.md` currently claim "0 Terminology conflicts" and "CERTIFIED" status while a first-order contradiction (ADR-002 vs. Ubiquitous Language's own Concept Evolution table) sits uncaught in the same document set — leaving both pipelines active without correcting these certifications risks contributors trusting a certification that has already been shown, by this audit, to be inaccurate.
7. **Two co-existing "civic anchor" claims in onboarding material** (Blueprint says Initiative is canonical in some chapters, Activity in others) risks inconsistent mental models across current and future contributors, slowing future development regardless of which pipeline is ultimately kept.

---

## 14. Recommended Order for Future Reconciliation

*(Sequencing only — no implementation performed as part of this report.)*

1. **Resolve the documentation contradiction first, via the repository's own governance process.** File a superseding ADR (e.g., ADR‑011) that explicitly supersedes ADR‑002, citing: the chronological precedence of the Initiative implementation; the internal contradiction between ADR‑002 and `engineering/00_UBIQUITOUS_LANGUAGE.md`'s Concept Evolution table; and the product owner's directive. This satisfies the ADR registry's own "Explicit Supersession" rule and the Documentation Update Plan's rule #7 ("ADR before structural change... Initiative write model").
2. **Fix the Workspace routing contradiction (Q2) before touching any pipeline code.** This is the only item in this report with an active, present-tense user-facing defect (§13.1). At minimum, re-point the frontend or re-label which endpoint is "canonical" so the source-code comments match observed reality — this alone requires no data migration.
3. **Resolve Q4 (Decision duplication) and Q1 (event infrastructure) together**, since standardizing on `initiative-collective-decision`/`decision-session` as the canonical Decision path is the natural point to also decide whether that path gains the Activity pipeline's tested outbox infrastructure, rather than doing two separate migrations later.
4. **Port the old-Stage Implementation UI (Q5) onto the Initiative-side data model** before deprecating the old-Stage `implementation`/`implementation-commitment` backends, to avoid a product regression (loss of the only working contribution/evidence UI).
5. **Consolidate the two "Analysis" implementations** (`collaborative-analysis` vs. `initiative-collaborative-analysis`) once the frontend page that currently reads across both (`/collaborative-analysis/[id]`) is repointed exclusively to the Initiative-typed one.
6. **Decide Q3 (Activity/Discussion/Proposal/Decision fate) last**, once Q1 and Q4 have already determined whether any of that pipeline's infrastructure or data model will be reused — this avoids prematurely deleting code that Q1/Q4 might otherwise decide to repurpose.
7. **Only after 1–6 are decided and implemented**, update `governance/00_DOCUMENTATION_AUDIT.md` and execute (or re-scope) the already-planned Wave 3 ("Capabilities... batch by domain") of `governance/02_DOCUMENTATION_UPDATE_PLAN.md`, so that documentation changes follow implementation reality rather than preceding it a second time (which is how the current contradiction was created).
8. **Re-run (and fix the false-positive result of) the self-certifying alignment reports** (`ENGINEERING_DOCUMENTATION_ALIGNMENT_REPORT`, `ENGINEERING_ARCHITECTURE_CONSISTENCY_REVIEW`) only at the end, once the underlying contradictions they failed to catch have actually been resolved, so the next certification is accurate rather than repeating the current false "0 conflicts" result.

---

## Appendix — Investigation Methodology

This report was produced by a combination of direct primary-source inspection (git history, `Read`/`Grep` across `packages/types`, `apps/api/src`, `apps/web/src`, and every documentation folder listed in the task) and six parallel, independently-verified research passes covering: (1) documentation authority and git chronology, (2) Initiative end-to-end code trace, (3) Activity and older Stage pipeline trace, (4) frontend exposure classification, (5) event and projection trace, (6) test and validation coverage. All findings are cross-corroborated between at least two independent sources (primary-source reads by the lead investigator and/or multiple research passes) except where explicitly marked single-source. One narrowly-scoped, low-risk unit test (`create-activity-aggregate.test.ts`) was executed to confirm a factual claim about test-runner configuration; no test requiring live MongoDB/SMTP infrastructure was executed, per task instruction to avoid the full verification catalogue.
