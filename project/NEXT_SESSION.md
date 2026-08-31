# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Production Completion Pack 02D COMPLETE + STAGING PASS** (UI i18n Foundation). Primary engineering branch: follow `git branch --show-current`; **repository evidence wins**.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture**.
5. **Exact next task:** **Production Completion Pack 02E — UI Key Extraction**.
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

### Production Completion Pack 02D — UI i18n Foundation (COMPLETE + STAGING PASS)

Tasks 01–04 accepted; staging acceptance closed:

- **Implementation:** `next-intl` UI i18n foundation on `@hu/web`; Pack 02C remains sole locale authority; server-resolved `html` `lang`/`dir`; English canonical bundled catalog; bundled verification catalogs `en` / `uk` / `zh-Hant` / `ar`; English fallback/deep merge; optional/inactive remote message-pack seam; bundled verification-catalog parity guard.
- **Foundation chrome translated:** Language Selector label/loading/error; primary desktop/mobile Home / Institutions / Initiatives; Footer Support.
- **Deferred to Pack 02E:** Civic Media, Knowledge, Membership, Search, broader auth/account/workspace/UI copy.
- **Staging acceptance:** en PASS (LTR); uk PASS (LTR); zh-TW alias → canonical `zh-Hant` PASS (LTR); ar PASS (RTL); non-locale-prefixed URLs; Registry-driven option names; disabled locale write → 400; Registry restored to en-only; final guest `hu_lang=en`, `html lang=en dir=ltr`; no residual Pack 02D issue.
- **Staging build hotfix:** Pack 02D introduced `next-intl` native deps `@parcel/watcher` + `@swc/core`; both explicitly approved under existing strict `allowBuilds` in `pnpm-workspace.yaml` (policy preserved, not weakened); staging build then passed.

### Production Completion Pack 02B + 02C — Staging Acceptance PASS

- Pack **02B** / **02C** staging PASS (unchanged).

---

## Immediate Objective

**Implement Production Completion Pack 02E — UI Key Extraction.**

Do not invent a second locale-resolution path. Reuse Pack 02C + Pack 02D runtime.

Deeper Pack 02 sequence (approved):

| Pack | Focus |
|------|--------|
| 02A | Architecture Audit — **COMPLETED** |
| 02B | Language Registry — **COMPLETED** + staging **PASS** |
| 02C | Locale preference / runtime — **COMPLETED** + staging **PASS** |
| 02D | UI i18n foundation — **COMPLETED** + staging **PASS** |
| 02E | UI key extraction ← **NEXT** |
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
| O4 | Multilingual Packs 02E–02J | OPEN — **02E NEXT**. |

---

## Documentation Gate

Before declaring any Pack CLOSED: update this file, `PROJECT_STATE.md`, `PROJECT_DASHBOARD.md`, and `WORK_LOG.md` so the next agent can start without rediscovery.
