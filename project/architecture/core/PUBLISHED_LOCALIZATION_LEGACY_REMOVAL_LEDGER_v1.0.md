# Published Localization — Legacy Removal Ledger v1.0

**Document ID:** TRANSLATION_DELIVERY_RESET_01 / LEDGER  
**Status:** Normative tracking ledger (no removals executed in Reset 01)  
**Parent:** `PUBLISHED_LOCALIZATION_DELIVERY_ARCHITECTURE_v1.0.md`  
**Rule:** After implementation begins, the count of **ACTIVE** legacy runtime translation paths must **monotonically decrease**.

Status values: `ACTIVE` | `FLAGGED_LEGACY` | `REMOVED` | `KEEP`

---

## Ledger

| ID | File / module | Current responsibility | Replacement | Removal phase | Status |
|----|---------------|------------------------|-------------|---------------|--------|
| L01 | `apps/web/.../resolve-localized-presentation.ts` | GET resolve + optional POST generate; Web assembles localized fields | `resolvePublishedPresentation` read | G (after F) | ACTIVE |
| L02 | `apps/web/.../public-translation-presentation-lifecycle.ts` (`shouldAttemptOnDemandContentTranslation`) | Gates generation-on-miss/PARTIAL from Web | Build pipeline only | G | ACTIVE |
| L03 | `apps/web/.../translation-api.ts` `generateContentTranslation` (public semantic use) | Client POST generate for public prose | Localization Build | G | ACTIVE |
| L04 | `apps/web/.../components/PublicTranslatedFields.tsx` | Field-bag resolve/generate + merge fallback | Published snapshot fields | D→G | ACTIVE |
| L05 | `apps/web/.../components/CivicPublicTranslatedSection.tsx` | Warm-only civic section resolve | Published snapshot | D→G | ACTIVE |
| L06 | `apps/web/.../resolve-public-content-translation-display.ts` | Older resolve+generate display helper | Published snapshot | G | ACTIVE |
| L07 | `apps/web/.../civic-media-center/components/CivicMediaTranslatedEditorial.tsx` | Editorial overlay + client generate-on-miss | Media published snapshot(s) | B→G | ACTIVE |
| L08 | `apps/web/.../use-trusted-media-explanations-overlay.ts` | Shared overlay; seed → client resolve/generate | Same published trusted entity for `/media` + country | B→G | ACTIVE |
| L09 | `apps/web/.../load-civic-media-editorial-seed.ts` | SSR GET resolve seed for Media | SSR published Media presentation | B | ACTIVE |
| L10 | `apps/web/.../app/media/page.tsx` editorial seed wiring | SSR seed into overlay path | SSR `resolvePublishedPresentation` | B | ACTIVE |
| L11 | `apps/web/.../app/countries/[countryCode]/page.tsx` trusted SSR seed | Duplicate civic_media resolve for country rail | Same published trusted snapshots as `/media` | B | ACTIVE |
| L12 | `apps/web/.../public-news/use-localized-public-news-card.ts` | Per-card client localize + generate | Published `public_news` snapshot | B/F | ACTIVE |
| L13 | `apps/web/.../public-news/resolve-public-news-presentation.ts` | News presentation resolve+generate | Published snapshot | B/F | ACTIVE |
| L14 | `apps/web/.../blog/resolve-blog-post-presentation.ts` | Blog resolve+generate | Published `blog_post` | E | ACTIVE |
| L15 | `apps/web/.../blog/load-blog-article-presentation-seed.ts` | Blog SSR GET seed | Published blog snapshot | E | ACTIVE |
| L16 | `apps/web/.../public-initiative-experience/resolve-initiative-detail-presentation.ts` | Initiative resolve+generate | Published initiative snapshot | D | ACTIVE |
| L17 | `apps/web/.../load-initiative-detail-presentation-seed.ts` | Initiative SSR seed | Published initiative snapshot | D | ACTIVE |
| L18 | `apps/web/.../use-initiative-public-presentation.ts` | Keep seed → client upgrade / locale switch | Immutable published read (+ locale switch = new read) | D | ACTIVE |
| L19 | `apps/web/.../resolve-discussion-comment-presentation.ts` | Comment resolve+generate | Published comment snapshot | D | ACTIVE |
| L20 | `apps/web/.../resolve-initiative-card-presentation.ts` | Card resolve+generate | Published initiative (card projection) | D/F | ACTIVE |
| L21 | `apps/web/.../use-civic-initiative-localized-title.ts` | Shared title boundary via CT resolve | Published snapshot title node | D/F | ACTIVE |
| L22 | Lifecycle `*PublicResult.tsx` + `LifecycleTranslatedRecordCard.tsx` | Per-artifact PublicTranslatedFields / civic section | Published lifecycle entity snapshots | D | ACTIVE |
| L23 | `apps/web/.../CivicArchiveTranslatedNarrative.tsx` / `CivicArchiveCardTranslatedText.tsx` | Archive narrative CT | Published archive snapshot | F | ACTIVE |
| L24 | `apps/web/.../adapters/*-presentation.ts` used at **render time** to apply translations | Web-side localizePublicPresentation | Build-time tree; Web renders published tree | G | ACTIVE |
| L25 | `apps/web/.../public-localized-presentation.ts` as **read-path** assembler | Client fingerprint + apply maps | Optional shared lib for **build** only; Web stops applying | G | ACTIVE |
| L26 | `apps/web/.../lib/seo/load-initiative-metadata-translation-fields.ts` | GET resolve metadata fields | Snapshot `seo` subtree | D/H | ACTIVE |
| L27 | `apps/web/.../lib/seo/resolve-localized-public-metadata-copy.ts` mixed merge | Canonical ⊕ translated metadata fields | Snapshot SEO or coherent canonical SEO | H | ACTIVE |
| L28 | API `POST /translations/generate` for **public participant** on-demand | On-demand MT from Web | Build-only generate | G | ACTIVE |
| L29 | API `resolvePublicTranslatedContent` as **primary** public read | Field-bag resolve for Web | `resolvePublishedPresentation` | G | ACTIVE |
| L30 | Treating PARTIAL `content_translations` rows as displayable preferred translation | Mixed/incomplete cards | PARTIAL only in BUILDING/diagnostics | B→G | ACTIVE |

