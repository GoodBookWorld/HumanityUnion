# WORK_LOG

Humanity Union

Engineering Work Log

Version 1.0

---

# Purpose

This document is the engineering journal of the Humanity Union platform.

It records engineering progress, important architectural decisions, and implementation milestones.

It is not a replacement for Git history.

It is not a replacement for CHANGELOG.

It records the engineering journey.

---

# Logging Rules

Each entry should be short.

Each entry should answer:

- What was completed?
- What architectural decisions were made?
- What is the next engineering objective?

Avoid implementation details.

Avoid commit history.

Reference Guides whenever possible.

---

# Entry Template

Date:

Completed:

Architecture:

Engineering Notes:

Next Objective:

---

# Entries

## 2026-08-31 (Pack 02F — COMPLETE + STAGING PASS)

Completed:

- Pack **02F COMPLETE + STAGING PASS** at revision **`98c2817`**.
- Staging verified: Admin Glossary loads seeded concepts; Participant / Member / Membership distinct; locale translations persist; explicit Remove translation works and survives reload; blank preferredTerm remains invalid; Draft / Published persistence OK.
- Language Registry enable/disable updates public selector immediately (stale disabled-locale bug fixed); Arabic RTL OK; footer **© 2024 Humanity Union. All rights reserved.**
- Multilingual Layout Resilience Gate permanently recorded (progressive from Pack 02G; formal acceptance in Pack 02J).
- Provider terminology covered by Task 05 automated acceptance; no unnecessary staging data created.
- Temporary Ukrainian Participant translation removed; Ukrainian Registry restored disabled; staging returned to clean baseline.
- No production promotion.

Architecture:

- Glossary removal = explicit `removeTranslationLocales` only; preferredTerm invariant unchanged.
- Pack 02H multilingual search remains deferred; Pack 02J owns formal Layout Resilience acceptance.

Next Objective:

- **Pack 02G** — civic/public translation expansion + async warming.

---

## 2026-08-31 (Pack 02F staging-smoke final hotfix — locale remove + footer + layout gate)

Completed:

- Glossary PATCH `removeTranslationLocales` deletes an entire locale translation; preferredTerm still required when a locale entry exists; blank preferredTerm remains rejected.
- Admin UI **Remove translation** with confirm + pending/success/error; enables removing staging Participant/uk “Учасник”.
- Public footer copyright founding year set to **© 2024** (not dynamic current year).
- Documented permanent **Multilingual Layout Resilience Gate** (progressive from Pack 02G; formal acceptance in Pack 02J). No Pack 02G implementation.
- Pack 02F staging smoke still PENDING until hotfix re-smoke.

Next Objective:

- Pack 02F staging re-smoke (locale remove + Languages freshness + footer year); on PASS → **Pack 02G**.

---

## 2026-08-31 (Pack 02F staging-smoke — Languages cache + glossary clear UX)

Completed:

- Root cause (Languages): short-lived public languages client TTL cache + LanguageSelector mount-only fetch — Admin disable left stale options until hard refresh; selecting disabled locale failed hu_lang write.
- Fix: `invalidatePublicLanguagesClientCache()` after Admin create/update; selector listens for `hu:public-languages-changed` and refetches.
- Root cause (Glossary): clearing preferredTerm is not a valid contract delete; UI early-returned before Saving state with weak feedback.
- Fix: explicit reject message + inline editor alert; `saving` guard; no invented locale deletion. English fallback unchanged.
- Staging smoke still PENDING — do not claim PASS.

Next Objective:

- Pack 02F staging re-smoke (Languages enable/disable without hard refresh; glossary clear reject + valid save); on PASS → **Pack 02G**.

---

## 2026-08-31 (Pack 02F staging-smoke UX — glossary editor scroll)

Completed:

- Admin Terminology Glossary: selecting a table row scrolls the opened editor into view.
- Honors `prefers-reduced-motion` (auto vs smooth). Save / filter / refresh do not re-trigger scroll.
- UI-only; no API / persistence / provider change. Staging smoke still PENDING.

Next Objective:

- Pack 02F staging smoke; on PASS → **Pack 02G**.

---

## 2026-08-31 (Pack 02F Task 06 — acceptance + regression close-out)

Completed:

- Pack **02F COMPLETE locally**; Tasks **01–06 COMPLETE**.
- Architecture / persistence / Admin API / Admin UI / provider injection / privacy gates accepted.
- Regression: Pack 02F Tasks 02–05 + Language Registry + content translation/provider suites green; `@hu/types` typecheck+build, `@hu/api` typecheck, `@hu/web` typecheck+build green; `git diff --check` clean.
- Staging smoke **PENDING** (minimal 10-point checklist in NEXT_SESSION). No staging PASS claimed.
- Search seam remains Pack 02H.

Architecture:

- Glossary is presentation vocabulary only; does not replace Language Registry, UI catalogs, lifecycle registry, content_translations, TranslationProvider, or search.
- No new ADR.

Next Objective:

- Pack 02F staging smoke; on PASS → **Pack 02G**.

---

## 2026-08-31 (Pack 02F Task 05 — provider terminology injection)

Completed:

- Pack **02F IN PROGRESS**; **Task 05 COMPLETE**.
- Locale-aware published-glossary `terminologyContext` via canonical `resolveProviderTerminologyContext`.
- Gemini prompt uses preferred target terms; protects machine identifiers; English seed list is persistence/empty-set fallback only.
- Wired into `content-translation.service` + `translate-draft`; deterministic provider records context; privacy/`safetyCleared` unchanged.
- Focused Task 05 + Tasks 02–03 + affected translation/Language Registry tests green; `@hu/api` typecheck green.
- Exact next: **Task 06 — acceptance + docs**. Search remains Pack 02H. No staging PASS.

