# LANGUAGE & TRANSLATION ARCHITECTURE

Version: 1.0  
Status: Active (Provider-backed vertical slice)  
Pack: Language Architecture Pack 01–02

---

## Purpose

Humanity Union must support Participants who use different languages while **preserving original authored content**.

Primary principle:

```
Original Content  → preserved permanently
Translation       → separate representation
```

Machine translation **never** overwrites the original.

Browser Google Translate may remain a convenience layer. It is **not** the source of truth for multilingual content.

---

## Discovery summary (Pack 01)

### What existed

- `MemberPreferences.experiencePreferences` already stores `interfaceLanguage`, `readingLanguages`, `writingLanguages`, `translationPreference` (defaults `"en"` / `"none"`).
- Initiative / profile metadata may carry a free-form `language` string (typically `"en"`).
- No next-intl / Accept-Language middleware / `/en/` routes.
- Root layout hardcodes `<html lang="en">`.
- Lifecycle public/preview copy uses `LifecycleTranslatableText` / `translate="yes"` for **browser** Translate convenience.
- Notifications largely persist fully rendered English title/message at create-time.
- Assistant prompts did not receive preferred response language.

### Why browser Google Translate misses generated form values

Confirmed in Author Lifecycle editors (Petition, Collaborative Analysis, and other stage editors):

1. Browser Google Translate **skips `<input>` / `<textarea>` values**.
2. Editors use **React controlled state** (`value={field}`).
3. AI / generated drafts are applied into that state via events such as `LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT`.
4. While editing, those strings are not ordinary text nodes, so Translate cannot rewrite them.

Public/Preview surfaces intentionally render the same strings as text nodes so browser Translate can still help as a convenience — not as canonical storage.

---

## Language concepts

These are **not** necessarily identical:

| Concept | Meaning |
|--------|---------|
| **Original Language** | Language of the authored civic record |
| **Interface Language** | UI chrome language (menus, system labels) |
| **Preferred Reading Language** | Preferred language for reading civic content |
| **Translation Language** | Target language for an explicit translation action (e.g. Translate Draft) |

Canonical types live in `packages/types` (`language.ts`, `content-translation.ts`).

---

## Priority languages

Architecture supports at least:

English (`en`), Ukrainian (`uk`), Russian (`ru`), French (`fr`), Spanish (`es`), Chinese (`zh`), Hindi (`hi`), Arabic (`ar`), Hebrew (`he`).

Not all translations must exist yet. Missing translation falls back to original content.

RTL preparation applies to Arabic and Hebrew (`dir="rtl"`, logical CSS where practical).

---

## Original content rule

Every authored civic record preserves:

- original text
- original language (when known)
- author
- timestamp
- version

Published records remain traceable to the original. Translations never become a second civic entity.

---

## Translation record

Logical model (`TranslatedContentRecord`):

- `sourceRecordId`
- `sourceVersion`
- `sourceLanguage`
- `targetLanguage`
- `translatedContent`
- `translationProvider`
- `translationKind` (`machine` | `human` | `author-approved`)
- `createdAt`
- `stale` / `freshness` (`current` | `stale` | `regenerating`)

Storage strategy may vary by domain (side collection vs projection). The logical shape is stable.

---

## Lifecycle translation

The same published Lifecycle record may be read in multiple languages for:

Initiative → Discussion → Collaborative Analysis → Improvement Proposals → Revision → Petition → Decision Session → Collective Decision → Implementation Commitments → Implementation Tracking → Official Responses → Public Impact → Civic Archive.

Proposal/Analysis source traceability always points to **original** content.

---

## Author drafts

Do **not** silently translate editable Author forms.

Provide explicit assistance (e.g. **Translate Draft**):

1. Author chooses target language.
2. System creates a **working translated representation**.
3. Original draft remains preserved.
4. Controlled form values are never silently replaced.

API foundation: `translateDraft()` in `apps/api/src/modules/language/`.

---

## Public content display

If a current translation exists for the Participant’s preferred reading language:

- show translation
- offer **View Original**
- identify original language
- discreet **Machine translated** indicator when `translationKind === "machine"`

Fallback chain:

```
preferred translation
  → other approved translation (if policy allows)
  → original content
```

Never render empty content merely because translation is unavailable.

Stale translations must **not** be presented as current.

UI foundation: `TranslatedContentView`.

---

## Google Translate role

Allowed: optional convenience for ordinary text nodes.

Not reliable for:

- controlled inputs
- editable forms
- dynamically generated values held in React state
- canonical translated records

Do not depend on DOM mutation for platform data architecture.

---

## Translation provider abstraction

`TranslationProvider` seam (provider-independent):

Possible future implementations:

- Gemini Translation
- Google Cloud Translation
- DeepL
- other approved providers

Pack 01 ships `DeterministicTranslationProvider` for tests/offline.

Pack 02 adds `GeminiTranslationProvider` behind `TRANSLATION_PROVIDER=deterministic|gemini` (reuses server-side `GEMINI_API_KEY`). Domains must not import Gemini directly — only the provider adapter may.

Cache key: `sourceKind::sourceRecordId::sourceVersion::targetLanguage` — avoid repeated provider calls for identical pairs. Idempotent `getOrCreateContentTranslation` enforces uniqueness.

---

## Assistant language

Humanity Union Assistant receives:

- interface language
- preferred response language
- source content language (when known)

It should respond in the Participant’s preferred language when safely supported, preserve semantic meaning across languages, and must **not** ingest private Direct Messages for translation automatically.

