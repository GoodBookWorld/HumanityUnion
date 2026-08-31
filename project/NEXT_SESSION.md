# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Production Completion Pack 02F COMPLETE locally** (Canonical Terminology Glossary). Packs **02B–02E COMPLETE + STAGING PASS**. Primary engineering branch: follow `git branch --show-current`; **repository evidence wins**.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture**.
5. **Exact next task:** **Pack 02F staging smoke** (checklist below / WORK_LOG). On staging **PASS**, start **Pack 02G**. Search seam remains **Pack 02H**. Do not claim Pack 02F staging PASS yet.
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

### Production Completion Pack 02F — Canonical Terminology Glossary (COMPLETE locally; staging smoke PENDING)

| Task | Result |
|------|--------|
| 01 Read-only audit | COMPLETE |
| 02 Contract + seeded catalog + repository | COMPLETE |
| 03 Admin API | COMPLETE |
| 04 Admin UI | COMPLETE |
| 05 Provider preferred-term injection | COMPLETE |
| 06 Acceptance + regression close-out | COMPLETE |

**Delivered:** code-seeded immutable `conceptId` catalog; Mongo `terminology_glossary` + Admin GET/PATCH; Admin UI `/admin/terminology-glossary`; locale-aware provider `terminologyContext` from published concepts; Gemini preferred-term semantics; English seed list as persistence/empty-set fallback; privacy/`safetyCleared` unchanged.

**Does not replace:** Language Registry, UI catalogs, lifecycle registry, `content_translations`, TranslationProvider abstraction, or global search.

**Deferred:** multilingual search integration → **Pack 02H**.

### Pack 02F — Minimal staging smoke (one deployment)

1. Admin Glossary page loads seeded concepts.
2. Edit one disabled-locale translation; save succeeds.
3. Alias input (e.g. zh-TW) stores under zh-Hant.
4. Reload page — edit persists.
5. Participant / Member / Membership remain three separate concepts.
6. Set one concept to draft then back to published; only published participate in provider context.
7. With a published target preferred term, provider terminology context uses that term.
8. With target term missing, context falls back to canonical English.
9. Admin Languages list/enablement unchanged by glossary edits.
10. Restore any temporary glossary edits used in smoke.

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

**Pack 02F staging smoke PENDING** (local COMPLETE).

After staging **PASS**: start **Pack 02G** (civic/public translation expansion + async warming). Do not start Pack 02H search in 02G.

Do not invent a second locale-resolution path. Reuse Pack 02C + Pack 02D runtime. Pack 02E chrome keys stay as shipped.

Deeper Pack 02 sequence (approved):

| Pack | Focus |
|------|--------|
| 02A | Architecture Audit — **COMPLETED** |
| 02B | Language Registry — **COMPLETED** + staging **PASS** |
| 02C | Locale preference / runtime — **COMPLETED** + staging **PASS** |
| 02D | UI i18n foundation — **COMPLETED** + staging **PASS** |
| 02E | UI key extraction — **COMPLETED** + staging **PASS** |
| 02F | Canonical terminology glossary — **COMPLETE locally**; staging smoke **PENDING** |
| 02G | Civic/public translation expansion + async warming — **NEXT after 02F staging PASS** |
| 02H–02J | As sequenced in architecture roadmap (02H = search seam) |

---

## Standing rules (do not re-derive)

- Initiative = sole canonical civic root.
- Participant-first identity.
- English = translation fallback; translations never overwrite canonical civic source.
- Staging cleanup tools must not be weakened for production.
- Never commit `production-admin-source.json` or secrets.