Architecture:

- No new ADR; existing TranslationProvider + terminologyContext seam retained.
- Locale resolution reuses Language Registry (aliases canonicalized; unknown rejected; disabled not silently enabled).

Next Objective:

- Pack 02F Task 06 — acceptance + documentation close-out (Pack still IN PROGRESS until Task 06).

---

## 2026-08-31 (Pack 02F Task 04 — terminology glossary Admin UI)

Completed:

- Pack **02F IN PROGRESS**; **Task 04 COMPLETE**.
- Admin UI `/admin/terminology-glossary` + nav entry (separate from Languages).
- List/filter seeded concepts; editor for status + Registry-locale preferredTerm/aliases/guidance; identity/linkedRefs read-only.
- Disabled Registry languages editable/visible; PATCH merges one locale; no create/delete; no provider/search side effects.
- Exact next: **Task 05 — provider terminology injection**.

Architecture:

- Language Registry remains locale authority; glossary remains presentation vocabulary only.

Next Objective:

- Pack 02F Task 05 — locale-aware TranslationProvider terminology injection.

---

## 2026-08-31 (Pack 02F Task 03 — terminology glossary Admin API)

Completed:

- Pack **02F IN PROGRESS**; **Task 03 COMPLETE**.
- Admin endpoints: `GET/PATCH /api/v1/admin/terminology-glossary` (+ get by conceptId); Admin-only; no create/delete.
- Locale merge PATCH; zh-TW→zh-Hant; disabled locales storable; Task 02 validation reused; audit `terminology_glossary.update`.
- Provider/search/Language Registry untouched by mutations.
- Exact next: **Task 04 — Admin UI**.

Architecture:

- Presentation vocabulary only; immutable concept identity; Admin cannot invent concepts.

Next Objective:

- Pack 02F Task 04 — Terminology Glossary Admin UI.

---

## 2026-08-31 (Pack 02F Task 02 — glossary contract + seed + repository)

Completed:

- Pack **02F IN PROGRESS**; **Task 02 COMPLETE**.
- Added `@hu/types` TerminologyConcept contract; code-seeded catalog (22 concepts); Mongo `terminology_glossary` + memory repository; Language Registry locale canonicalization; alias integrity.
- `HUMANITY_UNION_TRANSLATION_TERMINOLOGY` now derived from seed catalog; Gemini still preserves English terms (Task 05 deferred).
- Focused Pack 02F tests + language Pack 01/02 suites green; types/API typecheck green.
- Exact next: **Task 03 — Admin API**.

Architecture:

- Glossary is presentation vocabulary only — no domain/lifecycle fork; Admin cannot invent conceptIds.
- Disabled Registry locales may store translations; runtime authority unchanged.
- Revision links via `civicEntityType` only (not public stage registry route).

Next Objective:

- Pack 02F Task 03 — Terminology Glossary Admin API.

---

## 2026-08-31 (Pack 02F Task 01 — Canonical Terminology Glossary read-only audit)

Completed:

- Pack **02F IN PROGRESS**; **Task 01 COMPLETE** (audit/design only — no application code).
- Mapped existing terminology surface: flat `HUMANITY_UNION_TRANSLATION_TERMINOLOGY` provider preserve-list; Pack 02B Language Registry (locale aliases ≠ term aliases); Pack 02D/02E UI catalogs; `content_translations` + `TranslationProvider.terminologyContext`; global search entity labels; Assistant platform-knowledge keywords; `engineering/00_UBIQUITOUS_LANGUAGE.md` + lifecycle stage registry.
- Classified audit concepts (domain / UI / workflow-stage / brand / auth); recommended code-seeded glossary records + Admin edit of preferred translations/aliases/guidance only.
- Provider seam: replace English preserve-list with locale-aware preferred-term injection at existing Gemini/draft/content-translation call sites.
- Search seam: Pack 02H must extend the same `global-search` matcher/index — not a second vocabulary index.
- Exact next: **Task 02 — Glossary contract / seed / repository**.

Architecture:

- Glossary is presentation/search/provider vocabulary only — must not rename domain IDs, enums, routes, payloads, or events.
- Language Registry remains language authority; UI catalogs remain chrome authority; content translation seam extended, not replaced.
- Current Gemini prompt preserves English terms — Pack 02F must evolve injection to preferred target-locale terms without sending private content.

Next Objective:

- Pack 02F Task 02 — glossary record contract, code-seeded concepts, repository replacing the flat string list.

---

## 2026-08-31 (Pack 02E — staging acceptance + documentation close-out)

Completed:

- Pack **02E COMPLETE + STAGING PASS** (UI key extraction).
- Staging smoke en / uk / zh-Hant / ar: public/shared/auth/workspace chrome localized; Role/Status raw; Registry-driven selector; non-locale-prefixed hrefs; RTL under ar OK.
- Residual Edit Profile fixed by commit `2e27b27` (`workspace.editProfile`); re-smoke under uk/zh-Hant/ar PASS (`href=/member` unchanged).
- Registry restored to **en only**; `hu_lang=en`; `<html lang="en" dir="ltr">`.

Architecture:

- Presentation-only next-intl extraction; Pack 02C locale authority preserved; no route/permission/contract change.

Next Objective:

- **Pack 02F — Canonical Terminology Glossary.**