---

## Multilingual Discussion

Architecture preparation:

- Participant writes a comment in language A
- Another Participant may read a translation in language B
- Original remains accessible
- Traceability for Proposal/Analysis sources points to originals

Full Discussion translation UX is a later implementation pack.

---

## Notifications

Prepare template-key localization (`resolveNotificationTemplate`).

Render in the recipient’s preferred language where a locale pack exists; otherwise fall back to English templates.

Do not treat one English-only fully rendered body as the only long-term canonical representation when template-based localization is available.

Migration of existing persisted English bodies is a later pack — no bulk production rewrite here.

---

## Messages (privacy)

Pack 01 does **not** automatically translate private Direct Messages.

Future message translation requires explicit privacy review.

Messages remain original-language content. Assistant must not ingest private messages for translation automatically.

---

## RTL

Helpers: `isRtlLanguageCode`, `documentDirectionForLanguage`.

Pack 02: root document `lang` / `dir` driven from Interface Language (`DocumentLanguageAttributes`). Guests keep `en` / `ltr`.

Remaining blockers before full rollout:

- many physical CSS properties (`left`/`right`, `margin-left`) instead of logical properties
- sidebars / FAB assume LTR edges
- public Lifecycle chrome not fully mirrored

Do not redesign the entire platform in Pack 01–02.

---

## Search

A translated record must not become a duplicate civic entity.

Future multilingual search should match original and approved translation text while returning the **same** canonical entity.

Large search redesign is out of scope for Pack 01.

---

## URL / routing

**Decision (Pack 01):** locale belongs primarily in **profile preference** (`interfaceLanguage` / reading languages).

Do **not** add `/en/`, `/fr/` URL prefixes automatically.

Preserve existing public URLs. Hybrid (preference + optional cookie) may be considered later.

---

## Safety

- Safety decisions refer to **canonical source content**.
- Translated content must not bypass Safety moderation.
- Machine translation must not convert rejected content into an accepted civic record.
- If moderation of translated output is required later, define it as a separate step.

---

## Migration / compatibility

Existing records without language metadata continue to work.

Safe default / fallback language: **`en`** (matches current Initiative, profile, preferences, and layout conventions).

Do not bulk-migrate production data without an explicit migration plan.

---

## Performance

Avoid translating entire Lifecycle graphs on every request.

Translation should be:

- version-aware
- cacheable
- on-demand or asynchronously generated

---

## Accessibility

- correct `lang` on active content
- RTL `dir` where applicable (future root wiring)
- translated controls retain text labels (not flag-only)
- View Original is keyboard accessible
- screen readers receive the active language via `lang`

---

## Implementation map (Pack 01)

| Area | Location |
|------|----------|
| Types | `packages/types/src/domain/language.ts`, `content-translation.ts` |
| API foundation | `apps/api/src/modules/language/` |
| Assistant language context | `platform-assistant.service.ts`, `build-lifecycle-ai-prompt.ts` |
| Web display | `apps/web/src/features/language/` |
| Browser Translate note | `LifecycleTranslatableText.tsx` |

---

## Pack 02 — Provider-backed vertical slice (implemented)

### Real provider

- `GeminiTranslationProvider` implements `TranslationProvider`.
- Config: `TRANSLATION_PROVIDER=deterministic` (default/tests) or `gemini` (dev/real).
- Reuses `GEMINI_API_KEY` server-side only — never exposed to Web env, responses, or logs.
- Bounded HU terminology glossary injected into provider requests.

### Persistence

- `TranslatedContentRecord` with `sourceKind` for Initiative / Collaborative Analysis / Petition.
- Memory + Mongo (`content_translations`) with unique identity index.
- Version-aware staleness: older `sourceVersion` → stale → fallback to original.

### Public surfaces

- Initiative hero title/description via translation resolve/generate.
- Published Collaborative Analysis and Petition via `PublicTranslatedFields` + `TranslatedContentView`.
- Machine translated label + View Original toggle.
- Existing public URLs unchanged (no locale prefixes).

### Author drafts

- Reusable `TranslateDraftControl` on Petition and Collaborative Analysis editors.
- `POST /api/v1/translations/draft` (auth + rate limit); never mutates canonical draft.
- Explicit apply action required to replace local editor state.

### Preferences / document semantics

- Preferences → Language & Translation section (existing preference fields).
- `translationPreference`: `none` | `preferred` | `ask` (actual contract).
- Root `lang`/`dir` from Interface Language.

### Notifications

- Foundation wired: generic lifecycle stage published copy can resolve via `resolveNotificationTemplate` using recipient Interface Language.
- Stage-specific fixed English wording retained until a dedicated localization pack expands locale packs.

### Privacy / safety

- No automatic DM / Collaboration Channel / private chat translation.
- Draft endpoint refuses private-message-shaped payloads.
- Provider requires `safetyCleared`; failures fall back to original.

### Rate limiting

- Generate + Translate Draft use per-user/IP translation rate limiter.

---

## Recommended next pack

**Language Architecture Pack 03 — Full Lifecycle Translation Rollout**

Bounded scope:

1. Remaining Lifecycle stages (Improvement Proposals → Civic Archive) on the same translation boundary.
2. Expand notification locale packs for stage-specific fixed copy.
3. Incremental RTL logical-CSS migration for high-traffic shells.
4. Optional Discussion comment translation UX (still original-preserving).

Out of scope unless separately approved: automatic DM translation, multilingual search rewrite, whole-platform CSS redesign.

---

## Production Completion Pack 02 sequence (handoff)