---

## KEEP (not on removal path)

| ID | Module | Reason |
|----|--------|--------|
| K01 | Brand Localization modules | Priority layer / control plane |
| K02 | Legal Localization modules | Priority layer / control plane |
| K03 | Terminology Glossary | Priority + provider context for **build** |
| K04 | Geography display-name resolver | Priority / render-safe geo labels |
| K05 | Language Registry | Locale policy |
| K06 | next-intl UI chrome | Interface chrome |
| K07 | `TranslationProvider` seam | Build path only |
| K08 | Worker concurrency default=1 | Build safety |
| K09 | Outbox infrastructure | Build scheduling |
| K10 | Ownership wrappers (`protectedIdentity`, …) | Canonical presentation authorship |
| K11 | Thin diagnostics (no corpus hydrate) | Operator observation |
| K12 | `hreflang-policy.ts` `HREFLANG_STATUS=DEFERRED` | Until Phase H URLs |
| K13 | Author `TranslateDraftControl` / draft assist | Authoring assist — not public delivery |

---

## Monotonic decrease rule

1. Implementation packs may only move rows `ACTIVE` → `FLAGGED_LEGACY` → `REMOVED` (or `KEEP` if reclassified).  
2. New public surfaces must **not** add rows to the ACTIVE legacy list.  
3. Phase G closes when ACTIVE count for L01–L30 is **0** (KEEP rows excluded).

**Baseline ACTIVE count (Reset 01):** 30

---

## Reset 02 note (2026-09-05)

Published Localized Presentation **core** is now **AVAILABLE**
(`apps/api/src/modules/language/published-localized-presentation/`,
`PUBLISHED_LOCALIZATION_SCHEMA_VERSION=PLP.1`).