---

## 2026-08-31 (Pack 02E residual — header Edit Profile i18n)

Completed:

- Staging smoke residual: workspace member-identity “Edit Profile” stayed English under uk/zh-Hant/ar.
- Presentation-only fix: reuse existing `workspace.editProfile` in `WorkspaceMemberIdentity` (href `/member` unchanged).
- Pack 02E Task 05/06 tests cover catalog values + component wiring.
- Commit `2e27b27`; staging re-smoke recorded in subsequent close-out entry.

Architecture:

- No new catalog key; no route/permission/contract change; Pack 02E scope not broadened.

Next Objective:

- Pack 02E re-smoke (Edit Profile under uk/zh-Hant/ar); on full PASS start Pack 02F.

---

## 2026-08-31 (Pack 02E Task 06 — acceptance + regression close-out)

Completed:

- Pack **02E COMPLETE locally**; Tasks **01–06 COMPLETE**; staging smoke **PENDING** (do not claim staging PASS).
- Verified Pack 02C locale authority + Pack 02D foundation; presentation extraction only across public/shared/auth/workspace chrome.
- Catalog parity + fallback fixtures green; Pack 02D/02E i18n suites green; Pack 02E-caused Pack 05 icon aria regression fixed.
- Deferred: Pack 02F glossary; lifecycle stages; civic body; Notification Center empty states; Blog navLabel API redesign; role/status enum maps.
- Exact next: **Pack 02E staging smoke**, then **Pack 02F — Canonical Terminology Glossary**.

Architecture:

- No locale middleware / `[locale]` routes; English fallback intact; stable English identities preserved.

Next Objective:

- Pack 02E staging smoke checklist; on PASS start Pack 02F.

---

## 2026-08-31 (Pack 02E Task 05 — workspace/account shell extraction)

Completed:

- Pack **02E IN PROGRESS**; **Task 05 COMPLETE**.
- Added `workspace.*` catalogs; Workspace nav presentation via stable-English identity + display helper; authenticated header/mobile/PWA drawer chrome; Account shell tiles/forms; Workspace home title/subtitle.
- Blog `navLabel` contract unchanged; lifecycle registry untouched; role/status API values unchanged.
- Exact next: **Task 06 — Pack 02E acceptance + catalog parity + regression close-out**.

Architecture:

- Presentation-only next-intl for workspace/account shell; no Pack 02F glossary; no lifecycle/domain translation.

Next Objective:

- Pack 02E Task 06 — acceptance + catalog parity + regression close-out.

---

## 2026-08-31 (Pack 02E Task 04 — auth chrome extraction)

Completed:

- Pack **02E IN PROGRESS**; **Task 04 COMPLETE**.
- Added `auth.*` catalogs (en/uk/zh-Hant/ar); wired login/register/reset/verify/2FA Account Security + header/mobile Log in / Create account.
- Reused `common.cancel` and PasswordInput `common.*`; backend error passthrough preserved; incorrect-code mapped presentation via `auth.incorrectCode`.
- Exact next: **Task 05 — Workspace / Account shell extraction (`workspace.*`)**.

Architecture:

- Presentation-only next-intl for auth surfaces; no Pack 02F glossary; workspace shell deferred.

Next Objective:

- Pack 02E Task 05 — workspace/account shell (`workspace.*`).

---

## 2026-08-31 (Pack 02E Task 03 — shared common.* + reusable a11y chrome)

Completed:

- Pack **02E IN PROGRESS**; **Task 03 COMPLETE**.
- ConfirmDialog default cancel → `common.cancel`; ApiUnavailableState defaults → `common.retry` / `common.backToHome`; PasswordInput Show/Hide → `common.show|hide|showPassword|hidePassword`.
- Global skip-link → `a11y.skipToMainContent`.
- Caller overrides preserved; HuFeedbackMessage variant titles deferred (`common.error` ≠ short “Error” label).
- Exact next: **Task 04 — Auth chrome extraction (`auth.*`)**.

Architecture:

- Presentation-only next-intl at shared component boundaries; no auth/workspace shell migration in this slice.

Next Objective:

- Pack 02E Task 04 — auth chrome (`auth.*`).

---

## 2026-08-31 (Pack 02E Task 02 — remaining public chrome navigation)

Completed:

- Pack **02E IN PROGRESS**; **Task 02 COMPLETE**.
- Primary nav presentation keys: Civic Media / Knowledge / Membership / Search.
- Footer presentation keys: Blog / Civic Archive / Membership / Search / Privacy / Terms / Contact (+ Institutions / Initiatives reuse).
- Stable English labels/hrefs/active-route matching preserved; en/uk/zh-Hant/ar catalogs + English-derived parity updated.
- Exact next: **Task 03 — Shared common.* + reusable UI/a11y chrome extraction**.

Architecture:

- Continued Pack 02D display-helper pattern; no second translation mechanism; no locale-prefixed routes.

Next Objective:

- Pack 02E Task 03 — shared common.* + reusable UI/a11y chrome.

---

## 2026-08-31 (Pack 02E Task 01 — UI Key Extraction Scope Audit)

Completed:

- Pack **02E IN PROGRESS**; **Task 01 COMPLETE** (read-only scope audit).
- Inventoried remaining hard-coded Web UI chrome: public header/footer destinations, auth flows, account/workspace shell, shared design-system chrome.
- Confirmed Pack 02D pattern: stable English labels remain identity; presentation via `navigation.*` / `common.*`.
- Proposed minimal namespaces: reuse `common.*` / `navigation.*`; add `auth.*`, `workspace.*`, `a11y.*` only when justified.
- Flagged terminology for Pack 02F glossary alignment (Workspace, Participant, Member/Membership, Initiative, Civic Media, Two-Step Login, etc.).
- Exact next: **Task 02 — Remaining public chrome navigation keys**.