| Pack | Focus |
|------|--------|
| 02A–02E | Audit → Registry → runtime locale → UI i18n → chrome extraction (**COMPLETE** + staging PASS where recorded) |
| 02F | Canonical Terminology Glossary (**COMPLETE + STAGING PASS**, `98c2817`) |
| 02G | Civic/public translation expansion + async warming — **IN PROGRESS** (Tasks 01–06 COMPLETE locally; Task 07 staging pending — **not** STAGING PASS) |
| 02H | Multilingual search seam |
| 02I | Multilingual SEO |
| 02J | Remaining multilingual hardening; **formal Multilingual Layout Resilience Gate** |

### Pack 02G design (Task 01 audit — extend, do not replace)

**Current pipeline (on-demand only):**

```
published civic source fields
  → loadTranslatableSource (allowlisted kinds/fields)
  → sourceVersion (content hash + updatedAt; blog includes publishedVersion)
  → mark stale rows for older versions
  → content_translations identity: sourceKind + sourceRecordId + sourceVersion + targetLanguage
  → TranslationProvider (+ terminologyContext from Pack 02F glossary)
  → resolveStructuredTranslatedDisplay (preferred → approved → original)
  → Web PublicTranslatedFields / PublicExperienceHero (may POST generate when preference=preferred)
```

**Already eligible + public-wired:** `initiative`, `collaborative_analysis`, `petition`.
**Loader exists, UI deferred:** `blog_post` (plain-text of HTML).
**Enum only / empty allowlist / not warm-eligible:** `lifecycle_stage` (draft assist; not generic civic path).

**Task 03 civic sourceKinds (loaders + allowlists shipped; Web resolve UI deferred to Task 05/06):**

| sourceKind | Public eligibility | Version stamp | Privacy notes |
|------------|-------------------|---------------|---------------|
| `improvement_proposal` | public projection non-null | `updatedAt` | public narrative fields only |
| `initiative_revision` | published revision projection | `publishedAt` + version | structured `changes` JSON |
| `decision_session` | public projection non-null | `publishedAt` | structured content JSON |
| `collective_decision` | public projection non-null | closed/opened/closes stamp | structured content JSON |
| `implementation_commitment` | public projection non-null | published/completed/withdrawn | public commitment text |
| `implementation_tracking` | public projection non-null | `updatedAt` | executionHistory titles/summaries |
| `official_response` | `getPublicOfficialResponse` | publishedAt/receivedAt | **never** rawSource/headers/providerMetadata |
| `public_impact` | public projection non-null | verified/published/archived | evidence title/description only |
| `civic_archive` | public archive projection | archivedAt + archivedVersion | **never** verification metadata |
| `civic_media` | singleton `civic-media-center` | center `updatedAt` | editorial overview/FAQ/principles/flow only; no media resource rows/URLs/SVG |

**Deferred (explicit):** Discussion comments; Blog UI expansion; Cap02 legacy collective/commitment paths as alternate kinds; Part D structured improvement-proposal collections; `lifecycle_stage` as generic discriminator.

**Pack 02G automatic warming (Task 04 shipped):**

```
eligible public mutation (after persistence)
  → enqueue ContentTranslationWarmRequested (sourceKind + sourceRecordId + reason; pending dedupe)
  → existing Mongo outbox dispatcher
  → warm consumer reloads public source + Registry targets (enabled && contentTranslationEnabled)
  → getOrCreateContentTranslation(intent=automatic_warm) per locale (bounded concurrency)
  → content_translations cache (identity: sourceKind+sourceRecordId+sourceVersion+targetLanguage)
  → public read uses cached translation (Task 05 wires new kinds)
  → canonical original fallback if missing/stale/provider failure
```

**Task 02 contract (shipped):**

- Intent: `on_demand` | `automatic_warm` (same engine; different locale gates)
- Warm targets: `listAutomaticContentTranslationTargetLocales` / `assertAutomaticContentTranslationTargetLocale`
- Source eligibility: published + field allowlist + `safetyCleared` (warm cannot bypass)
- Version: `buildContentTranslationSourceVersion`
- Work identity: `buildContentTranslationWorkIdentity` / `…Key`

**Task 04 durable contract (shipped):**

- Event/command: `ContentTranslationWarmRequested` (catalogue + types); payload is source identity only (no body/locale snapshot/secrets)
- Outbox: reuse existing `outbox` + `processed_events`; aggregateId = `sourceKind::sourceRecordId`
- Pending dedupe: skip enqueue if pending row exists for same aggregate; later updates enqueue after prior published/failed
- Consumer: `content-translation-warm-v1`; reloads source; skips missing/ineligible without hot-loop; retryable locale failures rethrow for outbox retry
- Concurrency: `CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY` (default 2, max 8) + content_translations unique identity
- Language enable policy: enabling `contentTranslationEnabled` does **not** auto-scan DB; operator uses `enqueueContentTranslationWarmRequested` / memory/manual per source (staging procedure in NEXT_SESSION/WORK_LOG)
- Deferred hooks: `civic_media` (static content), `blog_post` auto-warm, Discussion comments

**Task 04 seams (wired):** Domain publish/update methods for Initiative, Collaborative Analysis, Petition, and Task 03 civic kinds (incl. lifecycle createCommitment/createTracking). Most civic modules remain post-persistence best-effort enqueue (no shared Mongo session with file-backed stores).

**Task 05 public read (shipped):**

