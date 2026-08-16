# PROJECT_STATE

Humanity Union

Project State

Version 1.1

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

4.0+ (staging launch-ready baseline + Admin + historical migration tooling)

---

# Current Focus

**Last completed (tooling):** STAGING HISTORICAL DATA RECONCILIATION PACK 04 (dry-run + Web media harden; real `--execute` not run in Cursor task)

**Next:** Operator execute Pack 04 on staging (`reconcile:staging-historical-data -- --execute` in **RENDER API WEB SHELL**), then `pnpm verify:staging`.

See `project/NEXT_SESSION.md`.

Do not start a new migration Pack until Pack 04 execute + verify are complete.

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

**Repository-verifiable** means present in git (modules, tests, docs, commits). Does not by itself prove live staging `--execute` outcomes.

| Track | Repo evidence (examples) |
|-------|---------------------------|
| Admin Foundation Pack 02 | `project/architecture/administration/CANONICAL_CAPABILITY_RESOLVER.md`, admin foundation tests |
| Admin Console Packs 03–05 | Admin Panel features + `admin-panel-pack05` / initiative visibility tests; commits through `521f201` |
| Staging Data Migration Packs 01–02 / 02A | `architecture/recovery/STAGING_DATA_MIGRATION_*`, `staging-data-source-v1/`, `apps/api/src/modules/staging-data-migration/` |
| Staging Media Pack 03 | `architecture/recovery/STAGING_MEDIA_*`, `staging-media-source-v1/`, `apps/api/src/modules/staging-historical-media/` |
| Staging baseline | `5954d54` STAGING BASELINE; ops doc `project/architecture/operations/STAGING_DEPLOYMENT_VERIFICATION_v1.0.md` |

---

# Staging data — OPERATOR-VERIFIED facts

The following are **operator-verified** staging outcomes (explicitly distinguished from pure repository evidence). Treat as live staging facts for planning; re-verify in Pack 04 where needed.

- Admin Panel Pack 05 was committed and pushed.
- Historical staging data migration `--execute` completed successfully.
- Four historical Participants were added; staging admin remained protected.
- Five historical Initiatives were added.
- Historical Vlad Gmail remains a **separate** Participant from staging-admin Vlad HUWS.
- Isabella’s Initiative is intentional working/test data (not disposable).
- CSS is regional (British Columbia / Canada; `participationScope: region`), not World scope.
- Historical Initiative media and four Participant avatars were uploaded to Cloudflare R2.
- A second media migration dry-run reported canonical skips (`skip_already_canonical`) and zero conflicts.

Identity / civic sources (repo design): historical identity Mongo `humanity_union_dev`; civic portable bundle `architecture/recovery/staging-data-source-v1/`; media bundle `architecture/recovery/staging-media-source-v1/`; target DB `humanity_union_staging`.

---

# Staging — Pack 04 reconciliation status

**Repository-verifiable**

- Portable bundle: `architecture/recovery/staging-reconciliation-source-v1/` (comments 10, comment reactions 12, analysis reactions 1, support registered 9, visitor 15, bookmarks 1, views 196; auth metadata without hashes)
- Commands: `pnpm reconcile:staging-historical-data`, `pnpm verify:staging`
- Assessment: `architecture/recovery/STAGING_RECONCILIATION_ASSESSMENT_v1.0.md`
- Web: InitiativeImage fallback reset + localhost media rejection on staging/production hosts

**Operator execute still required for**

- Restoring historical bcrypt hashes + email verified from `humanity_union_dev` (not committed to Git)
- Inserting engagement history into `humanity_union_staging`

---

# Staging — OPERATOR-OBSERVED unresolved issues

Label: **operator-observed until verified by the next engineering Pack**.

1. Initiative images still do not display correctly in the actual Web UI.
2. Historical Participants cannot currently log in.
3. Historical comments and likes/dislikes/support history are not restored.
4. Remaining historical data needs **canonical reconciliation** rather than bulk-copying obsolete parallel civic roots (Activity/Discussion/Proposal/Decision as roots).

---

# Active Epic / Guide

None as Cap-02 Guide cycle.

Current engineering cycle type: **Staging Pack** (reconciliation), not Epic Guide.

---

# Immediate Objective

See `project/NEXT_SESSION.md` — **STAGING HISTORICAL DATA RECONCILIATION PACK 04**.

---

# Long-Term Objective

Preserve Initiative-centric Participation architecture.

Evolve via `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md`.

Production cutover remains a later ops track — not the current Pack 04 focus.

---

# Rule

`PROJECT_STATE.md` must always reflect the actual state of the platform.

A stale live-state document must not override a normative ADR.

If this document becomes outdated, update it before new implementation begins.
