# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Production Completion Pack 02G IN PROGRESS** (civic/public translation expansion). Pack **02F COMPLETE + STAGING PASS** (`98c2817`). Packs **02B–02F COMPLETE + STAGING PASS**. Primary engineering branch: follow `git branch --show-current`; **repository evidence wins**.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture**.
5. **Exact next task:** **Pack 02G Task 07** — staging acceptance after Render reaches the Pack 02G revision (**IN PROGRESS / pending**; Pack 02G **not** yet STAGING PASS). Blog UI deferred. Discussion comments deferred. Search = **Pack 02H**. SEO = **Pack 02I**. Formal Layout Resilience acceptance = **Pack 02J**. No production promotion yet.
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

### Production Completion Pack 02G — Civic/Public Content Translation Expansion (IN PROGRESS)

| Task | Result |
|------|--------|
| 01 Read-only architecture audit | **COMPLETE** |
| 02 Eligibility / source-version / Registry gate | **COMPLETE** |
| 03 Civic/public entity expansion | **COMPLETE** |
| 04 Durable translation warming / outbox | **COMPLETE** |
| 05 Public read / runtime integration | **COMPLETE** |
| 06 Progressive layout-resilience hardening | **COMPLETE** |
| 07 Acceptance / staging | **IN PROGRESS** (local gates + staging push; **not** STAGING PASS yet) |

**Local status:** Tasks **01–06 COMPLETE locally**. Pack **02G is NOT yet STAGING PASS**. Task 07 staging smoke waits for Render revision verification after this push.

**Task 06 delivered:** Pack 02G-scoped multilingual layout resilience on shared translated components + civic/archive/media surfaces. Deterministic en/uk/zh-Hant/ar stress fixtures (no provider). Logical CSS on touched public shells. Formal scrollWidth DOM gate deferred (Web unit stack is CSS/source contracts) → Task 07 staging / Pack 02J. No Blog/Discussion/search/SEO.

**Task 05 delivered:** Cache-first civic translated display via shared `PublicTranslatedFields` / `CivicPublicTranslatedSection` (`enableOnDemandGenerate=false` for new kinds). Wired public routes for Task 03 kinds + civic-archive cards/detail + `/media` editorial. Initiative/Analysis/Petition keep optional POST `/generate` compatibility. Resolve remains generateIfMissing=false. No Blog/Discussion/search/SEO; no broad CSS remediation.

**Task 04 delivered:** Durable `ContentTranslationWarmRequested` via existing Mongo outbox; consumer + mutation hooks.

**Task 03 delivered:** Explicit civic `sourceKind`s + loaders + allowlists.

**Task 02 delivered:** `ContentTranslationIntent`; warm targets; sourceVersion/work identity; eligibility.

**Staging warm procedure (Task 04):** Enable locale with `contentTranslationEnabled` → publish/update public record or enqueue known id → confirm outbox + `content_translations`.

### Task 07 staging acceptance matrix (prepared — do not execute/deploy yet)

**Languages:** en · uk · zh-Hant · ar (RTL)

**Viewports:** mobile (~375) · tablet/intermediate (~900) · desktop (~1280)

**Surfaces (representative, minimize provider activity; prefer cached translations):**

| Surface | Why |
|---------|-----|
| One standard civic detail (e.g. improvement-proposal or decision-session public) | Typical title + translated fields |
| One structured/high-density (collective-decision or official-response w/ reference URL) | Dense meta + long reference |
| Civic Archive list + detail | Cards + long narrative |
| Civic Media `/media` | Editorial expansion vs diagrams/resources |
| Initiative / Analysis / Petition sample | Regression |

**Verify:** no overlap · no clipping · no unintended horizontal page scroll · actions readable/reachable · CJK wrap · RTL geometry · canonical fallback · machine/source indicators usable.

**Deferred to Pack 02J:** app-wide RTL, admin/workspace/PWA, formal WCAG, screenshot baselines.

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

**Pack 02G Task 07** — staging acceptance after Render revision verification (matrix below). Pack 02G remains **IN PROGRESS** until staging PASS is recorded. Do not start Pack 02H/02I. Pack **02J** owns formal Layout Resilience acceptance. No production promotion yet.

Known residual: SSR still renders canonical; client hydrates after GET resolve (same as Petition). Formal app-wide Layout Resilience = Pack **02J**. Blog UI / Discussion / search (02H) / SEO (02I) deferred.

Deeper Pack 02 sequence (approved):

| Pack | Focus |
|------|--------|
| 02A | Architecture Audit — **COMPLETED** |
| 02B | Language Registry — **COMPLETED** + staging **PASS** |
| 02C | Locale preference / runtime — **COMPLETED** + staging **PASS** |
| 02D | UI i18n foundation — **COMPLETED** + staging **PASS** |
| 02E | UI key extraction — **COMPLETED** + staging **PASS** |
| 02F | Canonical terminology glossary — **COMPLETE + STAGING PASS** (`98c2817`) |
| 02G | Civic/public translation expansion + async warming — **IN PROGRESS** (Tasks 01–06 COMPLETE locally; Task 07 staging pending — **not** STAGING PASS); Layout Resilience progressive |
| 02H | Multilingual search seam — **deferred** |
| 02I | Multilingual SEO — **deferred** |
| 02J | Hardening; **Multilingual Layout Resilience Gate** formal acceptance |

---

## Standing rules (do not re-derive)

- Initiative = sole canonical civic root.
- Participant-first identity.
- English = translation fallback; translations never overwrite canonical civic source.
- Staging cleanup tools must not be weakened for production.
- Never commit `production-admin-source.json` or secrets.
