# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Production Completion Pack 02D COMPLETE locally** (UI i18n Foundation). Staging smoke for Pack 02D is still required before claiming staging PASS. Primary engineering branch: follow `git branch --show-current`; **repository evidence wins**.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture**.
5. **Exact next task (after Pack 02D staging acceptance):** **Production Completion Pack 02E — UI Key Extraction**. Until staging smoke for 02D chrome is done, prefer that verification before starting broad extraction.
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

### Production Completion Pack 02D — UI i18n Foundation (COMPLETE locally; staging smoke PENDING)

Tasks 01–04 accepted as one coherent foundation:

- **Task 01:** `next-intl` on `@hu/web`; Pack 02C `resolveDocumentHtmlLocale` sole locale authority; bundled catalogs + remote-pack seam (inactive).
- **Task 02:** Language Selector `common.language`; primary desktop/mobile nav Home / Institutions / Initiatives.
- **Task 03:** Footer Support; selector loading/error; bundled verification catalog parity guard.
- **Task 04:** Local acceptance close-out green (architecture / surfaces / catalogs / scope). **Do not claim Pack 02D staging PASS.**

`main` changes remain **local / uncommitted / not pushed**.

### Production Completion Pack 02B + 02C — Staging Acceptance PASS

- Pack **02B** / **02C** staging PASS (unchanged).

---

## Immediate Objective

**1. Pack 02D staging smoke** (minimal checklist in PROJECT_STATE / WORK_LOG / this file below), then
**2. Implement Production Completion Pack 02E — UI Key Extraction.**

Do not invent a second locale-resolution path. Reuse Pack 02C + Pack 02D runtime.

### Pack 02D — minimal staging smoke checklist (required before staging PASS)

1. Promote/deploy the Pack 02D Web revision to staging (when authorized).
2. Admin Languages: temporarily enable `uk`, `zh-Hant`, `ar` (record originals; restore after).
3. Guest SSR:
   - default → `<html lang="en" dir="ltr">`; Language / Home / Institutions / Initiatives / Footer Support in English.
   - `hu_lang=uk` → Ukrainian chrome labels; `lang=uk` `dir=ltr`.
   - `hu_lang=zh-Hant` (or zh-TW alias write) → Traditional Chinese chrome; exact `lang=zh-Hant`.
   - `hu_lang=ar` → Arabic chrome; `lang=ar` `dir=rtl`.
4. Confirm Language Selector option names remain Registry `nativeName` / `englishName`.
5. Confirm no `/[locale]/…` routes; hrefs for Home/Institutions/Initiatives/Support unchanged.
6. Restore Registry enablement + any Participant `interfaceLanguage` changes.

Deeper Pack 02 sequence (approved):

| Pack | Focus |
|------|--------|
| 02A | Architecture Audit — **COMPLETED** |
| 02B | Language Registry — **COMPLETED** + staging **PASS** |
| 02C | Locale preference / runtime — **COMPLETED** + staging **PASS** |
| 02D | UI i18n foundation — **COMPLETED locally**; staging smoke **PENDING** |
| 02E | UI key extraction ← **NEXT after 02D staging acceptance** |
| 02F | Canonical terminology glossary |
| 02G | Civic/public translation expansion + async warming |
| 02H | Multilingual search |
| 02I | Multilingual SEO |
| 02J | RTL hardening + rollout verification |

Long-term invariant: **adding a supported language is an Admin operation**, not a software-development task per language.

---

## Open Items

| ID | Item | Status / constraint |
|----|------|---------------------|
| O1 | **Production** bootstrap Initiative `initiative-bootstrap-001` deletion | OPEN — known historical test data. Staging cleanup **intentionally refuses production**. Requires a **separately authorized production-safe procedure**. Do not weaken staging guards. |
| O2 | Mobile PWA regression diagnosis | OPEN — architecture previously worked on staging; diagnose regression. **Not** a PWA redesign. |
| O3 | Search-engine favicon | OPEN — read-only production favicon/crawler/metadata audit first. Do not generate a replacement image without evidence. |
| O4 | Pack 02D staging smoke | OPEN — local COMPLETE; **do not claim staging PASS** until checklist above. |
| O5 | Pack 02D commit / push | OPEN — local uncommitted on `main`; do not push until asked. |
| O6 | Multilingual Packs 02E–02J | OPEN — 02E after 02D staging acceptance. |

---

## Documentation Gate

Before declaring any Pack CLOSED: update this file, `PROJECT_STATE.md`, `PROJECT_DASHBOARD.md`, and `WORK_LOG.md` so the next agent can start without rediscovery.