- Consumer allowlist remains **empty** (dormant — no public route migrated).
- **No** legacy path removed.
- **ACTIVE legacy count remains 30** (truthful; do not decrement until a route migrates and a ledger row is REMOVED).

---

## Reset 03 note (2026-09-05) — Media vertical slice (flag default OFF)

Media PLP path is **AVAILABLE** but **not the runtime default**.

| Count | Value |
|-------|-------|
| `LEGACY_ACTIVE_RUNTIME_DEFAULT` | **30** (unchanged — flag OFF) |
| `LEGACY_REPLACED_PENDING_ACCEPTANCE` | Media semantic paths L07–L13 classified below |
| ACTIVE (truthful removal count) | **30** — do not decrement until staging PLP acceptance |

### Media legacy path reclassification (not deleted)

| ID | Classification |
|----|----------------|
| L07 CivicMediaTranslatedEditorial | `ACTIVE_LEGACY_FALLBACK` (flag OFF) / `CONSUMER_READY_PENDING_LIVE_ACCEPTANCE` (flag ON path ready; live cold-cache pending) |
| L08 useTrustedMediaExplanationsOverlay | same (`disabled` when PLP SSR map present) |
| L09 loadCivicMediaEditorialSeed | same (skipped when PLP on) |
| L10 media/page editorial wiring | same (PLP branch behind flag; SSR resolves via `/api/v1/public/media-plp/resolve`) |
| L11 country trusted SSR seed | same (shared `civic_media_trusted` identity) |
| L12 use-localized-public-news-card | `ACTIVE_LEGACY_FALLBACK` (news PLP consume later within Media flag) |
| L13 resolve-public-news-presentation | `ACTIVE_LEGACY_FALLBACK` |

Rollback: unset `HU_MEDIA_PLP_ENABLED` → legacy Media path. PLP lookup failure → coherent CANONICAL_FALLBACK (does not re-enter generate-on-miss overlays).

**Do not decrement ACTIVE count** until live cold-cache acceptance with flag ON.

---

## Reset 03C note (2026-09-05) — Media PLP consumer staging gate

| Item | Status |
|------|--------|
| Consumer path | Flagged `/media` + country Recommended Media → `POST /api/v1/public/media-plp/resolve` → PUBLISHED_LOCALIZED or coherent CANONICAL_FALLBACK |
| Fingerprint | API sha256 fingerprint (matches materializer); web does not use FNV for liveCanonicalVersion |
| Flag | `HU_MEDIA_PLP_ENABLED` default **OFF**; this pack does **not** enable it |
| Staging PLP | Existing `civic_media_trusted/reuters/uk` must be readable — no modify/rematerialize in this pack |
| Diagnostic | `diagnose:media-plp-consumer` (READ-ONLY; do not run in Cursor task) |
| ACTIVE legacy | **30** unchanged until live acceptance |

### Reset 03C.1 note — first live structural acceptance FAILED (rolled back)

| Item | Status |
|------|--------|
| Incident | Staging `/media` with Web flag ON: large content missing, layout/blank region, incomplete page |
| Root cause | Dual renderer `CivicMediaCenterPlpContent` only mounted principles + trusted (omitted overview, initiative-flow, news, fact-checking, propaganda, FAQ); wrong wrapper `civic-media-page__inner`; missing CSS; `humanity-layout__main { flex: 1 }` left large empty vertical gap |
| Fix | Shared `CivicMediaCenterPageContent` for both modes; PLP supplies semantic values only |
| Ledger class | remains `CONSUMER_READY_PENDING_LIVE_ACCEPTANCE` |
| ACTIVE count | **30** — do not decrement |
| Flag | Web rolled back OFF; do not re-enable in this pack |

### Reset 03C.2 note — second live acceptance FAILED (locale-switch deadlock; rolled back)

