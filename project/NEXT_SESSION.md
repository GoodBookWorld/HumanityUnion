# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Production Completion Pack 02F COMPLETE + STAGING PASS** (Canonical Terminology Glossary; final staging revision `98c2817`). Packs **02B–02F COMPLETE + STAGING PASS**. Primary engineering branch: follow `git branch --show-current`; **repository evidence wins**.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture**.
5. **Exact next task:** **Pack 02G** (civic/public translation expansion + async warming; Layout Resilience Gate applies progressively). Search seam remains **Pack 02H**. Pack **02J** owns formal Multilingual Layout Resilience acceptance. No production promotion yet.
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

### Production Completion Pack 02F — Canonical Terminology Glossary (COMPLETE + STAGING PASS)

| Task | Result |
|------|--------|
| 01 Read-only audit | COMPLETE |
| 02 Contract + seeded catalog + repository | COMPLETE |
| 03 Admin API | COMPLETE |
| 04 Admin UI | COMPLETE |
| 05 Provider preferred-term injection | COMPLETE |
| 06 Acceptance + regression close-out | COMPLETE |
| Staging smoke | **PASS** (final revision `98c2817`) |

**Delivered:** code-seeded immutable `conceptId` catalog; Mongo `terminology_glossary` + Admin GET/PATCH; Admin UI `/admin/terminology-glossary`; locale-aware provider `terminologyContext` from published concepts; Gemini preferred-term semantics; English seed list as persistence/empty-set fallback; privacy/`safetyCleared` unchanged; explicit `removeTranslationLocales` + Admin **Remove translation**.

**Does not replace:** Language Registry, UI catalogs, lifecycle registry, `content_translations`, TranslationProvider abstraction, or global search.

**Deferred:** multilingual search integration → **Pack 02H**. Formal Multilingual Layout Resilience acceptance → **Pack 02J**. No production promotion yet.

### Pack 02F — Staging acceptance PASS (revision `98c2817`)

Verified on staging:

- Admin Terminology Glossary loads canonical seeded concepts.
- Participant / Member / Membership remain distinct.
- Locale translations persist.
- Explicit **Remove translation** works and survives reload.
- Blank preferredTerm remains invalid for an existing locale translation.
- Draft / Published persistence verified.
- Language Registry enable/disable updates public selector immediately without reload (stale disabled-locale selector bug fixed).
- Arabic RTL verified.
- Footer verified: **© 2024 Humanity Union. All rights reserved.**
- Multilingual Layout Resilience Gate permanently recorded (progressive from Pack 02G; formal acceptance in Pack 02J).
- Provider terminology behavior remains covered by Task 05 automated acceptance; no unnecessary staging data was created.
- Temporary Ukrainian Participant translation removed; Ukrainian Registry restored disabled; staging returned to clean baseline.

Hotfixes included in the passed revision lineage: editor scroll (`befe162`), Languages selector freshness + glossary clear reject (`ab10982`), locale remove + footer © 2024 + layout gate docs (`22261a0`), removal-contract clarification (`98c2817`).

### Production Completion Pack 02E — UI Key Extraction (COMPLETE + STAGING PASS)

Tasks **01–06 COMPLETE**. Presentation-only extraction on Pack 02D `next-intl`; Pack 02C sole locale authority.

| Task | Result |
|------|--------|
| 01 Scope audit | COMPLETE |
| 02 Public chrome nav/footer | COMPLETE (`navigation.*`) |
| 03 Shared common + a11y | COMPLETE (`common.*` / `a11y.*`) |
| 04 Auth chrome | COMPLETE (`auth.*`) |
| 05 Workspace/Account shell | COMPLETE (`workspace.*`) |
| 06 Acceptance + regression close-out | COMPLETE |

**Staging acceptance PASS** — verification locales **en / uk / zh-Hant / ar**. Public chrome, shared chrome, auth, workspace/account shell localized; Role/Status remain API enum tokens; Language Selector Registry-driven; hrefs not locale-prefixed; RTL under `ar` OK.

**Residual closed:** workspace member-identity “Edit Profile” was hardcoded English; fixed in commit `2e27b27` (`workspace.editProfile`; href `/member`). Re-smoke under uk/zh-Hant/ar PASS.

**Baseline restored:** Registry **en only**; `hu_lang=en`; `<html lang="en" dir="ltr">`.

### Production Completion Pack 02D — UI i18n Foundation (COMPLETE + STAGING PASS)

Unchanged — Pack 02C locale authority; `next-intl` foundation; staging PASS recorded previously.

### Production Completion Pack 02B + 02C — Staging Acceptance PASS

- Pack **02B** / **02C** staging PASS (unchanged).

---

## Immediate Objective

**Pack 02G** — civic/public translation expansion + async warming. Layout Resilience Gate applies progressively from 02G.

Do not start Pack 02H multilingual search in 02G. Pack **02J** owns formal Multilingual Layout Resilience acceptance. No production promotion yet.

Do not invent a second locale-resolution path. Reuse Pack 02C + Pack 02D runtime. Pack 02E chrome keys stay as shipped. Pack 02F glossary remains as shipped (`98c2817`).

Deeper Pack 02 sequence (approved):

| Pack | Focus |
|------|--------|
| 02A | Architecture Audit — **COMPLETED** |
| 02B | Language Registry — **COMPLETED** + staging **PASS** |
| 02C | Locale preference / runtime — **COMPLETED** + staging **PASS** |
| 02D | UI i18n foundation — **COMPLETED** + staging **PASS** |
| 02E | UI key extraction — **COMPLETED** + staging **PASS** |
| 02F | Canonical terminology glossary — **COMPLETE + STAGING PASS** (`98c2817`) |
| 02G | Civic/public translation expansion + async warming — **NEXT**; Layout Resilience Gate applies progressively |
| 02H | Multilingual search seam — **deferred** |
| 02I–02J | Hardening; **Multilingual Layout Resilience Gate** formal acceptance in **02J** |

---

## Standing rules (do not re-derive)

- Initiative = sole canonical civic root.
- Participant-first identity.
- English = translation fallback; translations never overwrite canonical civic source.
- Staging cleanup tools must not be weakened for production.
- Never commit `production-admin-source.json` or secrets.