Architecture:

- Do not replace route/active-match/test identity strings with translations.
- Blog authoring API `navLabel` English union is a high-risk label-as-identifier — remap via stable keys before translating display.
- No provider/search/SEO work in Pack 02E.

Next Objective:

- Pack 02E Task 02 — remaining public chrome navigation keys.

---

## 2026-08-31 (Pack 02D — staging acceptance + documentation close-out)

Completed:

- Pack **02D COMPLETE + STAGING PASS** (UI i18n Foundation).
- Staging smoke: en PASS (LTR); uk PASS (LTR); zh-TW→zh-Hant PASS (LTR); ar PASS (RTL).
- Canonical URLs remained non-locale-prefixed; Registry option names Registry-driven; disabled locale write rejected with 400.
- Registry restored to en-only; final guest `hu_lang=en`, `html lang=en dir=ltr`; no residual Pack 02D issue.
- Staging build hotfix: `@parcel/watcher` + `@swc/core` explicitly approved in `pnpm-workspace.yaml` `allowBuilds` (strict lifecycle policy preserved, not weakened).

Architecture:

- Pack 02C remains sole locale authority; `next-intl` consumes that locale only.
- Foundation chrome only (Language Selector label/loading/error; primary Home / Institutions / Initiatives; Footer Support).
- Civic Media / Knowledge / Membership / Search / broader auth-account-workspace UI deferred to Pack 02E.

Next Objective:

- **Production Completion Pack 02E — UI Key Extraction.**

---

## 2026-08-30 (Pack 02D Task 04 — local acceptance close-out)

Completed:

- Pack **02D COMPLETE locally** (Tasks 01–04 accepted as one coherent UI i18n foundation).
- Architecture / foundation surfaces / catalog parity / scope audit verified.
- Staging smoke **still required** — do **not** claim Pack 02D staging PASS.
- Pack **02B/02C** staging **PASS** preserved.
- Exact next Pack after 02D staging acceptance: **Pack 02E — UI Key Extraction**.
- Changes remain local / uncommitted / not pushed.

Architecture:

- Pack 02C remains sole locale authority; next-intl consumes that locale only.
- Foundation chrome only; Civic Media / Knowledge / Membership / Search / auth-workspace deferred to 02E+.

Next Objective:

- Pack 02D staging smoke checklist, then Pack 02E.

---

## 2026-08-30 (Pack 02D Task 03 — foundation chrome + catalog parity)

Completed:

- Pack **02D IN PROGRESS**; **Task 03 complete** (local, uncommitted).
- Footer Support → `navigation.support`; Language Selector loading/error → `common.loading` / `common.error`.
- Bundled verification catalog parity guard derived from English foundation keys (`uk` / `zh-Hant` / `ar`).
- English deep-merge fallback preserved for partial fixtures.

Architecture:

- Foundation chrome consumption complete for existing Pack 02D keys on live global surfaces.
- Remote/Admin packs remain out of parity scope.

Next Objective:

- Pack 02D **Task 04** — acceptance + close-out (do not mark Pack 02D COMPLETE until Task 04).

---

## 2026-08-30 (Pack 02D Task 02 — first real UI translation surface)

Completed:

- Pack **02D IN PROGRESS**; **Task 02 complete** (local, uncommitted).
- Language Selector label via `common.language`; Registry option names unchanged.
- Desktop + mobile primary nav translate Home / Institutions / Initiatives; English-stable identities preserve hrefs and active matching.
- Verification catalogs completed for foundation keys; English fallback proven with partial loader fixture.
- Arabic selector chevron/padding logical fix under existing `dir=rtl` only.

Architecture:

- Presentation-boundary translation; no second locale authority; no locale-prefixed routes.
- Unmapped destinations (Civic Media, Knowledge, Membership, Search) remain English until Pack 02E.

Next Objective:

- Pack 02D **Task 03** — remaining foundation-key chrome + catalog parity (do not close Pack 02D yet).

---

## 2026-08-30 (Pack 02D Task 01 — UI i18n Runtime Foundation)

Completed:

- Pack **02D IN PROGRESS**; **Task 01 complete** (local, uncommitted).
- `next-intl` on `@hu/web` only; Pack 02C `resolveDocumentHtmlLocale` remains sole locale authority for `<html lang/dir>` + provider.
- Bundled catalogs `en` / `uk` / `zh-Hant` / `ar` with English deep-merge fallback; foundation `common` + `navigation` namespaces only.
- Remote-pack seam designed; no Admin upload UI / no R2.
- Focused i18n tests, typecheck, and `@hu/web` build green.
- Pack **02B/02C staging PASS** recorded; `main` still local / not pushed.

Architecture:

- No locale-prefixed routing; no next-intl middleware locale detection.
- English bundled fallback always exists; adding Registry languages must not force redesign.

Next Objective:

- Pack 02D **Task 02** — minimal UI chrome consumption of the foundation (not whole-UI migration).

---

## 2026-08-30 (Pack 02C Hotfix 02 — language catalog freshness)

Completed:

- Staging smoke found process-lifetime Web `publicLanguagesCache` blocking `POST /api/hu-lang` after Admin enable.
- Hotfix 02: write validation always fetches Registry; client selector keeps short TTL + in-flight only.
- Pack **02B** staging acceptance **PASS**. Pack **02C** staging acceptance **not PASS** until re-smoke.

Architecture:

- Registry/API remains authority; no second locale catalog.
- SSR already used no-store fetch; hu-lang write path aligned.

Next Objective:

- Promote Hotfix 02; minimal staging re-smoke of enable/disable → `hu_lang` without Web restart.
- Then Pack 02D.

---

## 2026-08-30 (Production Completion Pack 02C — COMPLETE locally)

Completed:

- Task 04 local acceptance: flows A–F verified; one shared `resolveRuntimeLocaleFromCatalog` path.
- Hardening: language-list client cache; login sync latch (no refresh loop); auth select no longer rolls back UI after prefs save.
- Pack 02C marked **COMPLETE** locally. Staging smoke still required after commit/promotion.

Architecture:

- Interface locale: Registry → resolver → API request / Web SSR / `hu_lang` / selector / Participant `interfaceLanguage` sync.
- No next-intl yet (Pack 02D).

Next Objective:

- Production Completion Pack 02D — UI i18n Foundation.
- Staging smoke checklist for 02C after promotion.

---

## 2026-08-30 (Production Completion Pack 02C Task 03 — language selector + hu_lang sync)

Completed:

- Header/mobile language selector from enabled public Registry languages.
- Web-origin `POST /api/hu-lang` with Registry validate/canonicalize before cookie write.
- Guest cookie → SSR refresh; authenticated Preferences `interfaceLanguage` + cookie sync; login-time preference → cookie sync via client Preferences handoff.
- Pack 02C **IN PROGRESS**.

Architecture:

- Participant `interfaceLanguage` remains authoritative when authenticated; `hu_lang` mirrors for Web SSR without sharing API auth cookies.

Next Objective:

- Pack 02C Task 04 — acceptance verification & pack close-out → then Pack 02D.

---

## 2026-08-30 (Production Completion Pack 02C Task 02 — request locale + HTML lang/dir)

Completed:

- API request-scoped runtime locale (`resolveRuntimeLocaleForRequest`, middleware, `GET /api/v1/runtime-locale`).
- Shared `@hu/types` catalog resolver; Web root layout sets `<html lang>` / `dir` server-side before paint.
- Removed client useEffect language flicker path. Pack 02C **IN PROGRESS**.

Architecture:

- Web SSR cannot read API host-only auth cookies; Participant preference applies on API requests; HTML uses cookie + Accept-Language until Task 03 cookie write/sync.

Next Objective:

- Pack 02C Task 03 — language selector + `hu_lang` write/sync (no next-intl yet).

---

## 2026-08-30 (Production Completion Pack 02C Task 01 — Locale resolution foundation)

Completed:

- Canonical `resolveRuntimeLocale` (anonymous + authenticated precedence; enabled Registry only).
- Deterministic Accept-Language parser; guest `hu_lang` cookie helpers; `ResolvedRuntimeLocale` contract.
- Platform default remains `DEFAULT_PLATFORM_LANGUAGE` (`en`) — no competing Admin settings subsystem.
- Focused unit tests + typechecks. Pack 02C **IN PROGRESS** (not complete).

Architecture:

- Interface language resolution stays separate from reading/writing languages.
- `zh-Hant` never collapsed to `zh`; `*` cannot bypass Registry.

Next Objective:

- Pack 02C Task 02 — apply resolved runtime locale to `html lang`/`dir` / request wiring (no next-intl / selector UI yet).

---

## 2026-08-30 (Production Completion Pack 02B — Language Registry COMPLETE)

Completed:

- Admin → Languages UI (`/admin/languages`) for create/edit/enable/disable via Task 04 APIs.
- Integration path verified: enable `uk` → public + `/translations/languages` → prefs + Translate Draft.
- Removed obsolete web re-export of `PRIORITY_LANGUAGE_CODES` from picker barrels.
- Pack 02B acceptance criteria met; next Pack = **02C Locale Preference & Runtime**.

---

## 2026-08-30 (Production Completion Pack 02B Task 04 — Admin write control plane)

Completed:

- Admin `POST /api/v1/admin/languages` and `PATCH /api/v1/admin/languages/:languageId` (no DELETE; no providerMappings).
- Safety invariants: English cannot be disabled; fallback must be enabled existing locale; self-fallback only for `en`; disable blocked when enabled dependents use locale as fallback; feature flags require `enabled=true`; canonical locale immutable.
- Admin audit events for create / update / enable / disable (no secrets).
- Focused unit tests. No Admin Languages UI.

Next Objective:

Pack 02B Task 05 — Admin Languages UI / final 02B integration (still do not mark Pack 02B CLOSED).

---

## 2026-08-30 (Production Completion Pack 02B Task 03 — Registry consumer cutover)

Completed:

- Canonical `language-registry-runtime` resolver (enabled-only selectable languages; alias→canonical; English fallback for runtime context).
- Migrated `/translations/languages`, preference language validation (interface/reading/writing), Translate Draft + content-translation generate targets.
- Web Preferences + Translate Draft pickers load via registry-backed `listPriorityLanguages()`.
- `PRIORITY_LANGUAGE_CATALOG` retained as legacy reference only; not used by migrated runtime consumers.
- Disabled seed locales (`uk`, `zh-Hant`, `ar`) remain non-selectable until Admin enablement (Task 04).

Next Objective:

Pack 02B Task 04 — Admin Language Registry write/control-plane (still do not mark Pack 02B CLOSED).