- Shared display: `PublicTranslatedFields` + `CivicPublicTranslatedSection` (civic kinds disable on-demand generate).
- Cached-first: GET `/api/v1/translations/resolve` with `generateIfMissing=false`; missing/stale → canonical.
- Preference: none → original; ask → original default + canViewTranslation; preferred → current cached translation.
- Initiative/Analysis/Petition retain optional POST `/generate` when preferred + cache miss.
- SourceVersion identity enforced by resolve path; never serve stale as current.
- Wired Web: improvement-proposal, revision, decision-session, collective-decision, commitment, tracking, official-response, public-impact, civic-archive (detail narrative + list cards), `/media` editorial (`civic-media-center`).
- Deferred: Blog UI; Discussion; SSR pre-resolve of translations (client hydrate after canonical SSR — flicker remains a known residual; not a Task 06 blocker).

**Task 06 layout resilience (shipped — Pack 02G scope):**

- Shared: `translated-content-view.css`, `public-translated-fields.css` — vertical growth, `min-width:0`, `overflow-wrap:anywhere` / `word-break:break-word`, wrapable toggles, no content-destructive overflow on narrative body.
- Archive: mini/record cards grow with title/summary (line-clamp removed); detail narrative containers; logical carousel fades.
- Media: `.civic-media-translated-editorial` wrap contract; resource headings wrap; FAQ list wrap (resources/SVG translation scope unchanged).
- Public shells touched for Pack 02G + Initiative/Analysis/Petition regression: `text-align:start`, `padding-inline-start`.
- Stress fixtures: `layout-stress-fixtures-pack02g-task06.ts` (en/uk/zh-Hant/ar + pathological + long URL).
- Tests: `content-translation-pack02g-task06.web.test.ts` (CSS/source contracts). Viewport `scrollWidth` gate deferred to Task 07 / Pack 02J.
- Remaining Pack 02J: app-wide RTL, admin/workspace/PWA, formal WCAG, screenshot baselines, trusted-media card line-clamps outside editorial.

**Registry flags (do not conflate):**

| Flag | Pack 02G role |
|------|----------------|
| `enabled` | Selectable locale / UI runtime; on-demand generate gate |
| `contentTranslationEnabled` | **Required gate for automatic content warming** |
| `uiTranslationStatus` | UI catalog completeness — not content warm |
| `searchEnabled` | Pack 02H |
| `seoIndexingEnabled` | Pack 02I |

**Explicitly out of Pack 02G:** Discussion comment UX; DMs; private Participant/admin/moderation/shipping/auth data; multilingual search (02H); SEO (02I); formal layout gate (02J).

### Multilingual Layout Resilience Gate

**Name (exact):** Multilingual Layout Resilience Gate

**Acceptance principle:** Translated text may change component dimensions, but must never:

- overlap adjacent content
- escape its semantic container
- cause unintended horizontal page scrolling
- make essential actions unreadable or inaccessible

**Progressive application:**

- Applies **progressively from Pack 02G** as civic/public translation surfaces expand (**Task 06 progressive hardening COMPLETE** for Pack 02G civic surfaces).
- Becomes a **formal acceptance gate in Pack 02J**.

**Future gate coverage (do not implement the full system in Pack 02F):**

- long-text expansion
- Ukrainian / longer Latin-Cyrillic strings
- zh-Hant / CJK wrapping
- Arabic RTL
- buttons without English-fixed widths
- auto-height cards/widgets
- flex/grid `min-width: 0`
- safe wrapping / long words / URLs
- responsive navigation
- forms/modals/errors
- logical RTL CSS
- no masking layout defects with inappropriate `overflow: hidden`
- ellipsis only where information loss is acceptable

**Engineering support (future):** synthetic long-string / pseudo-localization stress mode for CI and staging acceptance.

---

## Pack 08I.15 — Universal Participant-Facing Translation Coverage

**Permanent engineering rule:**

> Participant-facing semantic text is localizable by default.  
> Canonical-language rendering without localization ownership is an explicit exception, not the default.

### Ownership classes

| Class | Owner | Pipeline |
|-------|--------|----------|
| `WEB_UI` | next-intl catalogs | Deterministic chrome |
| `CIVIC_CONTENT` | `content_translations` + TranslationProvider | Canonical civic prose |
| `BRAND_LOCALIZATION` | Admin Brand Localization | Manual — never Gemini |
| `LEGAL_LOCALIZATION` | Admin Legal Localization | Manual — never Gemini |
| `CONTROLLED_TERMINOLOGY` | Terminology Glossary | Controlled vocab / provider context |
| `NON_TRANSLATABLE` | Explicit registry | IDs, emails, URLs, metrics, codes, proper-name policy |

### DEFAULT_LOCALIZABLE mechanism

- Unknown participant-facing semantic prose classifies as **`CIVIC_CONTENT`**, not as silent English.
- Presentation surfaces must not invent per-component allowlists of `"title" | "description" | …`.
- Provider **field allowlists** remain a safety boundary for what enters Gemini payloads; they are not the presentation coverage model.
- New CIVIC artifact types register **once** (sourceKind + loader + warm discovery + public resolver). New cards/rails consume the shared presentation contract.

### Presentation invariant

Public civic UI consumes localized presentation/view models (`useInitiativePublicPresentation`, `useInitiativeCardTitlePresentation` / `useCivicInitiativeLocalizedTitle`, `PublicTranslatedFields`, `CivicPublicTranslatedSection`). Raw `{initiative.title}` / `{petition.summary}` style bindings on governed surfaces are coverage-gate violations.