| Item | Status |
|------|--------|
| Incident | Staging `/media` with API+Web flags ON: page loaded; Language Selector locale change updated selection; loading/pending stayed active; Media never settled to PLP or canonical fallback |
| Root cause | Unstable PLP editorial identity (`applyMediaPlpPresentationsToEditorial` every render) + `skipClientTranslation` effect `setEditorial(initialEditorial)` on identity change → client update loop; Language Selector `startTransition(router.refresh())` never settled. Secondary: sequential unbounded PLP SSR resolves could stall refresh |
| Fix | Memoized PLP editorial; synchronous PLP derive (no setEditorial loop); parallel bounded `Promise.all` PLP batches + resolve timeout; fail-closed to CANONICAL_FALLBACK |
| Ledger class | remains `CONSUMER_READY_PENDING_LIVE_ACCEPTANCE` |
| ACTIVE count | **30** — do not decrement |
| Flag | Web rolled back OFF again; do not re-enable in this pack |

### Reset 03C — live functional acceptance PASSED; performance pending (03D)

| Item | Status |
|------|--------|
| Live functional | `LIVE_FUNCTIONAL_ACCEPTANCE_PASSED` — structure + locale-switch settle verified on staging |
| Performance | `PERFORMANCE_ACCEPTANCE_PENDING` — ~4s en→uk observed; addressed in Reset 03D |
| Ledger class | remains `CONSUMER_READY_PENDING_LIVE_ACCEPTANCE` until performance acceptance |
| ACTIVE count | **30** — do not decrement |

### Reset 03D note — Media PLP locale-switch performance (no live ops)

| Item | Status |
|------|--------|
| Dominant waits | Dual PLP HTTP posts; duplicate SSR languages fetches; sequential auth prefs→cookie |
| Fix | One combined Media PLP resolve; React.cache locale catalog; parallel prefs∥cookie; bounded API resolve cache |
| HTTP boundary | Retained Web→API (no Mongo/API bootstrap in Web) |
| Live observed | en→uk improved ~4s → ~2.5s on staging (informational) |
| Final perf acceptance | **informational** — topology preserved; not a hard gate for ledger removal |
| ACTIVE count | **30** |
| Flag | Do not change flags in this pack |

### Reset 03E note — Media PLP semantic coverage (no live ops)

| Item | Status |
|------|--------|
| 03C functional acceptance | **PASSED** (live staging) |
| 03D performance | Improved (~2.5s); final perf remains **informational** |
| Inventory | Complete Media semantic ownership inventory + detector (`UNOWNED_FIELDS=0`) |
| PLP schema | `civic_media_editorial` entity (overview + FAQ); `PUBLISHED_LOCALIZATION_SCHEMA_VERSION=PLP.2` |
| Stale snapshots | Existing `reuters/uk` and other `PLP.1` snapshots are **schema-stale** until rematerialized → fail closed to CANONICAL_FALLBACK |
| UI ownership | Rail chrome / metadata / logo alt / stage-of → UI dictionary |
| Initiative flow | Participant UX remains `civicMediaPublic.pipeline.*` (UI_DICTIONARY) |
| Fact/propaganda | UI_DICTIONARY (`civicMediaPublic.factChecking` / `propaganda`) |
| News on PLP path | No generate-on-read; coherent canonical item when unpublished |
| Coverage acceptance | **pending until live** |
| Media legacy entries | remain pending until live coverage acceptance |
| ACTIVE count | **30** — do not reduce yet |

### Reset 03E.1 note — rendered semantic coverage authority (no live ops)

| Item | Status |
|------|--------|
| 03E false positive | Static 45-field inventory `UNOWNED_FIELDS=0` did **not** inspect render RESULT; PLP.1→PLP.2 stale + CANONICAL_FALLBACK still showed English |
| Authority | `MediaSemanticNode` owner+result on real render path; coverage from rendered HTML contracts |
| Page status | `FULLY_LOCALIZED` / `PARTIALLY_LOCALIZED` / `CANONICAL_ONLY` / `INVALID_COVERAGE` |
| PLP.1 under PLP.2 | Remains fail-closed CANONICAL_FALLBACK; counted as fallback, not localized |
| Coverage acceptance | **pending until live** |
| ACTIVE count | **30** — do not reduce yet |

### Reset 03E.2 note — localization content integrity (no live ops)