---

## 2026-08-30 (Production Completion Pack 02B Task 02 — Bootstrap + read APIs)

Completed:

- Wired `ensureLanguageRegistrySeeded` into `bootstrapMongoPersistence` (after indexes; idempotent; no overwrite).
- Strengthened locale↔alias integrity across create/update (cross-collisions, own-locale alias, unique normalized aliases).
- Public `GET /api/v1/languages` — enabled only; public-safe fields; deterministic order.
- Admin `GET /api/v1/admin/languages` — all records; canonical Admin auth; no `providerMappings`; deterministic order.
- Focused unit tests. No consumer migration; no POST/PATCH.

Next Objective:

Pack 02B Task 03 — controlled migration off `PRIORITY_LANGUAGE_CATALOG` / `/translations/languages` (still do not mark Pack 02B CLOSED).

---

## 2026-08-30 (Production Completion Pack 02B Task 01 — Language Registry foundation)

Completed:

- Canonical `LanguageRegistryRecord` types in `@hu/types`.
- Mongo collection `language_registry` + unique indexes; repository list/get/resolve/create/update; memory adapter for tests.
- Idempotent seeds for `en`, `uk`, `zh-Hant` (aliases `zh-TW`/`zh-HK`), `ar` (RTL). Does not overwrite existing rows.
- Focused unit tests passing. No Admin/public routes; runtime catalog unchanged.

Next Objective:

Pack 02B Task 02 — Admin/public Language Registry APIs (still do not mark Pack 02B CLOSED).

---

## 2026-08-30 (Documentation Recovery & Canonical Handoff Update)

Completed:

- Aligned NEXT_SESSION, PROJECT_STATE, PROJECT_DASHBOARD, WORK_LOG, chat-agent recovery kit, and Development Baseline with verified production + Pack 01/01.1 + Pack 02A state.
- Established Documentation Gate as a permanent Pack-closure rule.
- Recorded Pack 02B as the exact next implementation task.

Architecture:

- Confirmed document hierarchy: NEXT_SESSION (primary handoff) → PROJECT_STATE → PROJECT_DASHBOARD → WORK_LOG; ADRs/Blueprint normative.

Next Objective:

Production Completion Pack 02B — Language Registry API / canonical registry foundation.

---

## 2026-08-30 (Production Completion Pack 02A — Multilingual Architecture Audit)

Completed:

- READ-ONLY audit of language/translation/search/SEO/Admin/outbox foundations.
- Approved Pack 02B–02J sequence; verification locales `en`, `uk`, `zh-Hant`, `ar`.
- Summary: `architecture/recovery/PRODUCTION_COMPLETION_PACK_02A_MULTILINGUAL_AUDIT_v1.0.md`.

Architecture:

- Admin-managed Language Registry direction; English fallback; translations never overwrite canonical source; SEO readiness independent of language enablement.

Next Objective:

Pack 02B Language Registry API (then documentation gate).

---

## 2026-08-30 (Production Completion Pack 01 / 01.1)

Completed:

- Pack 01 production completion surfaces (Admin diagnostics health, Support/ACTUC/country/account/editor refinements, config checklist).
- Pack 01.1: staging bootstrap Initiative cleanup + seed gate; lifecycle reconciliation diagnostic → Not available (neutral); staging Outbox failed-record recovery operator.
- Staging Admin Diagnostics verified Healthy after cleanup/API restart.

Next Objective:

Pack 02 multilingual architecture (02A audit → 02B registry).

---

## 2026-08-17 (Lifecycle Finalization Phase 05A)

Completed:

- Full STANDARD zero-community and PUBLIC_CHOICE golden-path certification (`pnpm verify:initiative-lifecycle`).
- Fixed Revision bootstrap progress leak, Petition visibility contradiction, empty Proposals publish, Mongo snapshot write races.
- Create Initiative lifecycleProfile selector; Phase 05A report.

Next Objective:

Human staging acceptance → commit/deploy Phase 05+05A → Phase 06.

---

## 2026-08-16 (Mongo test isolation hardening Pack 01)

Completed:

- Prevention hardening after Atlas 500-collection incident: owned `hu_test_*` / `hu_verify_*` cleanup contracts, protected DB fail-closed rules, collection-pressure gate, permanent `inspect:mongo-topology`.
- Document: `architecture/recovery/MONGODB_TEST_ISOLATION_HARDENING_PACK_01_REPORT_v1.0.md`.

Next Objective:

Finalize/commit/deploy Lifecycle Finalization Phase 05.

---

## 2026-08-16 (Mongo collection topology audit)

Completed:

- READ-ONLY Atlas collection-cap diagnosis after staging API deploy failure at 500/500.
- Document: `architecture/recovery/MONGODB_COLLECTION_TOPOLOGY_AUDIT_v1.0.md`.
- Phase 04 +1 collection trigger; root cause leaked `hu_test_*` / `hu_verify_*` DBs; read-only `inspect:mongo-topology` helper.

Next Objective:

Approved remediation: drop abandoned test/verify databases only; restore staging API; keep Phase 05 local until then.

---

## 2026-08-16 (Lifecycle Finalization Phase 05)

Completed:

- INITIATIVE LIFECYCLE FINALIZATION — PHASE 05 Collective Participation Journey.
- Document: `architecture/recovery/INITIATIVE_LIFECYCLE_FINALIZATION_PHASE_05_REPORT_v1.0.md`.
- One journey read model; next-action resolver; Experience + Workspace-ready APIs; compact Your Participation UI; ledger gaps documented without a second ledger.