Public Choice is an Initiative lifecycle profile — same Initiative localization contract; no `public_choice` sourceKind.

### Discovery / materialization invariant

Eligible public CIVIC_CONTENT → discoverable via staging warm enumerator / mutation warm → CURRENT translation → presentation resolver → DOM. Enqueue ≠ materialization (Pack 08I.14B.3).

### Coverage gate

`apps/web/src/features/language/universal-localization-coverage-gate.ts` reports:

- `PUBLIC_SEMANTIC_BYPASS`
- `UNCLASSIFIED_PARTICIPANT_TEXT`
- `BRAND_MACHINE_TRANSLATION_BYPASS`
- `LEGAL_MACHINE_TRANSLATION_BYPASS`
- `NON_TRANSLATABLE_VIOLATION`

Governed Initiative-path mounted surfaces target **0** unexpected bypasses. Remaining Blog/Media/Knowledge/search/PWA/CI debt must be **explicitly registered**.

### CIVIC_CONTENT manual override

`translationKind` supports `human` | `author-approved` in the model and display can prefer approved rows, but **no Admin write path** persists those kinds for civic content today. Brand/Legal remain the only Admin-approved localization systems.

---

## Pack 08J — Universal Automatic Translation Architecture

**Normative translation policy:**

1. **UI text** → next-intl / native dictionaries (`WEB_UI` ≡ UI_CHROME). Never Gemini.
2. **Public/participant-facing semantic content** → `CIVIC_CONTENT` ≡ AUTO_TRANSLATABLE_CONTENT **by default**.
3. **Admin/manual localization** (Brand/Legal) → authoritative; never machine-overwritten.
4. **Identity / private / technical values** → `NON_TRANSLATABLE` via central exclusion policy; never enter Gemini.
5. **Canonical source is immutable.**
6. **Translation is cached** in `content_translations`, **bounded** (`CONTENT_TRANSLATION_WORKER_CONCURRENCY` default 1), **asynchronous**, and **restart-safe** via outbox.
7. **New participant-facing content inherits translation automatically** through mutation warm — no normal operator warm/repair.

### Developer workflow (future features)

1. Persist canonical domain data.
2. Expose a **sanitized participant-facing presentation projection** (string field bag / nested presentation object).
3. Mark only protected identity/technical keys (NON_TRANSLATABLE policy) — do **not** edit a central title/description allowlist to enroll prose.
4. Call `scheduleContentTranslationWarmAfterMutation` after public create/publish/update (or reuse the shared post-persist helper).
5. Render via shared presentation contracts (`PublicTranslatedFields` / Initiative presentation owners / `applyTranslatedPresentationFields`).

`CONTENT_TRANSLATION_FIELD_ALLOWLIST` is a **compatibility shim** unioned with projection keys. It is **not** the primary enrollment gate.

### Operator tooling

`warm:staging-content-translations` is **recovery / migration only**. It must `process.exit` after disconnect (Mongo heartbeats must not hang the shell). Normal create/publish/update must not require this CLI.

## Pack 08J.1 — Runtime Universal Translation Completion

**Problem:** `CURRENT` row counts ≠ universal runtime presentation. Surfaces can still render canonical English when (a) UI locale ≠ authenticated `readingLanguages[0]`, (b) stale `sourceVersion` caused English reversion, (c) projection families (Blog/Media trusted prose) were outside recovery discovery, or (d) components bypassed the shared presentation boundary.

**Runtime boundary:**

```
sanitized participant-facing projection
  → resolveLocalizedPresentation / PublicTranslatedFields (UI displayLanguage)
  → applyTranslatedPresentationFields walker
  → React render
```

**Pack 08J.1 rules:**

1. Interface/document locale drives content resolve language on Blog, Media, Discussion, Lifecycle, and Initiative surfaces.
2. Stale preferred CURRENT rows are **consumed** (marked `isStale`) rather than silently reverting to English.
3. `civic_media` projection includes `trustedMediaExplanations` (names/URLs remain NON_TRANSLATABLE).
4. Recovery discovery (`CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS`) includes `blog_post` + `civic_media` + civic lifecycle families — metrics must describe the real corpus.
5. Coverage gate requires `RAW_CANONICAL_RENDER_BYPASS = 0` on governed mounted surfaces.

### KEEP / SIMPLIFY summary

| Piece | Decision |
|-------|----------|
| Ownership + DEFAULT_LOCALIZABLE | KEEP (+ synonyms) |
| Allowlist as presentation gate | REPLACE with exclusion policy |
| Outbox + warm consumer + worker slots | KEEP |
| Brand / Legal / Terminology | KEEP |
| Staging warm as normal ops | DEPRECATE → recovery-only |
| Second translation engine | NEVER |

---

## Pack 08K — PublicLocalizedPresentation (end-to-end guarantee)

**Supersedes** the acceptance strategy of Pack 08J / 08J.1 for participant-facing semantic coverage.

### PublicLocalizedPresentation

One architectural boundary for participant-facing semantic data:

```
DOMAIN DATA
  → SANITIZED PUBLIC PRESENTATION (PublicPresentationNode)
  → PUBLIC LOCALIZATION BOUNDARY (localizePublicPresentation / ensureLocalizedPublicPresentation)
  → LOCALIZED PRESENTATION (PublicLocalizedPresentation)
  → REACT
```

