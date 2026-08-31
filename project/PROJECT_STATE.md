# PROJECT_STATE

Humanity Union

Project State

Version 2.0

---

# Purpose

This document represents the **durable detailed engineering state** of the Humanity Union platform.

It is authoritative for **where the platform is**, not for day-to-day task micro-steps.

Canonical next-task handoff: `project/NEXT_SESSION.md`
Concise status view: `project/PROJECT_DASHBOARD.md`
Chronology: `project/WORK_LOG.md`
AI recovery entry: `architecture/recovery/chat-agent/README.md`

---

# Platform

Name: Humanity Union

Development Stage: **Production operational** + staging environment for pre-production verification

Architecture Status: Stable — Initiative is the sole canonical civic root (Accepted ADR)

Engineering Status: Operational

Platform Version: **4.0** (Initiative-centric civic architecture)

Primary engineering branch: follow `git branch --show-current` (repository evidence). Live handoff always in `NEXT_SESSION.md`.

---

# Current Focus

**Production Completion Pack 02 — Multilingual Platform Architecture**

| Sub-pack | Status |
|----------|--------|
| **02A** Architecture Audit | **COMPLETED** |
| **02B** Language Registry | **COMPLETED** + staging **PASS** |
| **02C** Locale Preference & Runtime | **COMPLETED** + staging **PASS** |
| **02D** UI i18n Foundation | **COMPLETED** + staging **PASS** |
| **02E** UI Key Extraction | **COMPLETED** + staging **PASS** |
| 02F–02J | Sequenced after 02E (02F NEXT) |

See `project/NEXT_SESSION.md` for the exact next implementation objective.

Last completed product track milestone: **Pack 02E** (UI key extraction COMPLETE + STAGING PASS; verification locales en / uk / zh-Hant / ar; Edit Profile residual fixed in `2e27b27`; Registry restored en only).

---

# Architecture baseline (normative pointers)

- Initiative sole civic root: `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`
- Recovered baseline: `architecture/recovery/RECOVERY_STATUS.md`
- Development rules + **Documentation Gate**: `architecture/DEVELOPMENT_BASELINE.md`
- Lifecycle / Author Mode: `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md`
- Language & translation (content vertical slice + Pack 02 direction): `project/architecture/core/LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md`
- Pack 02A audit summary: `architecture/recovery/PRODUCTION_COMPLETION_PACK_02A_MULTILINGUAL_AUDIT_v1.0.md`
- Forward plan: `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md`
- ADR index: `architecture/ARCHITECTURE_DECISION_RECORDS.md`

Superseded: ADR-002 (Activity as universal starting object) — historical only.

---

# Production / staging topology (NON-SECRET)

| Concern | State |
|---------|--------|
| Production platform | Operational (auth activated; MongoDB; Cloudflare R2 media; email; Stripe membership/badge flows) |
| Staging | Separate DB / services for verification; do not treat as production |
| Public registration (production) | Enabled via API `PLATFORM_MODE=production` + `ALLOW_PUBLIC_REGISTRATION=true`; Web `NEXT_PUBLIC_PLATFORM_MODE=production` (rebuild required for Web env) |
| Indexing | Controlled by Web `NEXT_PUBLIC_PLATFORM_MODE` + site origin; see `docs/operations/production-configuration-checklist-pack01.md` |
| Secrets | Never document connection strings, API keys, passwords, or private manifests here |

Identity model: **Participant-first**; Member is earned/honorary eligibility (Member Number / Membership / Member Badge present in architecture).

Civic model: **Initiative** is the sole canonical civic root; lifecycle profiles (STANDARD / PUBLIC_CHOICE) select routes through one Lifecycle Engine.

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

(Further Cap-02 lifecycle stages and public experience packs exist in repository history; see WORK_LOG and capability docs.)

---

# Recent Pack tracks (repository-verifiable)

| Track | Status |
|-------|--------|
| Historical staging recovery Packs 01–05 | **CLOSED** (approved scope) |
| Production identity / steward / admin bootstrap | Completed in repo history |
| Production blog migration | Completed in repo history |
| Production initiative migration | Completed in repo history |
| Production Completion Pack 01 | **COMPLETED** |
| Pack 01.1 Diagnostics Cleanup (staging bootstrap + diagnostics semantics) | **COMPLETED** |
| Staging historical Outbox recovery operator | **COMPLETED** |
| Production Completion Pack 02A Multilingual Audit | **COMPLETED** |
| Production Completion Pack 02B Language Registry | **COMPLETED** + staging acceptance **PASS** |
| Production Completion Pack 02C Locale Preference & Runtime | **COMPLETED** + staging acceptance **PASS** |
| Production Completion Pack 02D UI i18n Foundation | **COMPLETED** + staging acceptance **PASS** |
| Production Completion Pack 02E UI Key Extraction | **COMPLETED** + staging acceptance **PASS** |

