# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Production Completion Pack 02B** (Language Registry **COMPLETE**), with **Pack 02C** as the next implementation task. Primary engineering branch for ongoing work: follow `git branch --show-current` (often `main` or `staging`); **repository evidence wins** over stale narrative docs.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture**.
5. **Exact next task:** **Pack 02C — Locale Preference & Runtime** (guest cookie, precedence, `lang`/`dir`, browser locale → preference → Registry).
6. **Deeper architecture:** ADR registry `architecture/ARCHITECTURE_DECISION_RECORDS.md`; Initiative-root ADR; Development Baseline; Language Architecture `project/architecture/core/LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md`; Pack 02A summary `architecture/recovery/PRODUCTION_COMPLETION_PACK_02A_MULTILINGUAL_AUDIT_v1.0.md`; AI recovery kit `architecture/recovery/chat-agent/README.md`.
7. When docs conflict with code/git/operator-verified facts, **repository evidence wins** — then synchronize documentation.
8. **Never commit** secrets, credentials, connection strings, or private migration manifests (including `production-admin-source.json`).

AI recovery entry (read after this file’s “Immediate Objective”): `architecture/recovery/chat-agent/README.md`

---

## Purpose

Canonical live engineering handoff for Humanity Union.

Durable detailed state: `project/PROJECT_STATE.md`
Concise status: `project/PROJECT_DASHBOARD.md`
Chronology: `project/WORK_LOG.md`

---

## Last Completed

### Production Completion Pack 02B — Language Registry (COMPLETED)

- Mongo-backed Admin Language Registry (seeds `en`, `uk`, `zh-Hant`, `ar`).
- Bootstrap seed + locale/alias integrity; public + Admin read APIs.
- Runtime consumers migrated: `/translations/languages`, preferences, Translate Draft.
- Admin write APIs (POST/PATCH) with English/fallback/feature-flag invariants + audit.
- Admin → **Languages** UI (`/admin/languages`) backed exclusively by Registry APIs.
- Adding a supported language is now an Admin operation, not a deploy-bound catalog change.

### Production Completion Pack 02A — Multilingual Architecture Audit (COMPLETED)

- READ-ONLY architecture audit of language/translation/search/SEO surfaces.
- Approved direction: Admin-managed Language Registry → UI i18n → cached civic translations → multilingual search → glossary → multilingual SEO.
- Summary: `architecture/recovery/PRODUCTION_COMPLETION_PACK_02A_MULTILINGUAL_AUDIT_v1.0.md`

### Production Completion Pack 01 / 01.1 (COMPLETED)

- Admin authenticated diagnostics health; Initiative integrity + Outbox + services healthy on staging after cleanup.
- Lifecycle reconciliation diagnostic: **Not available** (neutral / CLI-only — not a health failure).
- Support hero illustration display sizing; ACTUC mobile identity row; country hero + media max 6; Account five tiles; Editor `PUBLISHING_EDIT` dual-auth bridge; production config checklist.
- Staging bootstrap Initiative `initiative-bootstrap-001` cleaned; seed gate skips re-seed when `PLATFORM_MODE=staging|production`.
- Staging historical failed Outbox recovery operator path completed.
- Production checklist: `docs/operations/production-configuration-checklist-pack01.md`

### Prior production / staging foundation (COMPLETED — verified in repo)

- Platform **4.0** Initiative-centric architecture; production platform operational (auth, MongoDB, R2, email, Stripe — secrets not documented here).
- Production / staging separation; public registration enabled in **production** via env (`PLATFORM_MODE=production`, `ALLOW_PUBLIC_REGISTRATION=true`, Web `NEXT_PUBLIC_PLATFORM_MODE=production`).
- Production initiative migration, blog migration, canonical production participants / steward / admin identity bootstrap tracks completed in repo history.
- Member Number / Membership / Member Badge architecture present.
- Historical staging recovery Packs 01–05: **CLOSED** (approved scope).
- Initiative Lifecycle Finalization Phases (including Phase 05/05A certification work) landed in product history; not the current open Pack.

---

## Immediate Objective

**Implement Production Completion Pack 02C** — Locale Preference & Runtime.

Deeper Pack 02 sequence (approved):

| Pack | Focus |
|------|--------|
| 02A | Architecture Audit — **COMPLETED** |
| 02B | Language Registry — **COMPLETED** |
| 02C | Locale preference / runtime (guest cookie, precedence, `lang`/`dir`) ← **NEXT** |
| 02D | UI i18n foundation |
| 02E | UI key extraction |
| 02F | Canonical terminology glossary |
| 02G | Civic/public translation expansion + async warming |
| 02H | Multilingual search |
| 02I | Multilingual SEO |
| 02J | RTL hardening + rollout verification |

Long-term invariant: **adding a supported language is an Admin operation**, not a software-development task per language.

---

## Open Items (not Pack 02C)

| ID | Item | Status / constraint |
|----|------|---------------------|
| O1 | **Production** bootstrap Initiative `initiative-bootstrap-001` deletion | OPEN — known historical test data. Staging cleanup **intentionally refuses production**. Requires a **separately authorized production-safe procedure**. Do not weaken staging guards. |
| O2 | Mobile PWA regression diagnosis | OPEN — architecture previously worked on staging; diagnose regression. **Not** a PWA redesign. |
| O3 | Search-engine favicon | OPEN — read-only production favicon/crawler/metadata audit first. Do not generate a replacement image without evidence. |
| O4 | Multilingual Packs 02D–02J | OPEN — sequenced after 02C. |

---

## Documentation Gate

Before declaring any Pack CLOSED: update this file, `PROJECT_STATE.md`, `PROJECT_DASHBOARD.md`, and `WORK_LOG.md` so the next agent can start without rediscovery.