- Recursive tree: strings, nullable strings, arrays, nested objects.
- Plain strings are **AUTO_TRANSLATABLE by default**.
- Coverage statuses: `COMPLETE` | `FALLBACK_CANONICAL` | `STALE` | `MANUAL` | `SOURCE_LANGUAGE`.
- `COMPLETE` requires zero canonical fallbacks and zero stale nodes. Partial trees (e.g. 4/5 petition paragraphs) must report `FALLBACK_CANONICAL`, never `COMPLETE`.

Contract types live in `packages/types/src/domain/public-localized-presentation.ts`.
Engine: `apps/api/src/modules/language/public-localized-presentation.ts` (web mirror under `apps/web/src/features/language/`).

### AUTO default / explicit protection

Automatic translation is the default. Protection is an explicit, closed exception set — never inferred from English property names alone:

| Helper | Category |
|--------|----------|
| `protectedIdentity` | names, outlet names, usernames |
| `protectedTechnical` | IDs, URLs, slugs, codes, metrics |
| `protectedPrivate` | auth/secrets/private notes |
| `manualLocalizedValue` | Brand/Legal/human-approved |
| `uiDictionaryValue` | UI chrome (next-intl) |
| `controlledTerminologyValue` | glossary-controlled terms |

### Residual debt CLOSED (Pack 08K)

Previously registered 08J.1 intentional debt for **Search / PWA / Knowledge / CI** (and related rails) is **CLOSED**.

Those surfaces **must**:

- build sanitized `PublicPresentationNode` trees (see `apps/web/src/features/language/adapters/*`), and
- render semantic prose from `PublicLocalizedPresentation`, **or**
- use `uiDictionaryValue` / next-intl catalogs for chrome only.

`INTENTIONAL_LOCALIZATION_DEBT` must remain **empty**. There is **zero unnamed** residual participant-facing translation debt at Pack 08K acceptance.

Proof fixtures: `apps/api/test/unit/language/pack08k-fixtures.ts`  
Proof tests: `apps/api/test/unit/language/content-translation-pack08k-proofs.unit.test.ts`  
Browser acceptance: `apps/web/src/features/language/pack08k-browser-acceptance.test.ts`  
Route matrix: `project/architecture/core/PACK08K_ROUTE_BOUNDARY_MATRIX.md`  
Developer one-pager: `project/architecture/core/PUBLIC_LOCALIZATION_DEVELOPER_CONTRACT_v1.0.md`

---

## Pack 08K.1 — Real corpus reconciliation operator

Historical migration only. Future content continues through normal automatic publication scheduling (`notifyPublicPresentationChanged` / mutation warm).

### Shared discovery

```
DIAGNOSTIC_DISCOVERY === RECONCILIATION_DISCOVERY
```

Both `diagnose:public-localization -- --mongo` and `reconcile:public-localization` call `discoverPublicLocalizationCorpus` / `auditPublicLocalizationCorpus` (`apps/api/src/modules/language/public-localization-corpus.ts`).

### Counter semantics

| Counter | Meaning |
|--------|---------|
| `SOURCE_PRESENTATION_COUNT` | Discovered public presentation identities (`sourceKind` + `sourceRecordId`). Formerly `IDENTITY_COUNT`. |
| `TARGET_TRANSLATION_IDENTITIES` | `SOURCE_PRESENTATION_COUNT` × Registry locales with `enabled && contentTranslationEnabled`. |
| `MISSING_TARGET_TRANSLATION_IDENTITIES` | Presentation × target-locale slots lacking CURRENT translation for live `sourceVersion`. Formerly `MISSING_TRANSLATION_IDENTITIES`. |
| `PRESENTATIONS_WITH_ANY_FALLBACK` | Presentations with ≥1 canonical fallback semantic node. |
| `DISCOVERY_STATUS` | `COMPLETE` \| `PARTIAL` \| `FAILED`. Partial/failed cannot claim universal corpus success. |

### Operator

```
pnpm --filter @hu/api reconcile:public-localization -- --mongo          # dry-run (default)
pnpm --filter @hu/api reconcile:public-localization -- --mongo --explain-residuals
ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true \
  pnpm --filter @hu/api reconcile:public-localization -- --mongo --execute
```

- Dry-run: zero provider calls, zero DB/outbox writes.
- `--explain-residuals`: safe residual identity diagnostics (no source/translated bodies).
- Execute requires `--execute` + `ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true` + database `humanity_union_staging`; production refused.
- Enqueues presentation-level warms via existing bounded consumer (`CONTENT_TRANSLATION_WORKER_CONCURRENCY` default 1).
- Wait: `--wait-for-materialization --timeout-ms=<n>` polls compact translation identities only.

---

## Pack 08K.2 — Residual materialization diagnostics

### Collective Decision root cause

Warm events were enqueued, but the warm consumer loaded `null` because the Collective Decision in-memory Map was never re-bound after Mongo hydrate (unlike Initiative / Collaborative Analysis). Operator bootstrap also omitted CD hydrate+sync. The consumer previously treated missing source as a **successful skip**, so outbox was acknowledged without `content_translations` rows → identities stayed **MISSING** (not FAILED).

Fix: `syncInitiativeCollectiveDecisionStoreAfterMongoHydrate` + hydrate/sync in operator + full bootstrap; missing source now throws `SOURCE_UNAVAILABLE` (retryable) instead of silent success.

### Wait / residual state model

`CURRENT | QUEUED | PROCESSING | RETRYING | TERMINAL_FAILED | MISSING_AFTER_DISPATCH | MISSING | STALE`

Published outbox without a CURRENT row ⇒ `MISSING_AFTER_DISPATCH` (never indefinite PENDING).

---

## Pack 08K.2.1 — Residual retry readiness