| Item | Status |
|------|--------|
| Live gap | `civic_media_editorial` / uk could be `PUBLISHED` + `PUBLISHED_LOCALIZED` while overview/FAQ prose remained English |
| Root class | **D** (provider/validation allowed MACHINE-identical English + resolve trusted publish state) |
| Gate | `CLI.1` content integrity on build + resolve; reason `LOCALIZATION_CONTENT_INTEGRITY_FAILED` / `_MISSING` |
| Bad snapshots | Not deleted; read path fail-closed to `CANONICAL_FALLBACK` |
| Coverage | Integrity-invalid entity → `RESULT=CANONICAL_FALLBACK` → cannot be `FULLY_LOCALIZED` |
| Coverage acceptance | **pending until live** |
| ACTIVE count | **30** — do not reduce yet |

### Reset 03E.3 note — structural completeness (no live ops)

| Item | Status |
|------|--------|
| Systemic gaps | News omitted from Media PLP batch; principle `whyItMatters` + fact/propaganda bodies parked in UI_DICTIONARY; PLP markers lacked `semanticPath` |
| Gate | `LSI.1` structural integrity (+ `CLI.1`); render-authority parity in test/dev |
| Reclassifications | Fact/propaganda → PLP entities; whyItMatters → principle PLP field; chrome labels remain UI_DICTIONARY |
| PLP schema | Remains **PLP.2** (LSI.1 independent) |
| Coverage acceptance | **pending until live** |
| ACTIVE count | **30** — do not reduce yet |
### Reset 03E.4 note — PLP rebuild eligibility parity (no live ops)

| Item | Status |
|------|--------|
| Live gap | Matching `PUBLISHED` PLP.2 without CLI.1/LSI.1 → `CANONICAL_FALLBACK` on read while materializer reported `UNCHANGED_PLP` |
| Contract | Shared `classifyUsableLocalizedPresentation` — read and rebuild are complements |
| Usable only when | identity + version + schema + `PUBLISHED` + CLI.1 PASSED (+ recompute) + LSI.1 PASSED (+ recompute) |
| Otherwise | READ → `CANONICAL_FALLBACK`; BUILD → `REBUILD_REQUIRED` (never `UNCHANGED_PLP`) |
| Coverage acceptance | **pending until live** |
| ACTIVE count | **30** — do not reduce yet |

### Reset 03E.5 note — consumer value lineage (no live ops)

| Item | Status |
|------|--------|
| Live gap | Valid editorial PLP (`PUBLISHED_LOCALIZED` + CLI.1 + LSI.1) while route cards/sections still showed English |
| Root class | Consumer value lineage break after resolver (news batch unused; country WORLD×COUNTRY id miss; markers claimed LOCALIZED without projected values) |
| Gate | Route-level sentinel lineage; `LOCALIZED_PRESENTATION_CONSUMER_BYPASS` |
| Election/initiative | Explicit `DOMAIN_NOT_YET_MIGRATED` (not Media PLP) |
| Coverage acceptance | **pending until live** |
| ACTIVE count | **30** — do not reduce yet |

### Reset 03E.6 note — live runtime truth (no live ops)

| Item | Status |
|------|--------|
| Live gap | After 03E.5 deploy, staging `/media` still English despite API `PUBLISHED_LOCALIZED` |
| FIRST LOSS | `ROUTE_BRANCH_GAP` — Web `HU_MEDIA_PLP_ENABLED` unset/false → LEGACY CT while API PLP valid |
| False positive | API consumer acceptance ≠ Web runtime branch; Playwright structural fixture ≠ real route |
| Repair | `composeMediaPageLocalization` + runtime branch attrs + staging-shaped sentinel regression; projection unwrap harden; composite batch keys |
| Coverage acceptance | **pending until live** (requires Web `HU_MEDIA_PLP_ENABLED=true` without `FORCE_LEGACY`) |
| ACTIVE count | **30** — do not reduce yet |

### Reset 03E.7 note — live Web PLP payload truth (no live ops)

