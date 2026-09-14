# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Task 08I — Final Multilingual Staging Acceptance** (Packs **02B–02I** code complete; staging Live **NOT_READY** until Registry enablement + operator closeout). Primary engineering branch: follow `git branch --show-current`; **repository evidence wins**.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture** (final acceptance gate).
5. **Exact next task:** Staging Admin — enable `uk` / `zh-Hant` / `ar` with `contentTranslationEnabled` + `searchEnabled` (+ `seoIndexingEnabled` only if SEO crawl desired on a future production-mode surface). Re-run four-language Live matrix. Then record staging PASS or keep **NOT_READY**. Formal multi-viewport Layout Resilience = **Pack 02J**. No production promotion yet. No main merge.
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

### Task 08I — Final Multilingual Staging Acceptance (IN PROGRESS / NOT_READY)

**Code tip pushed:** `97c0e1d` (`feat: add multilingual search and localized SEO`) on `staging`.

**Local acceptance:** PASS — catalog parity en/uk/zh-Hant/ar; focused multilingual suites; types/API/Web typecheck; API `tsc` build; Web production build; architecture invariants (one search engine; no locale routes; hreflang deferred; no Gemini on metadata/search render; no next-intl in API domain).

**Staging deploy evidence:**
- API `humanity_union_staging` restarted ~`2026-09-02T21:56:42Z`; `GET /public/search?locale=uk` echoes `locale`.
- Web serves 08H search chrome (`locale` query wiring in search chunks; uk metadata title «Пошук»).

**Staging Live matrix (partial):**
- **en / uk:** language selector (enabled locales only), uk Search UI localized, filter **values** remain English canonical, canonical routes preserved, no hreflang/x-default.
- **zh-Hant / ar:** **not selectable** — Registry public list is **en + uk only**. Cookie `hu_lang=ar|zh-Hant` falls back to `en`.
- Ukrainian query `ініціатива` → API total **0** (glossary/search enrichment requires Registry `searchEnabled`; staging flags not Admin-enabled for full acceptance).
- Empty `/sitemap.xml` on staging is **expected** (`shouldDisallowSearchIndexing()` for staging mode) — not a multilingual defect.

**Production-readiness decision:** **NOT_READY — BLOCKERS REMAIN** (Registry staging enablement for zh-Hant/ar + search/content flags; complete four-language Live + RTL).

### Packs 02B–02I architecture (code COMPLETE on staging tip)

| Pack | Focus | Status |
|------|--------|--------|
| 02A | Architecture Audit | COMPLETE |
| 02B | Language Registry | COMPLETE + prior staging PASS |
| 02C | Locale preference / runtime | COMPLETE + prior staging PASS |
| 02D | UI i18n foundation | COMPLETE + prior staging PASS |
| 02E | UI key extraction | COMPLETE + prior staging PASS |
| 02F | Terminology glossary | COMPLETE + staging PASS (`98c2817`) |
| 02G | Civic translation + Journey/Archive chrome | COMPLETE locally; staging superseded by 08I tip |
| 02H | Multilingual Global Search | COMPLETE in `97c0e1d` |
| 02I | Localized SEO + hreflang deferred | COMPLETE in `97c0e1d` |
| 02J | Formal Multilingual Layout Resilience Gate | **NEXT after 08I Live PASS** |

**Supported architecture (singular):**

Language Registry → runtime locale → next-intl UI → cached civic translations → terminology glossary → multilingual Global Search (one engine) → SEO eligibility/metadata

**Hreflang:** `HREFLANG_STATUS = DEFERRED` (`ROUTING_PREREQUISITE`) — no locale-addressable URLs; no fake same-URL alternates; no x-default.

**Deprecated English transport (08E/08G):** `READY_TO_REMOVE_AFTER_PRODUCTION_ROLLOUT` — retain until production Web+API semantic versions are live. Do not remove in this pack.

### Known non-blocking debts (classified)

| Item | Class |
|------|--------|
| hreflang until locale-addressable URLs | ROUTING_PREREQUISITE |
| PDF Unicode font / Arabic PDF shaping | NON_BLOCKING_DOCUMENT_DEBT |
| Archive document-body translation pipeline | NON_BLOCKING_DOCUMENT_DEBT |
| judgmentWords English regex | NON_BLOCKING_DOMAIN_DEBT |
| Deprecated English transport fields | POST_ROLLOUT_CLEANUP |
| Formal 375/900/1280 layout gate | FUTURE_ENHANCEMENT (Pack 02J) |
| Registry `searchEnabled` / `seoIndexingEnabled` / zh-Hant+ar enable | ROLLOUT_DEBT → **blocks 08I Live PASS** until Admin applies on staging |

---

## Immediate Objective

1. **Admin on staging only:** enable `zh-Hant` and `ar` (`enabled=true`); set `contentTranslationEnabled` + `searchEnabled` for `uk` / `zh-Hant` / `ar` as needed for acceptance; optionally `seoIndexingEnabled` (does not emit hreflang while deferred).
2. Re-verify four-language Live matrix (selector, html lang/dir, Search locale, RTL ar, canonical URLs).
3. Record **08I STAGING PASS** or keep **NOT_READY**.
4. Do **not** merge main / deploy production / remove deprecated transport / add locale routes / add PDF fonts.
5. Pack **02J** owns formal Layout Resilience acceptance after Live PASS.

---

## Standing rules (do not re-derive)

- Initiative = sole canonical civic root.
- Participant-first identity.
- English = translation fallback; translations never overwrite canonical civic source.
- Staging cleanup tools must not be weakened for production.
- Never commit `production-admin-source.json` or secrets.