Non-mutating retry preflight (`--explain-residuals`) reports `retryPreflight.ready` only when source resolves, presentation is eligible, locale is content-translation enabled, no CURRENT row, no active queued work, and either:

- plain MISSING after CD hydrate/sync fix (`COLLECTIVE_DECISION_HYDRATE_SYNC_08K2`), or
- historical terminal failure with `failureReasonCode=UNKNOWN_LEGACY` (`HISTORICAL_FAILURE_SEMANTICS_UNKNOWN_LEGACY_v1`).

Known validation codes (`UNCHANGED_CIVIC_TITLE`, `UNCHANGED_SOURCE_PROSE`, …) remain blocked until a concrete code/content fix. Future warm failures persist `CT_FAIL_META_V1:` safe metadata on outbox `lastError`.

---

## Pack 08K.2.3 — Terminal failure observability

First break (08K.2.2 post-retry diagnostics): **FAILURE_METADATA_WRITE=WRITTEN** on the new outbox event, but **FAILURE_METADATA_READ=STALE_EVENT** — `peekContentTranslationWarmOutboxFailure` returned an older FAILED row without structured metadata, so residuals still showed `UNKNOWN_LEGACY` and incorrectly stayed retry-ready via `HISTORICAL_FAILURE_SEMANTICS_UNKNOWN_LEGACY_v1`.

Fix: locale-precise latest-attempt resolver (`resolveLatestContentTranslationWarmAttemptForIdentity`) ordered by deterministic `attemptAt`/`eventId`; CT_FAIL_META_V1 gains optional `localeFailures[]`; modern terminal attempts (structured meta or `operator_residual_retry`) **block** the historical UNKNOWN_LEGACY retry basis. `--explain-residuals` reports `latestAttemptAt`, `failureMetadataVersion`, `failureReasonCode`, `retryPreflight.ready`, `blockReason` (no prose).

---

## Pack 08K.2.4 — Memory-safe residual diagnostics

**Incident:** `--mongo --explain-residuals` OOM'd staging by hydrating Initiative/CA/CD Maps and auditing the full PublicLocalizedPresentation corpus merely to explain four failures.

**Amplification (exact):**
1. `bootstrapContentTranslationOperatorPersistence` → full snapshot hydrate into Maps
2. `discoverPublicLocalizationCorpus` + `auditPublicLocalizationCorpus` → per-candidate presentation trees × locales
3. Unbounded outbox `toArray()` per residual (pre-bound)

**Fix:** `--explain-residuals` / `--explain-residuals-only` use `bootstrapContentTranslationResidualDiagnosticPersistence` (connect+registry only) + `explainResidualsOnly` (bounded failed-outbox discovery ≤100 rows, batch ≤25, direct-by-id source loads, bounded warm attempts ≤10). Counters: `DIAGNOSTIC_IDENTITIES`, `OUTBOX_ROWS_INSPECTED`, `SOURCE_RECORDS_LOADED`, `TRANSLATION_ROWS_LOADED`, `FULL_CORPUS_HYDRATED=false`.

**Debt:** Full corpus acceptance audit (default dry-run / `--execute` without residual-only) remains memory-heavy and must eventually be streamed separately. Residual diagnostics must never invoke it.

---

## Pack 08K.2.5 — Exact validation reasons + true residual selection

**Problem A:** Warm consumer collapsed exact validator `failureReasonCode` into the generic string `VALIDATION_FAILED` by re-classifying a synthetic `TranslationProviderError` and falling back to `diagnostic.failureClass` as the reason code.

**Fix:** Classify the **original** locale error; persist `materializationFailureClass` + exact `failureReasonCode`; `encodeContentTranslationFailureMetadata` forbids reasonCode `"VALIDATION_FAILED"` (rewrites to `OTHER_VALIDATION_FAILURE`). `failureClass` may still be `VALIDATION_FAILED`.

**Historical three staging generics:** When persisted 08K.2.2 meta already stores only `failureReasonCode=VALIDATION_FAILED`, exact historical reason is **NOT_RECOVERABLE_WITHOUT_PROVIDER_CALL**. Next warm attempt persists the exact modern validator code.

**Problem B:** Bounded failed-outbox discovery included identities whose live translation is already CURRENT.

**True residual:** live compact state for current `sourceVersion` is `MISSING` | `STALE` | `TERMINAL_FAILED`. CURRENT is filtered out.

**Discovery truth:**
- `RESIDUAL_DISCOVERY=BOUNDED_CANDIDATES` — capped failed-outbox sample; completeness **not** proven without full streamed corpus scan
- `RESIDUAL_DISCOVERY=EXPLICIT_IDENTITIES` — `--residual sourceKind:sourceRecordId:locale` (repeatable; read-only; no prose)

Counters add: `CANDIDATE_IDENTITIES_INSPECTED`, `RESIDUAL_IDENTITIES`, `CURRENT_IDENTITIES_FILTERED`. `RETRY_*` counts only residual output rows.

---

## Pack 08K.2.6 — Controlled post-fix diagnostic retry

One-time operator override for historical pre-08K.2.5 collapsed `failureReasonCode=VALIDATION_FAILED`, gated by:

```
--retry-explicit-residuals-after-failure-reason-fix
--residual sourceKind:sourceRecordId:locale   (required, repeatable)
[--execute --mongo --wait-for-materialization]
```