---

# Historical staging recovery — CLOSED (approved scope)

**Status:** **CLOSED** for the approved canonical recovery scope through Packs **01–05**.

Still excluded unless a future architecture decision says otherwise:

- Activity / Discussion / Proposal / Decision as parallel civic roots
- Bulk migration as the default strategy

---

# Multilingual — current capability (honest)

**Present (reusable):**

- Admin-managed Language Registry (Mongo + Admin UI `/admin/languages`)
- `content_translations` side-store (canonical source never overwritten)
- `TranslationProvider` seam (`deterministic` / `gemini`)
- Participant prefs: interface / reading / writing / translation display preference
- Pack 02C: canonical runtime locale resolution; SSR `lang`/`dir`; `hu_lang`; global Language Selector; auth preference ↔ cookie sync
- Pack 02D COMPLETE + STAGING PASS: `next-intl` UI i18n foundation; Pack 02C sole locale authority; server-resolved `html` `lang`/`dir`; English canonical bundled catalog; verification catalogs `en`/`uk`/`zh-Hant`/`ar`; English deep-merge fallback; inactive remote message-pack seam; catalog parity guard
- Pack 02D foundation chrome: Language Selector label/loading/error; primary desktop/mobile Home / Institutions / Initiatives; Footer Support
- Pack 02D staging: en/uk/zh-Hant/ar smoke PASS; zh-TW→zh-Hant canonicalize; RTL ar; non-locale-prefixed URLs; Registry-driven option names; disabled write 400; Registry restored en-only
- Pack 02D build hotfix: `@parcel/watcher` + `@swc/core` explicitly approved in `pnpm-workspace.yaml` `allowBuilds` (strict policy preserved)
- RTL helpers (`ar`, `he`); logical CSS migration incomplete (Pack 02J); selector chevron padding under `dir=rtl` only
- Hardcoded priority language catalog retained as legacy compatibility only (runtime uses Language Registry)

**Not present yet:**

- Broad UI chrome key migration (Pack 02E) — **COMPLETED** + staging **PASS** (public nav/footer + shared common/a11y + auth + workspace/account shell; Edit Profile residual `2e27b27`; Registry restored en only)
- Lifecycle-stage / civic body / Notification Center empty-state / Blog navLabel API redesign / role·status enum maps — deferred beyond 02E
- Pack 02F Canonical Terminology Glossary — **NEXT**
- Admin-managed remote UI message packs / R2 persistence
- Admin platform-default-language setting (currently `DEFAULT_PLATFORM_LANGUAGE` = `en`)
- Multilingual search
- Locale SEO / hreflang

---

# Open items

| Item | Notes |
|------|--------|
| Pack 02E UI Key Extraction | **COMPLETED** + staging **PASS** |
| Pack 02F Canonical Terminology Glossary | **NEXT** |
| Pack 02G–02J | Multilingual sequence after 02F |
| Pack 02B / 02C / 02D / 02E staging acceptance | **PASS** |
| Production `initiative-bootstrap-001` | Pending **production-authorized** cleanup; staging tool refuses production by design |
| Mobile PWA regression | Diagnosis only — not a redesign |
| Search-engine favicon | Read-only audit first |
| AI provider configuration | Optional |

---

# Long-Term Objective

Preserve Initiative-centric Participation architecture.

Deliver multilingual platform capability so **Administrators can add languages without code changes**, while English remains the durable fallback and canonical civic content remains immutable under translation.

Evolve via `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md` and Pack 02 sequence in `NEXT_SESSION.md`.

---

# Documentation Gate

Every completed Pack/Epic must evaluate updates to NEXT_SESSION, PROJECT_STATE, PROJECT_DASHBOARD, WORK_LOG, and ADRs when decisions change. See `architecture/DEVELOPMENT_BASELINE.md` § Documentation Gate.

---

# Rule

`PROJECT_STATE.md` must always reflect the actual state of the platform.

A stale live-state document must not override a normative ADR.

If this document becomes outdated, update it before new implementation begins.

Repository evidence wins over stale narrative documentation.