Next Objective:

INITIATIVE LIFECYCLE FINALIZATION — PHASE 06.

---

## 2026-08-16 (Lifecycle Finalization Phase 04)

Completed:

- INITIATIVE LIFECYCLE FINALIZATION — PHASE 04 uniform Author workflow.
- Document: `architecture/recovery/INITIATIVE_LIFECYCLE_FINALIZATION_PHASE_04_REPORT_v1.0.md`.
- Author workflow contract; Discussion completion marker; Revision/Petition save→publish + validation UX; Improvement Proposals durable default; lazy-init helper.

Next Objective:

INITIATIVE LIFECYCLE FINALIZATION — PHASE 05.

---

## 2026-08-16 (Lifecycle Finalization Phase 03)

Completed:

- INITIATIVE LIFECYCLE FINALIZATION — PHASE 03 experience shell resilience.
- Document: `architecture/recovery/INITIATIVE_LIFECYCLE_FINALIZATION_PHASE_03_REPORT_v1.0.md`.
- One shell; selected vs current stage; Author Mode via stewardship; PUBLIC_CHOICE nav; Revision→Petition lazy regression; petition legacy redirect.

Next Objective:

INITIATIVE LIFECYCLE FINALIZATION — PHASE 04 (Uniform Author workflow convergence).

---

## 2026-08-16 (Lifecycle Finalization Phase 02 — Architecture Review Addendum)

Completed:

- Corrected PUBLIC_CHOICE to Initiative → Discussion → Collective Decision → Archive.
- Distinguished NOT_CREATED_YET from INFRASTRUCTURE_FAILURE with Experience diagnostics.
- Resolver postcondition after publish (Discussion→Analysis / Discussion→Collective Decision / Revision→Petition).
- LAZY next-stage strategy documented; Analysis route classified COMPATIBILITY_READ_ONLY.

Next Objective:

Await Phase 02 acceptance; do not start Phase 03 yet.

---

## 2026-08-16 (Lifecycle Finalization Phase 02)

Completed:

- INITIATIVE LIFECYCLE FINALIZATION — PHASE 02 architecture convergence.
- Document: `architecture/recovery/INITIATIVE_LIFECYCLE_FINALIZATION_PHASE_02_REPORT_v1.0.md`.
- LifecycleProfile (STANDARD | PUBLIC_CHOICE); derived state resolver; Experience soft-fail; Revision communitySlug optional; legacy Analysis compat read; transition helpers.

Next Objective:

INITIATIVE LIFECYCLE FINALIZATION — PHASE 03 (Experience shell resilience + Stage URL quarantine).

---

## 2026-08-16 (Lifecycle Finalization Phase 01)

Completed:

- INITIATIVE LIFECYCLE FINALIZATION — PHASE 01 audit.
- Document: `architecture/recovery/INITIATIVE_LIFECYCLE_FINALIZATION_AUDIT_v1.0.md`.
- Finding: local file/memory vs staging Mongo; fragile `/experience`; no single current-stage authority; Ally-only notifications; forensic chains for initiative-1785948978037.

Next Objective:

INITIATIVE LIFECYCLE FINALIZATION — PHASE 02 (canonical state + persistence convergence).

---

## 2026-08-16 (Lifecycle UX Pack 01)

Completed:

- LIFECYCLE UX COMPLETION PACK 01 — Collective Decision Participant Voting.
- Ballot in Initiative lifecycle PublicResult; reuses existing vote API (support / do_not_support / abstain).
- Auth/eligibility gated by backend; Author Mode unchanged; ledger cast/changed path preserved.

Next Objective:

Lifecycle UX Phase 2 — Improvement Proposals durability + shell primacy.

---

## 2026-08-16 (Lifecycle UX audit)

Completed:

- LIFECYCLE UX COMPLETION — CURRENT-STATE AUDIT.
- Document: `architecture/recovery/LIFECYCLE_UX_CURRENT_STATE_AUDIT_v1.0.md`.
- Finding: Author Mode Analysis→Archive largely present; largest gaps = Collective Decision vote UI, Participant journey UX, Improvement Proposals memory-default, legacy Stage/Activity parallels.

Next Objective:

LIFECYCLE UX COMPLETION — PHASE 1: Collective Decision Vote in Initiative Shell.

---

## 2026-08-16 (Recovery phase closure)

Completed:

- RECOVERY PHASE CLOSURE — STAGING VERIFIED PASS.
- Approved historical staging recovery Packs 01–05 marked CLOSED.
- Operator verify:staging PASS (allies 6 / activeAllies 5; RSS 16 sources; news snapshot 54; loginReady 5/5; media/cards PASS).
- `NEWS_PROVIDER_ENABLED=true` recorded as configured on staging API.

Architecture:

- Initiative-root + Participant-first rules unchanged.
- Excluded Activity/Discussion/Proposal/Decision roots remain excluded.

Next Objective:

LIFECYCLE UX COMPLETION — CURRENT-STATE AUDIT (no implementation until audit completes).

---

## 2026-08-16 (Pack 05)

Completed:

- STAGING FEATURE RECONCILIATION PACK 05 tooling.
- Allies/collaboration portable records (6 allies, 4 channel messages, 8 reads).
- Public Initiative 50/50 hero + full-width description.
- Mini-card / world-card whole-card navigation + compact typography.
- RSS strategy: re-ingest configured sources (not expired article dump); verify:staging RSS checks.

Next Objective:

Operator reconcile --execute + NEWS_PROVIDER_ENABLED refresh on staging.

---

## 2026-08-16 (Pack 04)

Completed:

- STAGING HISTORICAL DATA RECONCILIATION PACK 04 tooling.
- Portable reconciliation bundle (engagement + auth metadata; no password hashes).
- `pnpm reconcile:staging-historical-data` (dry-run default) + `pnpm verify:staging`.
- Web media rendering harden (InitiativeImage fallback reset; reject localhost media on staging/production hosts).
- Auth root cause documented: Pack 02 unusable hash + pending verification; restore compatible source bcrypt at execute.

Architecture:

- Initiative-scoped engagement only; legacy Activity/Discussion/Proposal/Decision roots excluded.
- Password hashes never committed to Git.

Engineering Notes:

- Real staging `--execute` not run in Cursor task.
- Proposals statistic correctly 0 while Improvement Proposals remain draft.

Next Objective:

Operator execute Pack 04 on staging + verify:staging.

---

## 2026-08-16

Completed:

- CHAT AGENT CONTINUITY PACK 01.
- AI recovery entry: `architecture/recovery/chat-agent/README.md` + paste prompt.
- Live command center synchronized (`PROJECT_DASHBOARD`, `PROJECT_STATE`, `NEXT_SESSION`).
- Recovery protocol points at chat-agent entry.
- Small status drift fixes (Admin roadmap Packs 02–05, staging verification wording, migration plan portable-bundle source).

Architecture:

- Repository remains source of truth for AI recovery.
- `NEXT_SESSION` remains canonical live handoff.
- Normative ADRs outrank stale live-state docs; superseded Activity-root ADR must not be treated as current.

Engineering Notes:

- Operator-verified staging migration/media outcomes and operator-observed UI/login/history gaps recorded in `PROJECT_STATE` / `NEXT_SESSION`.
- No application runtime, Mongo, or R2 changes in this Pack.

Next Objective:

STAGING HISTORICAL DATA RECONCILIATION PACK 04 (assessment/reconciliation — not started).

---

## 2026-07-02

Completed:

- Capability 02 Epic 02 officially completed.
- Guides 01–07 completed.
- Collaborative Analysis vertical slice operational.
- Platform Integration verified.
- Epic 02 Architecture Review approved.

Architecture:

- CollaborativeAnalysis confirmed as Epic 02 Aggregate Root.
- Public Collaborative Analysis Projection introduced.
- Immutable Contributions and derived Readiness validated.
- Capability vertical slice established: Domain → Store → API → Workspace → Public Projection → Integration.

Engineering Notes:

Command Center synchronized for Capability 02 Epic 02 completion.

Epic 02 vertical slice pending git commit.

Next Objective:

Plan Capability 02 Epic 03.

---

## 2026-07-01

Completed:

- Capability 02 Epic 01 officially completed.
- Guides 01–07 completed.
- Initiative vertical slice operational.
- Platform Integration verified.
- Epic 01 Architecture Review approved.

Architecture:

- Initiative confirmed as the Participation Aggregate Root.
- Public Initiative Projection introduced.
- Explicit Publicity and Multiple Projections validated.
- Capability vertical slice established: Domain → Store → API → Workspace → Public Projection.

Engineering Notes:

Command Center synchronized for Capability 02 Epic 01 completion.

Next Objective:

Plan Capability 02 Epic 02.

---

## 2026-06-30

Completed:

- Epic 02 officially completed.
- Capability Review completed.
- Epic 03 initialized.
- Member Preferences Domain designed.
- Domain Design completed.
- Domain Model completed.
- Guide 26 completed.
- Engineering Command Center established.

Architecture:

- Preferences confirmed as an independent Domain.
- Aggregate Root: MemberPreferences.
- Value Object architecture approved.
- Domain First principle adopted.
- Stable Domains principle adopted.
- Engineering Continuity introduced.

Engineering Notes:

Development methodology has matured into a repeatable engineering process.

Future implementation should extend the approved Domain rather than redesign it.

Next Objective:

Guide 27 — Member Preferences API.

---

## 2026-06-27

Completed:

- Capability 02 Epic 02 officially completed.
- Guides 01–07 completed.
- Collaborative Analysis vertical slice operational.
- Platform Integration verified.
- Epic 02 Architecture Review approved.

Architecture:

- CollaborativeAnalysis confirmed as Epic 02 Aggregate Root.
- Public Collaborative Analysis Projection introduced.
- Immutable Contributions and derived Readiness validated.
- Capability vertical slice established: Domain → Store → API → Workspace → Public Projection → Integration.

Engineering Notes:

Command Center synchronized for Capability 02 Epic 02 completion.

Epic 02 vertical slice pending git commit.

Next Objective:

Plan Capability 02 Epic 03.

---

## 2026-06-27

Completed:

- Epic 03 officially completed.
- Guides 27–30 completed.
- Preferences API operational.
- Preferences Workspace operational.
- Public Participation Profile projection operational.
- Architecture Review 05 passed.

Architecture:

- Member Preferences confirmed as an independent domain.
- Preferences API protected by authentication middleware.
- Public participation projection uses explicit visibility bootstrap.
- Domain-driven UI preserved across five preference sections.

Engineering Notes:

Guide 29 implementation remains pending git commit.

Documentation synchronized during Guide 30 review.

Next Objective:

Plan the next Epic of Capability 01.

---

# Rule

Every completed Guide should result in one new Work Log entry.

Engineering knowledge should never exist only in conversations.

It should always become part of the project history.