Architecture basis: `EXACT_FAILURE_REASON_PROPAGATION_08K25` (recorded on the warm attempt). Idempotent: a second attempt with that basis is refused. `INVALID_PROVIDER_PAYLOAD` remains selectable under normal `VALIDATION_DIAGNOSTICS_CONTRACT_v1` policy. No corpus hydrate; historical FAILED rows are not cleared. Cursor must not run this against staging/prod.

---

## Pack 08K.2.7 — Deterministic residual state resolution

**Incident:** Two consecutive dry-runs of the same four `--residual` identities returned different selection truth (`SELECTED=4` then `SELECTED=0` with `UNKNOWN_LEGACY` / CURRENT).

**Root causes:**
1. **READ_RESOLUTION_DEFECT** — Mongo latest-attempt listing used `sort({ createdAt: -1 })` without `eventId` tie-break; peek remapped sibling-locale structured failures to `published`, allowing older unrestricted legacy rows (`UNKNOWN_LEGACY`) to surface nondeterministically.
2. **EXPECTED_ASYNC_MATERIALIZATION** — dry-run writes nothing; `CURRENT` can only appear when a concurrent warm consumer upserts a translation row between invocations.

**Fix:** Canonical resolver (`content-translation-residual-state.ts`): CURRENT wins historical FAILED; locale-attributed CT_FAIL_META_V1 precedes locale-constrained attempts precedes unrestricted legacy; Mongo total order `createdAt DESC, eventId DESC`. Read-only `--snapshot-explicit-residual-state` emits decision inputs (no prose).

---

## Pack 08K.2.8 — Zero-hydration localization operator process

**Incident (staging `417c003`):** Read-only
`reconcile:public-localization --mongo --snapshot-explicit-residual-state --residual <4 ids>`
OOM-restarted the Render staging API. Inner resolver was bounded (`FULL_CORPUS_HYDRATED=false`), but **import-time** RSS was not.

**Exact OOM root cause:** Static import of `reconcile-public-localization.ts` loaded the reconciliation application graph **before `main()`** (~400+ modules), including:
1. `language-registry/index` → `language-registry.service` → `global-search.index` (first substantial amplifier)
2. residual bootstrap → full `ensureMongoIndexes` + registry seed barrel
3. reconciliation / residual-retry / residual-only / post-fix modules → `content-translation.service` → Gemini provider + civic loaders
4. `content-translation-source-direct` → Initiative/CA/CD Map store modules + comment service (even when unused at runtime for snapshot)

`FULL_CORPUS_HYDRATED=false` only describes the residual bootstrap contract, not import RSS.

**Fix — separate executables:**
| | A. Residual diagnostics | B. Reconciliation / retry |
|--|--|--|
| Command | `pnpm --filter @hu/api diagnose:localization-residuals -- --mongo --residual ...` | `reconcile:public-localization` (execute / retry flags) |
| Graph | `thin-localization-diagnostic/*` — Mongo connect + narrow projections + residual-state-core | Lazy `reconcile-public-localization-heavy.ts` |
| Forbidden | provider/Gemini, warm consumer/worker, corpus discovery, presentation trees, aggregate hydrate, reconcile execute | N/A (write path) |

**sourceVersion strategy:** Direct collection projections (`initiatives`, `initiative_analyses`, `initiative_comments`, `blog_posts`) + `buildContentTranslationSourceVersion` (blog also `sanitizeBlogHtml` + `publishedVersion`). No `PublicLocalizedPresentation` trees.

**Old flags:** `--snapshot-explicit-residual-state` and `--explain-residuals*` are `OPERATOR_DEPRECATED_MEMORY_UNSAFE`. Snapshot delegates to the thin diagnostic **without** statically importing the heavy graph. Explain refuses (exit 2). Do not run either on Render until this pack is deployed.

**Memory contract (actual guards/instrumentation):**
`OPERATOR_MODE=THIN_READ_ONLY`, `FULL_APPLICATION_GRAPH_IMPORTED=false`, `FULL_CORPUS_HYDRATED=false`, `PROVIDER_MODULE_IMPORTED=false`, `WORKER_MODULE_IMPORTED=false`, `PRESENTATION_TREE_BUILT=false`, plus RSS phase counters (`PROCESS_START_RSS_MB` … `PEAK_RSS_MB`).

Retry policy unchanged (`EXACT_FAILURE_REASON_PROPAGATION_08K25`, `INVALID_PROVIDER_PAYLOAD`, historical failure rules, one-shot semantics).

---

## Pack 08K.2.2 — Gated residual retry operator

```
pnpm --filter @hu/api reconcile:public-localization -- --mongo --retry-ready-residuals
ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true \
  pnpm --filter @hu/api reconcile:public-localization -- --mongo --execute --retry-ready-residuals \
    --wait-for-materialization --timeout-ms=600000
```

- Selection uses exclusively `selectReadyPresentationsForResidualRetry` / `retryPreflight.ready` — never full-corpus `uniquePresentationsRequiringWork`.
- Execute requires `--mongo` + `--execute` + `--retry-ready-residuals` + `ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true` + database `humanity_union_staging`; production refused.
- Warm command may carry optional `targetLocales` so residual fan-out processes only ready identities; CURRENT/blocked locales are not provider-called.
- Historical FAILED outbox rows are not globally cleared; new `operator_residual_retry` work is enqueued for approved `architectureRetryBasis` only.
- Wait observes `RETRY_SELECTED_IDENTITIES` only. Final `POST_*` counters come from a fresh corpus audit (never the pre-execution snapshot). Zero-fallback success requires `POST_CANONICAL_FALLBACK_NODES === 0` from that fresh audit.

