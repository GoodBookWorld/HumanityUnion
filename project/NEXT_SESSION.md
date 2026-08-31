# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Production Completion Pack 02C COMPLETE** (Locale Preference & Runtime). Primary engineering branch for ongoing work: follow `git branch --show-current` (often `main` or `staging`); **repository evidence wins** over stale narrative docs.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture**.
5. **Exact next task:** **Production Completion Pack 02D — UI i18n Foundation** (message catalogs / next-intl or approved equivalent; do not invent a second locale-resolution path — reuse Pack 02C runtime locale).
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

### Production Completion Pack 02C — Locale Preference & Runtime (COMPLETED locally)

Tasks 01–04 delivered as one coherent system:

- Canonical `resolveRuntimeLocaleFromCatalog` (`@hu/types`) shared by API + Web SSR.
- API request locale (`resolveRuntimeLocaleForRequest` / `GET /api/v1/runtime-locale`).
- Web SSR `<html lang>` / `dir` before paint; no client `documentElement` lang/dir mutation.
- Web-origin `hu_lang` cookie + `POST /api/hu-lang` (Registry validate/canonicalize).
- Global Language Selector; authenticated `interfaceLanguage` authority + cookie sync; login sync latch.
- Local acceptance tests A–F pass. **Staging smoke still required after commit/promotion.**

### Production Completion Pack 02B — Language Registry (COMPLETED)

- Admin-managed Language Registry + Admin Languages UI.

### Production Completion Pack 02A — Multilingual Architecture Audit (COMPLETED)

- Summary: `architecture/recovery/PRODUCTION_COMPLETION_PACK_02A_MULTILINGUAL_AUDIT_v1.0.md`

---

## Immediate Objective

**Implement Production Completion Pack 02D** — UI i18n Foundation.

Reuse Pack 02C resolved locale (`lang`/`dir` / `hu_lang` / Participant `interfaceLanguage`). Do not add locale-prefixed URLs, SEO routing, or auto-enable seed languages in 02D unless separately specified.

Deeper Pack 02 sequence (approved):

| Pack | Focus |
|------|--------|
| 02A | Architecture Audit — **COMPLETED** |
| 02B | Language Registry — **COMPLETED** |
| 02C | Locale preference / runtime — **COMPLETED** (local; staging smoke pending) |
| 02D | UI i18n foundation ← **NEXT** |
| 02E | UI key extraction |
| 02F | Canonical terminology glossary |
| 02G | Civic/public translation expansion + async warming |
| 02H | Multilingual search |
| 02I | Multilingual SEO |
| 02J | RTL hardening + rollout verification |

Long-term invariant: **adding a supported language is an Admin operation**, not a software-development task per language.

---

## Open Items (not Pack 02D)

| ID | Item | Status / constraint |
|----|------|---------------------|
| O1 | **Production** bootstrap Initiative `initiative-bootstrap-001` deletion | OPEN — known historical test data. Staging cleanup **intentionally refuses production**. Requires a **separately authorized production-safe procedure**. Do not weaken staging guards. |
| O2 | Mobile PWA regression diagnosis | OPEN — architecture previously worked on staging; diagnose regression. **Not** a PWA redesign. |
| O3 | Search-engine favicon | OPEN — read-only production favicon/crawler/metadata audit first. Do not generate a replacement image without evidence. |
| O4 | Multilingual Packs 02E–02J | OPEN — sequenced after 02D. |
| O5 | Pack 02C staging smoke | OPEN — after commit/promotion; see WORK_LOG / Task 04 checklist. |

---

## Documentation Gate

Before declaring any Pack CLOSED: update this file, `PROJECT_STATE.md`, `PROJECT_DASHBOARD.md`, and `WORK_LOG.md` so the next agent can start without rediscovery.