| Item | Status |
|------|--------|
| Live gap | Staging Web `runtime-branch=PLP` + API GET `PUBLISHED_LOCALIZED`, yet `/media` editorial/FAQ still English |
| 03E.6 hypothesis | **FALSE** on current staging — loss is inside the PLP path, not LEGACY |
| FIRST LOSS | POST consumer version gate fingerprinted **client** tree → `CANONICAL_VERSION_MISMATCH` → `CANONICAL_FALLBACK` while GET used live source (`API_RESPONSE_CONTRACT_GAP`) |
| False positive | 03E.5/03E.6 fixtures injected matching `PUBLISHED_LOCALIZED` presentations / skipped skewed POST fingerprint (`TEST_ARCHITECTURE_FALSE_POSITIVE`) |
| Repair | `resolveMediaPlpConsumerItem` prefers live-source fingerprint+tree; Web live-truth probe fingerprints only |
| Probe | `HU_MEDIA_PLP_LIVE_TRUTH_PROBE=true` → `data-hu-media-plp-live-truth` (URI JSON; no bodies) |
| Coverage acceptance | **pending until live probe after deploy** |
| ACTIVE count | **30** — do not reduce yet |

### Reset 03E.8 note — HTTP PLP persistence truth (no live ops)

| Item | Status |
|------|--------|
| Live gap | Probe ENABLED + PLP branch + uk, but `API_RESULT_REASON=NO_PUBLISHED_SNAPSHOT` while CLI Mongo diagnostic was `PUBLISHED_LOCALIZED` |
| FIRST LOSS | API HTTP process left PLP facade on default MEMORY while materializer/diagnose used MONGO |
| Repair | `bootstrapPublishedLocalizationPersistence` in API `start()`; fail-closed `PLP_PERSISTENCE_UNAVAILABLE` when Mongo URI present but facade unbound/memory |
| Probe | `PLP_PERSISTENCE_MODE` / `PLP_LOOKUP_RESULT` on live-truth metadata |
| ACTIVE count | **30** — do not reduce yet |

### Reset 03E.9 note — Media/Country carousel PLP coverage (no live ops)

| Item | Status |
|------|--------|
| Live gap | Editorial `PUBLISHED_LOCALIZED` while carousel cards (news/principle/trusted/verification/analysis/country media) remained English |
| Root classes | Primarily `NO_PUBLISHED_SNAPSHOT` for carousel entities; `public_news` live-source was empty → version-gate miss even when Mongo PLP exists; election/initiative = `DOMAIN_NOT_YET_MIGRATED` |
| Repair | `loadMediaPlpLiveCanonicalSource` public_news Mongo parity; `diagnose:media-plp-carousel` bounded readiness operator + materialize plan (≤20, dry-run) |
| Diagnostic | `pnpm --filter @hu/api diagnose:media-plp-carousel -- --mongo --locale uk` (optional `--country-code`) |
| Materialize | Existing one-by-one `materialize:media-plp` only; plan printed by carousel diagnostic — **not executed in this pack** |
| Coverage acceptance | **pending until staging materialize + live verify** |
| ACTIVE count | **30** — do not reduce yet |

---

## Reset 03B.2 note (2026-09-05) — thin provider execution boundary

| Item | Status |
|------|--------|
| Heavy path | `materialize:media-plp` → `gemini-translation-provider` → `language-registry/index` → routes/services/search/auth (~350 modules) — **FORBIDDEN** for operator execute |
| Thin path | `media-plp-materializer/thin-gemini-transport` + `translation.config` + terminology seed — native Generative Language HTTP |
| Boundary report | `PROVIDER_EXECUTION_BOUNDARY=THIN`, `PROVIDER_TRANSPORT=gemini_generativelanguage_http` (or `fake_local` / `deterministic_local`) |
| Placement | Localization build provider execution outside public runtime; thin operator is temporary tooling — **no new Render worker** unless approved |
| Durability (03B.1) | Unchanged: `--mongo` requires Mongo PLP persistence; durable read-back before `PUBLISHED` |
| Flag | `HU_MEDIA_PLP_ENABLED` remains default OFF; ACTIVE legacy count **30** |
