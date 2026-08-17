# PROJECT_STATE

Humanity Union

Project State

Version 1.2

---

# Purpose

This document represents the current engineering state of the Humanity Union platform.

It is the authoritative **summary** of platform progress for live work.

It must be updated after every completed Guide or Pack (current-focus / last-completed at minimum).

Canonical next-task handoff: `project/NEXT_SESSION.md`
AI recovery entry: `architecture/recovery/chat-agent/README.md`

---

# Platform

Name:

Humanity Union

Development Stage:

Staging environment active; production cutover not the current focus

Architecture Status:

Stable — Initiative is the sole canonical civic root (Accepted ADR)

Engineering Status:

Operational

Primary branch:

`staging`

---

# Current Version

Platform Version:

4.0+ (staging launch-ready baseline + Admin + closed historical recovery scope Packs 01–05)

---

# Current Focus

**Last completed:** INITIATIVE LIFECYCLE FINALIZATION — PHASE 04 (Uniform Author workflow)

**Next:** INITIATIVE LIFECYCLE FINALIZATION — PHASE 05

Report: `architecture/recovery/INITIATIVE_LIFECYCLE_FINALIZATION_PHASE_04_REPORT_v1.0.md`

Recovery Packs 01–05 remain **CLOSED**.

See `project/NEXT_SESSION.md`.

---

# Architecture baseline (normative pointers)

- Initiative sole civic root: `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`
- Recovered baseline: `architecture/recovery/RECOVERY_STATUS.md`
- Development rules: `architecture/DEVELOPMENT_BASELINE.md`
- Lifecycle / Author Mode: `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md`
- Forward plan: `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md`

Superseded: ADR-002 (Activity as universal starting object) — historical only.

---

# Completed Capability Epics (foundation)

Capability 01

✓ Epic 01 Authentication
✓ Epic 02 Member Profile
✓ Epic 03 Member Preferences

Capability 02

✓ Epic 01 Initiative Foundation
✓ Epic 02 Collaborative Analysis
✓ Epic 03 Collective Decision Framework

---

# Recent Pack tracks (repository-verifiable)

**Repository-verifiable** means present in git (modules, tests, docs, commits). Does not by itself prove live staging outcomes.

| Track | Repo evidence (examples) |
|-------|---------------------------|
| Admin Foundation Pack 02 | `project/architecture/administration/CANONICAL_CAPABILITY_RESOLVER.md`, admin foundation tests |
| Admin Console Packs 03–05 | Admin Panel features + `admin-panel-pack05` / initiative visibility tests |
| Staging Data Migration Packs 01–02 / 02A | `architecture/recovery/STAGING_DATA_MIGRATION_*`, `staging-data-source-v1/`, `apps/api/src/modules/staging-data-migration/` |
| Staging Media Pack 03 | `architecture/recovery/STAGING_MEDIA_*`, `staging-media-source-v1/`, `apps/api/src/modules/staging-historical-media/` |
| Staging Reconciliation Packs 04–05 | `staging-reconciliation-source-v1/`, `apps/api/src/modules/staging-reconciliation/`, Pack 05 assessment |
| Staging baseline | ops doc `project/architecture/operations/STAGING_DEPLOYMENT_VERIFICATION_v1.0.md` |

---

# Historical staging recovery — CLOSED (approved scope)

**Status:** **CLOSED** for the currently approved canonical recovery scope completed through Packs **01–05**.

This does **not** claim every possible legacy record in `humanity_union_dev` was migrated.

**Still excluded** (unless a future architecture decision says otherwise):

- Activity / Discussion / Proposal / Decision as parallel civic roots
- Bulk migration as the default strategy

Identity / civic sources (repo design): historical identity Mongo `humanity_union_dev`; civic portable bundle `architecture/recovery/staging-data-source-v1/`; media bundle `architecture/recovery/staging-media-source-v1/`; reconciliation bundle `architecture/recovery/staging-reconciliation-source-v1/`; target DB `humanity_union_staging`.

---

# Staging — OPERATOR-VERIFIED facts (final recovery verification)

Final command: `pnpm verify:staging -- --check-media-http` → **result: PASS**

Operator also manually confirmed deployed functionality is installed and working.

| Area | Verified |
|------|----------|
| Pack 05 deployed + reconcile `--execute` | yes |
| participants / loginReady | 5 / 5 (historical Participants login-ready) |
| initiativesPublic / initiativesTotal | 5 / 6 |
| engagement (snapshot) | comments 10; commentReactions 13; supportSignals 13; bookmarks 1; views 211 |
| proposals / proposalsPublicCounted | 3 / 0 (drafts correctly excluded from public count) |
| integrity | brokenStewards 0; brokenInitiativeAncestry 0; brokenMediaUrls 0; unreachableMedia 0; authIntegrityIssues 0; reconciliationConflicts 0 |
| Web media / cards | webInitiativeImages PASS; participantAvatars PASS; initiativeMediaRendering PASS; initiativeCardNavigation PASS |
| Allies | allies 6; activeAllies 5; brokenAllyParticipants 0; brokenAllyInitiatives 0 |
| Collaboration | collaborationMessages 4; collaborationSessions 0 |
| RSS | rssSources 16; publicNewsArticles **54** (snapshot only); rssFeedAvailable PASS |
| Staging API | `NEWS_PROVIDER_ENABLED=true`; RSS ingestion operational |
| Historical login keys | historical_vlad / michael / derek / isabella — all login-ready |

Also retained from earlier operator-verified migration:

- Staging admin remained protected; historical Vlad Gmail ≠ staging-admin Vlad HUWS
- Five historical Initiatives; Isabella’s Initiative is intentional working/test data
- CSS is regional (British Columbia / Canada), not World scope
- Historical Initiative media and Participant avatars on Cloudflare R2

---

# Active Epic / Guide

None as Cap-02 Guide cycle.

Current engineering cycle type: **Initiative Lifecycle Finalization** (Phase 01 audit complete; Phase 02 next).

Lifecycle system status (Phase 01): capabilities present; staging convergence **not** certified. Experience projection fragile; local≠staging persistence behavior.

---

# Immediate Objective

See `project/NEXT_SESSION.md` — **INITIATIVE LIFECYCLE FINALIZATION — PHASE 02**.

Finalization audit: `architecture/recovery/INITIATIVE_LIFECYCLE_FINALIZATION_AUDIT_v1.0.md`.

---

# Long-Term Objective

Preserve Initiative-centric Participation architecture.

Evolve via `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md`.

Production cutover remains a later ops track — not the current Lifecycle UX audit focus.

---

# Rule

`PROJECT_STATE.md` must always reflect the actual state of the platform.

A stale live-state document must not override a normative ADR.

If this document becomes outdated, update it before new implementation begins.
