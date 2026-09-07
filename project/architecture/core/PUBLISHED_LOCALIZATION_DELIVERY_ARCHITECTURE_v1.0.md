# Published Localization Delivery Architecture v1.0

**Document ID:** TRANSLATION_DELIVERY_RESET_01  
**Status:** Normative baseline — architecture / audit only  
**Date:** 2026-09-05  
**Supersedes (direction):** runtime assembly of localized semantic content in Web (Pack 08K–08K.3.3 path)  
**Does not change:** participant-facing runtime behavior until a later implementation pack  
**Companion ADR:** `ADR-026-PUBLISHED-LOCALIZATION-DELIVERY.md`  
**Companion ledger:** `PUBLISHED_LOCALIZATION_LEGACY_REMOVAL_LEDGER_v1.0.md`

---

## Normative principle

```
Canonical Public Content
  → asynchronous Localization Build
  → atomic Published Localized Presentation
  → API / SSR
  → React
```

**LOCALIZATION IS A PUBLICATION CONCERN, NOT A RENDERING CONCERN.**

Web and public API **read** a completed publication artifact.  
They do **not** assemble, merge, generate, or repair semantic localization during render.

---

## 1. Current architecture inventory (post Packs 08K–08K.3.3)

Classification key:

| Class | Meaning |
|-------|---------|
| **KEEP** | Remains as-is in the target architecture |
| **REUSE** | Concepts / code retained inside the new build or read path |
| **MIGRATE** | Moves into Localization Build or PublishedLocalizedPresentation |
| **DEPRECATE** | Stop using for new work; remove after migration |
| **REMOVE_AFTER_MIGRATION** | Must disappear once the consuming surface is on published snapshots |

| Component | Role today | Classification |
|-----------|------------|----------------|
| `content_translations` (field bags by `sourceKind`/`sourceRecordId`/`sourceVersion`/`targetLanguage`) | Cache of machine (and some manual) field translations | **MIGRATE** → build input / superseded store; not the public read artifact |
| `TranslationProvider` / Deterministic / Gemini | Provider seam for MT | **KEEP** (build path only) |
| Worker slot pool (`CONTENT_TRANSLATION_WORKER_CONCURRENCY` default **1**) | Bounded provider concurrency | **KEEP** |
| Outbox + `content-translation-warm-v1` consumer | Async warm enqueue/consume | **REUSE** → LocalizationBuildRequested pipeline |
| Warm locale concurrency / Registry targets | Fan-out to enabled locales | **REUSE** (remain bounded) |
| `PublicLocalizedPresentation` tree + ownership wrappers | Semantic tree + coverage | **REUSE** as **build output shape** inside published snapshot |
| `localizePublicPresentation` / fingerprints | Apply path maps; COMPLETE/PARTIAL | **REUSE** in **build**; **DEPRECATE** as Web read-time assembler |
| PARTIAL / COMPLETE / STALE / MISSING classifiers | Materialization diagnostics | **REUSE** for **BUILDING** diagnostics; **PARTIAL must not publish** |
| Generation-on-miss / generate-on-PARTIAL (Web POST) | Client/SSR-adjacent repair | **REMOVE_AFTER_MIGRATION** |
| Route/component resolve hooks (`resolveLocalizedPresentation`, `PublicTranslatedFields`, news/media overlays, initiative/blog resolvers) | Per-surface localization assembly | **REMOVE_AFTER_MIGRATION** |
| SSR seeds (`load*Seed`, country trusted seed) | GET resolve warm rows into page props | **MIGRATE** → SSR reads published snapshot (or coherent canonical) |
| Client overlays / hydration upgrades | Seed → client resolve/generate → merge | **REMOVE_AFTER_MIGRATION** |
| Brand Localization (admin + public) | Manual brand strings | **KEEP** (priority layer) |
| Legal Localization (admin + public) | Manual legal bodies | **KEEP** (priority layer) |
| Terminology Glossary | Controlled terms + provider context | **KEEP** (priority layer + build context) |
| Geography display-name resolver | Intl display names (no Gemini) | **KEEP** (priority layer / render-safe resolver) |
| Language Registry | Locale enablement / CT / search / SEO flags | **KEEP** |
| next-intl UI chrome | Interface chrome dictionaries | **KEEP** (not CT) |
| Multilingual search enrichment | Search docs ⊕ CURRENT translations | **MIGRATE** carefully (read published or indexed projection; no corpus hydrate) |
| SEO metadata resolve (cache-only title/description) | Metadata localization | **MIGRATE** → snapshot SEO subtree |
| Thin residual / media diagnostics | Operator observation | **REUSE** (must stay thin; no full-corpus hydrate) |
| Public localization reconciliation / residual retry operators | Repair enqueue | **REUSE** as **build retry** operators (bounded) |
| Pack 08K developer contract (ownership wrappers) | How authors mark protected vs AUTO | **KEEP** for **canonical presentation construction** |

---

## 2. Current runtime-path map (as-is — do not fix in Reset 01)

```
API domain / civic loaders
  → build field bag + sourceVersion
  → content_translations upsert (warm worker OR on-demand POST)
  → GET /translations/resolve/{kind}/{id}/{lang}

SSR (Next page)
  → resolveDocumentHtmlLocale
  → load*Seed (GET resolve only)
  → pass initialEditorial / initialPresentation / trustedExplanationsById

Hydration
  → keep seed until readingContext.ready
  → hooks: resolveTranslatedContent / resolveLocalizedPresentation
  → shouldAttemptOnDemandContentTranslation
       → POST /translations/generate on miss/PARTIAL
  → mergeLocalizedOverCanonical / overlay*FromFields
  → adapters → PublicLocalizedPresentation
  → React

Parallel (non-CT): Brand API, Legal API, Glossary, Geography resolver, next-intl, SEO cache merge
```

### Web behaviors that violate the target principle (inventory only)

| Behavior | Examples |
|----------|----------|
| Assembles localized semantic content at render boundary | Adapters + `localizePublicPresentation` in Web; `CivicMediaTranslatedEditorial`; news/blog/initiative resolvers |
| Merges raw + localized | Overlay merges; `PublicTranslatedFields`; initiative presentation merge; SEO metadata merge |
| Generates translation on miss | `resolveLocalizedPresentation`, media/news/blog/initiative generate paths, trusted overlay |
| Changes presentation after hydration | Initiative presentation hook; trusted overlay; news cards; `PublicTranslatedFields` |
| Independently resolves same entity/locale | `civic_media` on `/media` + country page + rails; per-card `public_news`; initiative detail + cards + SEO |

---

## 3. Target architecture

```
┌──────────────────────────┐
│ Canonical Public Content │  (domain projections; English source of truth)
└────────────┬─────────────┘
             │ version bump / publication event
             ▼
┌──────────────────────────┐
│ LocalizationBuildRequested│  (outbox; bounded)
└────────────┬─────────────┘
             │ worker concurrency default = 1
             ▼
┌──────────────────────────┐
│ Localization Build       │  semantic tree + priority layers + validate
│  state: BUILDING|FAILED  │  PARTIAL allowed only here / in diagnostics
└────────────┬─────────────┘
             │ atomic publish
             ▼
┌──────────────────────────┐
│ PublishedLocalizedPresentation │  state: PUBLISHED (atomic) → SUPERSEDED
└────────────┬─────────────┘
             │ indexed read (entityType, entityId, locale [, canonicalVersion])
             ▼
┌──────────────────────────┐
│ Public API / SSR         │  resolvePublishedPresentation → PUBLISHED_LOCALIZED | CANONICAL_FALLBACK
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ React                    │  render presentation only; no CT assemble/generate
└──────────────────────────┘
```

**One translation delivery engine.** Brand / Legal / Terminology / Geography remain **priority layers and control planes**, not competing engines.

---

## 4. PublishedLocalizedPresentation contract

### Identity (minimum)

```ts
type PublishedLocalizedPresentationIdentity = {
  entityType: string;   // e.g. "civic_media", "public_news", "initiative"
  entityId: string;     // stable public id
  locale: string;       // BCP 47 / Registry language code
  canonicalVersion: string; // fingerprint of canonical semantic presentation
  localizationSchemaVersion: string; // e.g. "PLP.1"
};
```

### Lifecycle state (minimum)

| State | Meaning |
|-------|---------|
| `BUILDING` | Build in progress; may be PARTIAL internally; **not** readable as localized public |
| `PUBLISHED` | Atomic complete snapshot for entity/version/locale |
| `FAILED` | Build failed; observable; does not replace prior PUBLISHED |
| `SUPERSEDED` | Replaced by a newer PUBLISHED for same entity/locale (or version) |

### Atomicity

A **PUBLISHED** snapshot MUST contain the **complete** participant-facing semantic presentation tree for that entity/version/locale (plus SEO subtree fields defined below).

- **PARTIAL** may exist during `BUILDING` and in operator diagnostics.
- **PARTIAL MUST NOT** be published as a participant-facing localized snapshot.
- Publish is **atomic**: readers never observe a half-applied tree.

### Payload (conceptual)

```ts
type PublishedLocalizedPresentation = {
  identity: PublishedLocalizedPresentationIdentity;
  state: "PUBLISHED" | "SUPERSEDED"; // persisted readable rows; BUILDING/FAILED are build records
  publishedAt: string;
  presentation: PublicPresentationNode; // fully resolved semantic tree
  seo?: {
    title?: string;
    description?: string;
    openGraph?: Record<string, string>;
    twitter?: Record<string, string>;
    jsonLdFields?: Record<string, unknown>;
  };
  provenance: LocalizedNodeProvenance[]; // or embedded per-node
  // protected identity/technical values remain byte-identical to canonical
};
```

`PublicPresentationNode` / ownership wrappers from Pack 08K **REUSE** as the tree vocabulary.

---

## 5. Priority / provenance contract

Deterministic precedence (highest wins; machine rebuild MUST NOT overwrite higher layers):

1. **Protected canonical identity / technical values**  
2. **Legal Localization** (admin-approved)  
3. **Brand Localization** (admin-approved)  
4. **Manual / author-approved content localization**  
5. **Controlled terminology / geography resolution**  
6. **Machine localization** (`TranslationProvider`)  
7. **Canonical English fallback** (only as whole-presentation fallback at read time — see §6)

### Provenance (per localized node/value)

Each applied value records at least:

| Field | Purpose |
|-------|---------|
| `path` | Presentation path |
| `priorityStep` | Which layer won |
| `source` | `protected` \| `legal` \| `brand` \| `manual` \| `terminology` \| `geography` \| `machine` \| `canonical` |
| `provider` | Optional (e.g. `gemini`, `deterministic`) — build only |
| `sourceVersion` / `canonicalVersion` | Traceability |
| `appliedAt` | Build timestamp |

Machine rebuild applies only where no higher-priority value exists for that path.

**Note:** Existing `LOCALIZATION_RESOLUTION_PRIORITY` in types is **aligned and extended**: protected identity/technical is explicit step 1; Legal before Brand matches admin control intent (Reset 01 normative order above). Implementation packs must reconcile the typed constant with this ADR without changing runtime in Reset 01.

---

## 6. Read contract

```ts
resolvePublishedPresentation(entityType, entityId, locale)
  → { mode: "PUBLISHED_LOCALIZED", presentation: PublishedLocalizedPresentation }
  | { mode: "CANONICAL_FALLBACK", presentation: CanonicalPublicPresentation }
```

Rules:

- **No field-by-field mixed fallback.** Either a complete PUBLISHED snapshot **or** a coherent canonical presentation for the entity.
- If no complete localized snapshot exists for the requested locale: return **CANONICAL_FALLBACK**.
- **Do not wait for Gemini.**
- **Do not build translation during React render.**
- **Do not** call provider or worker from Web.
- Indexed lookup by `entityType + entityId + locale` (+ optional `canonicalVersion`); no corpus Map bootstrap.

SSR and client consume the **same** resolved presentation.

---

## 7. Build / publish contract

```
canonical content changes
  → canonicalVersion changes
  → LocalizationBuildRequested (outbox)
  → enabled locales scheduled (Language Registry ∩ contentTranslationEnabled)
  → bounded worker (default concurrency = 1)
  → build semantic tree from canonical presentation
  → apply priority layers (Legal, Brand, manual, terminology, geography, machine)
  → validate completeness (all AUTO nodes localized OR marked protected)
  → atomic publish PUBLISHED
  → previous PUBLISHED for same entity/locale → SUPERSEDED
```

Rules:

- Existing **worker concurrency default = 1** remains the safe baseline.
- No unbounded locale fan-out.
- FAILED builds do not delete or corrupt the last PUBLISHED snapshot.
- Retry uses bounded backoff (operator / outbox), not request-path storms.

---

## 8. Render memory / load safety contract

Mandatory (staging has already OOMed under corpus hydrate):

| Rule | Requirement |
|------|-------------|
| Web request | Never hydrates translation corpus |
| API public request | Never hydrates translation corpus |
| Localization read | No full `Map` bootstrap; direct indexed lookup |
| Provider | No Gemini/provider import on read path |
| Localization build provider | Must not run inside normal API/Web request processes; thin isolated boundary for controlled operators (Reset 03B.2); ultimate placement outside participant-facing render |
| Worker | No worker import in Web |
| Concurrency | Bounded worker default = 1 |
| Payload | Bounded translation / snapshot payload size |
| Batch | Bounded batch size for builds / operator tools |
| Mongo | Explicit cursors + projections for operator work |
| Diagnostics / rebuild | **No** full-corpus `.toArray()` |
| Bulk migration | Resumable and bounded |

### Measurable counters (for later implementation)

```
LOCALIZATION_READ_DB_QUERIES
LOCALIZATION_SNAPSHOT_BYTES
LOCALIZATION_BUILD_IN_FLIGHT
LOCALIZATION_BUILD_PAYLOAD_BYTES
PROCESS_RSS_MB
WORKER_CONCURRENCY
```

---

## 9. Overload / failure behavior

If localization worker or provider is slow or unavailable:

- Public site remains available
- **CANONICAL_FALLBACK** (or last **PUBLISHED**) renders
- No request waits for provider
- No retry storm from Web
- No synchronous rebuild on read
- Failed build remains observable (`FAILED`)
- Retry uses bounded backoff
- Existing **PUBLISHED** remains valid until a replacement is atomically ready

**A localization failure MUST NOT take down Web/API.**

---

## 10. International SEO compatibility

Snapshots MUST support future locale-addressable routes consuming the **same** `PublishedLocalizedPresentation` without changing translation architecture:

```
/en/...
/uk/...
/ar/...
/zh-hant/...
```

Snapshot SEO subtree (minimum):

- page title  
- meta description  
- OG / Twitter presentation fields  
- public semantic body (presentation tree)  
- structured fields needed by future JSON-LD  

**Reset 01 does NOT implement locale-prefixed routes.**  
**Reset 01 does NOT add hreflang.**  

`HREFLANG_STATUS` remains **`DEFERRED`** until durable locale URLs exist (`hreflang-policy.ts`).

---

## 11. Media first migration slice (design only — not implemented here)

### Target flow

```
Canonical Media presentation (civic_media + nested trusted/principles/news identities as designed)
  → LocalizationBuildRequested
  → PublishedLocalizedPresentation (entityType/entityId/locale/canonicalVersion)
  → public Media API returns resolved presentation
  → SSR resolvePublishedPresentation
  → React renders presentation only
```

### After Media migration, Media React MUST NOT use

- Per-card translation generation  
- Semantic raw/localized overlays  
- Generation-on-miss waiting  
- Route-specific translation identity for the same resource  
- Field-level mixed fallback  

### Shared trusted media

`/media` and Country Recommended Media MUST consume the **same** published trusted-media localization where they share the same underlying resource (one `entityType`/`entityId`/locale snapshot — not duplicate route caches).

Nested presentation strategy (design choice for Phase B):

- Prefer **one published snapshot per public resource identity** (e.g. trusted outlet explanation identity), composed by Media page from published children; **or**
- One aggregate `civic_media` snapshot that is always complete for the center singleton  

Either way: **atomic complete** for what the page renders; no PARTIAL publish; country rail reuses the same trusted entity snapshots.

---

## 12. Cold-cache acceptance (future implementation MUST pass)

Start with:

- Empty browser cache  
- Fresh browser context  
- No warmed client translation cache  
- Hard navigation directly to `/media`  

Locales: **uk**, **zh-Hant**, **ar**

### Metrics

| Metric | Meaning |
|--------|---------|
| `FIRST_RENDER_LANGUAGE_STATE` | Language state of first paint semantic nodes |
| `FINAL_RENDER_LANGUAGE_STATE` | Language state after settle (no further CT) |
| `MIXED_LANGUAGE_SEMANTIC_NODES` | Count of mixed localized/canonical semantic nodes |
| `CLIENT_TRANSLATION_REQUESTS` | Client resolve/generate calls |
| `PROVIDER_CALLS_FROM_READ_PATH` | Provider invocations triggered by the page read |
| `TIME_TO_COHERENT_PRESENTATION` | Time until coherent PUBLISHED or CANONICAL_FALLBACK |

### Required architecture result

```
MIXED_LANGUAGE_SEMANTIC_NODES = 0
PROVIDER_CALLS_FROM_READ_PATH = 0
```

A **canonical fallback** is allowed as one coherent presentation.  
A **mixed** localized/canonical card is **not**.

---

## 13. Phased migration + rollback boundaries

| Phase | Scope | Rollback boundary |
|-------|-------|-------------------|
| **A** | Infrastructure / schema for build records + published snapshots; counters; indexes | Drop/ignore new collections; no Web read switch |
| **B** | Media vertical slice (build + publish + API/SSR/React read) | Feature-flag Media to legacy resolve/overlay path |
| **C** | Staging cold-cache acceptance for `/media` | Keep flag off in prod; fix builds; no legacy deletion yet |
| **D** | Initiative lifecycle public surfaces | Per-surface flag back to `PublicTranslatedFields` / seeds |
| **E** | Blog / Knowledge | Per-route flag to legacy presentation resolvers |
| **F** | Remaining public surfaces (search cards, CI rails, archive, home, country, etc.) | Per-surface flags |
| **G** | Remove legacy runtime translation paths (ledger) | Only after flags default to published; monitor counters |
| **H** | International SEO routing layer (locale URLs; then hreflang) | Routing flag; snapshots already locale-keyed |

**No big-bang migration.** Legacy path count must **monotonically decrease** after implementation begins (see ledger).

---

## 14. Relation to Pack 08K contracts

| Artifact | Reset 01 stance |
|----------|-----------------|
| Ownership wrappers / AUTO default | **KEEP** for canonical presentation authors |
| `PublicLocalizedPresentation` | **REUSE** as snapshot payload vocabulary |
| Developer contract “localize at boundary” | Becomes **build-time** boundary; Web boundary is **read published** |
| Route boundary matrix | Remains inventory of surfaces to migrate |
| Thin diagnostics | Stay thin; evolve to snapshot/build observation without corpus hydrate |

---

## 15. Explicit non-goals (Reset 01)

- Mongo schema migration  
- Runtime persistence writes  
- Web behavior changes  
- Provider / worker / reconcile / warm / staging / prod / Render commands  
- Translation backfill  
- New translation hooks  
- Component fixes  
- Locale-prefixed routes / hreflang  

---

## Acceptance (Reset 01 docs)

See ADR-026 and the RETURN checklist in the implementing commit message / agent return. This document defines A–O of the architecture acceptance; P–R are process constraints (no runtime/live/`production-admin-source.json` changes).

---

## Reset 02 — core implementation (dormant)

Core is implemented under:

- `packages/types/src/domain/published-localized-presentation.ts`
- `apps/api/src/modules/language/published-localized-presentation/`
- Read barrel: `read.ts` (provider/worker-free)
- Feature boundary: `PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST = []`

No public route consumes snapshots until Reset 03+ enablement. ACTIVE legacy count remains 30.

---

## Reset 03 — Media vertical slice (flag default OFF)

- Identities: `public_news`, `civic_media_principle`, `civic_media_trusted` (`media-plp-identities.ts`)
- Build/publish/read: `published-localized-presentation/media/`
- Web consume: `features/language/media-plp/` behind `HU_MEDIA_PLP_ENABLED` (default false)
- Shared trusted entityId for `/media` + Country Recommended Media
- Publication hook `notifyMediaCanonicalPublishedForLocalizationBuild` = **INACTIVE**
- ACTIVE legacy count remains **30**; see ledger Reset 03 note

### Reset 03B.2 — localization build provider execution placement

**Normative rule**

| Process class | Allowed |
|---------------|---------|
| **PUBLIC RUNTIME** (API/Web request) | Read published PLP or canonical fallback only. No localization-build provider execution. |
| **LOCALIZATION BUILD EXECUTION** | Bounded isolated thin provider boundary only. |

Normal participant-facing render/request processes must **not** host localization-build provider execution (Gemini / translation transport).

For the current controlled staging operator (`materialize:media-plp`), the thin boundary under `media-plp-materializer/` is **temporary operational tooling**. It must not import API application bootstrap, routes, services barrels, workers, corpus hydration, warm/reconcile, search index, or Web code.

Do **not** create a new paid Render worker/service for this path unless separately approved. Ultimate placement remains outside normal request execution.

**Incident class (03B.2):** importing `providers/gemini-translation-provider` pulled `language-registry/index` (routes/services) → ~350 local modules and OOM on Render Starter 512MB. Thin transport uses native `fetch` + `translation.config` + terminology seed only.
### Reset 03C — Media PLP consumer staging gate (flag default OFF)

Participant-facing Media reads when `HU_MEDIA_PLP_ENABLED=true`:

```
fetchCivicMediaCenter / country media list
  → SSR loadMediaPlp*Presentations
  → POST /api/v1/public/media-plp/resolve (batch; API fingerprints)
  → PUBLISHED_LOCALIZED | CANONICAL_FALLBACK (complete entity; never mixed)
  → CivicMediaCenterPlpContent / MediaPlpTrustedCard
```

Rules:

- Matching PUBLISHED PLP (entityType + entityId + locale + canonicalVersion + schema) → localized presentation
- Otherwise → complete canonical English presentation
- No provider, no generate-on-miss, no content_translations field merge on flagged path
- Country Recommended Media shares `civic_media_trusted` identity with `/media`
- Flag OFF → exact legacy CT path (rollback)
- Live cold-cache acceptance required before ACTIVE legacy decrement; diagnostic: `diagnose:media-plp-consumer`

### Reset 03C.1 — shared Media structure (post live rollback)

First live staging acceptance with Web `HU_MEDIA_PLP_ENABLED=true` **failed**: dual `CivicMediaCenterPlpContent` omitted major sections and left a large blank `flex:1` main region. Web flag rolled back OFF.

Correct architecture: one shared `CivicMediaCenterPageContent` structure; PLP only supplies atomic entity semantic presentations (principles + trusted). Missing localization must not remove content.

### Reset 03C.2 — Media PLP locale-switch settle (post second live rollback)

Second live staging acceptance with API+Web flags ON **failed**: Language Selector change left pending/loading stuck; Media never settled to PUBLISHED_LOCALIZED or coherent CANONICAL_FALLBACK. Web flag rolled back OFF.

Correct locale-switch contract:

```
Language Selector
  → persist hu_lang (+ prefs if auth)
  → startTransition(router.refresh)
  → SSR: Promise.all([trusted batch, principles batch]) with resolve timeout
  → PUBLISHED_LOCALIZED | CANONICAL_FALLBACK maps
  → shared CivicMediaCenterPageContent
  → memoized PLP editorial (sync derive; no setEditorial identity loop)
  → transition completes; pending clears
```

Rules:

- Canonical fallback for missing PLP (e.g. ar / zh-Hant) is success, not failure
- Zero client generate / provider / content_translation writes on flagged path
- Loading ownership always terminates (success, fallback, API error, timeout, abort, repeated selection)
- Flag default remains OFF; ACTIVE legacy remains 30 until live acceptance

### Reset 03D — Media PLP locale-switch performance

Measured 03C.2 topology (guest `/media` switch): **2** PLP resolve HTTP posts + **2** SSR languages fetches (layout+page) + sequential auth prefs→cookie. Staging en→uk ~4s functionally correct but too slow for precomputed reads.

03D reductions (HTTP Web→API retained — deployment boundary forbids Mongo/API bootstrap in Web):

```
Language Selector
  → prefs ∥ cookie (same locale; no-op if already active)
  → router.refresh
  → SSR: React.cache languages (1/request) + media payload
  → ONE POST /media-plp/resolve (trusted+principles combined)
  → API: bounded resolve cache keyed by entity|locale|canonicalVersion|schema
  → settle
```

Ledger: `LIVE_FUNCTIONAL_ACCEPTANCE_PASSED` + `PERFORMANCE_ACCEPTANCE_PENDING` until live timing acceptance. ACTIVE 30 unchanged.

### Reset 03E — Media PLP semantic coverage

Every `/media` participant-facing field is classified:

| Owner | Examples |
|-------|----------|
| UI_DICTIONARY | Section chrome, pipeline stages, fact/propaganda bodies, rail a11y |
| PLP_ENTITY | Principles, trusted explanations, overview+FAQ (`civic_media_editorial`), news cards |
| PROTECTED_CANONICAL | Outlet names, URLs |
| GEOGRAPHY | Country labels with codes |

Schema **PLP.2** adds `civic_media_editorial`. Prior `PLP.1` snapshots (including reuters/uk) fail closed to canonical until rematerialized. Combined Media resolve remains **one HTTP batch**.

### Reset 03E.1 — rendered semantic coverage authority

Coverage authority is the **rendered** participant-facing tree:

- Every semantic text node emits `MediaSemanticNode` with `OWNER` + `RESULT`
- Gates derive from rendered HTML (`media-rendered-coverage.ts`), not a hand inventory
- Page status: `FULLY_LOCALIZED` | `PARTIALLY_LOCALIZED` | `CANONICAL_ONLY` | `INVALID_COVERAGE`
- `UNOWNED=0` alone is insufficient; non-English `FULLY_LOCALIZED` also requires zero translatable `CANONICAL_FALLBACK`
- Production remains lightweight (data-* attrs only; no DOM crawl on request)

### Reset 03E.2 — localization content integrity

**Invariant:** Publication state is not sufficient evidence of localization. A localized presentation must pass semantic content-integrity validation (`CLI.1`) before it may be served as `PUBLISHED_LOCALIZED`.

| Concern | Rule |
|---------|------|
| TRANSLATABLE leaves | Non-English: must differ from canonical after whitespace-normalized equality (no language detection) |
| PROTECTED_CANONICAL | Names, URLs, technical `*.id` paths — identical allowed; not counted as localization failures |
| Publication | `locale != en` + any missing/empty/canonical-identical required prose → `LOCALIZATION_CONTENT_INTEGRITY_FAILED` → not publishable |
| Atomicity | Whole entity fails closed; no field-by-field hybrid Ukrainian+English publish |
| Legacy PLP.2 | Missing `contentIntegrity` metadata or failed recompute → read path `CANONICAL_FALLBACK` (no delete/mutate) |
| Canonical fallback | Valid availability state; **not** a successful localization result |
| Preflight | Exact identity only: integrity counts/status/reason — no body text, no provider, no writes |

Provider boundary: every AUTO prose path must be present and non-identical to source; extras ignored; missing → `PARTIAL`.

### Reset 03E.3 — localization structural completeness

**Invariant:** Ownership alone, publication state alone, and content difference alone are each insufficient. A participant-facing localized presentation requires:

1. **OWNERSHIP** — every rendered semantic node has a stable owner  
2. **STRUCTURAL REACHABILITY (`LSI.1`)** — every PLP-owned rendered path exists in canonical source → build AUTO map → presentation → apply → renderer  
3. **LOCALIZED CONTENT INTEGRITY (`CLI.1`)** — values are not merely canonical source  

**PLP.2 decision:** Schema version stays **PLP.2**. `LSI.1` is an independent attestation on the snapshot (like `CLI.1`). Entity allowlist expands with `civic_media_fact_check` / `civic_media_propaganda`; principle trees gain `whyItMatters`. Fingerprint changes fail-close old principle snapshots until rematerialized (not done in this pack).

| Concern | Rule |
|---------|------|
| Render authority | Real `/media` composition (`CivicMediaCenterPageContent`) emits `semanticPath` / `messageKey` on `MediaSemanticNode` |
| Build gate | Non-English candidates need `STRUCTURAL_INTEGRITY=PASSED` and `CONTENT_INTEGRITY=PASSED` |
| Resolver | Missing/failed `structuralIntegrity` → `CANONICAL_FALLBACK` (no delete/mutate) |
| Fact/propaganda | Reclassified from UI_DICTIONARY bodies → PLP entities (substantive content) |
| Principle whyItMatters | Moved from UI dictionary catalogs → principle PLP field |
| News | Included in the single Media PLP batch when articles are supplied |
| Thin operator | Persists LSI.1 counts only; render-path parity stays test/dev (no production DOM crawl) |
| ACTIVE count | **30** — unchanged |

### Reset 03E.4 — PLP rebuild eligibility parity

**Invariant:** Read eligibility and rebuild eligibility are complements of the same published-presentation usability contract. A snapshot rejected by the read path must never suppress its own rebuild.

Shared classifier: `classifyUsableLocalizedPresentation` (API domain). For `locale != en`, an existing snapshot is `USABLE_LOCALIZED` / `UNCHANGED_PLP` only when identity, `canonicalVersion`, `localizationSchemaVersion`, `state=PUBLISHED`, CLI.1 (present + PASSED + recompute), and LSI.1 (present + PASSED + recompute) all hold. Otherwise: READ → `CANONICAL_FALLBACK`; BUILD → `REBUILD_REQUIRED` (provider/publish eligible; dry-run still no provider/writes). CT path completeness alone is not reuse proof — candidate must pass CLI.1 + LSI.1.

| Concern | Rule |
|---------|------|
| Shared classifier | One domain function for resolver + materializer + preflight match |
| Diagnostics | `EXISTING_PLP_USABILITY`, `EXISTING_PLP_USABILITY_REASON`, integrity statuses, `REBUILD_REQUIRED` (no bodies) |
| Atomic replace | Invalid current untouched until successful publish; prior → SUPERSEDED |
| ACTIVE count | **30** — unchanged |

### Reset 03E.5 — consumer value lineage

**Invariant:** Localization success requires not only published entity validity but end-to-end **CONSUMER VALUE LINEAGE**.

Normative chain:

1. OWNERSHIP  
2. STRUCTURAL REACHABILITY (`LSI.1`)  
3. CONTENT INTEGRITY (`CLI.1`)  
4. RESOLVER VALIDITY (`PUBLISHED_LOCALIZED`)  
5. **CONSUMER VALUE LINEAGE** — `RESOLVED_LOCALIZED` → `PROJECTED_LOCALIZED` → `PROPAGATED_LOCALIZED` → `RENDERED_LOCALIZED`  
6. RENDERED LOCALIZED VALUE  

A break after resolver is a localization failure (`LOCALIZED_PRESENTATION_CONSUMER_BYPASS`). Path presence markers alone are insufficient — resolved localized values must equal projected/card/rendered values (opaque sentinels in tests).

| Concern | Rule |
|---------|------|
| News | `/media` SSR fetches a bounded news set into the single Media PLP batch; cards consume `plpNewsById` |
| Country Recommended Media | PLP batch keys = country-rail resource ids (`civic_media_trusted`), not WORLD-only miss |
| Trusted card body | Explicit presentation explanation; cannot claim LOCALIZED while rendering canonical |
| Election/initiative rails | `DOMAIN_NOT_YET_MIGRATED` for Media PLP (Initiative CT path; Pack 05) |
| ACTIVE count | **30** — unchanged |

### Reset 03E.6 — live runtime truth

**Invariant:** Published localization is **not** runtime localization proof.

Normative runtime success requires:

1. published presentation validity (CLI.1 + LSI.1 + resolver)  
2. correct requested locale (`uk → uk → uk`)  
3. correct runtime branch (`MEDIA_LOCALIZATION_RUNTIME_BRANCH=PLP`)  
4. consumer value lineage  
5. localized SSR value  
6. localized settled hydrated value  

**False-positive architecture found:** API consumer acceptance (`CONSUMER_MODE=PUBLISHED_LOCALIZED`) proved the **API** process with `HU_MEDIA_PLP_ENABLED=true`, while staging Web historically rolled back to `HU_MEDIA_PLP_ENABLED` unset/false → `/media` stayed on **LEGACY** (`loadCivicMediaEditorialSeed` / CT). RSS cards still translated via generate-on-miss; editorial/FAQ/PLP cards remained English. Deploying consumer fixes (03E.5) without Web entering the PLP branch produces **zero visual change**.

| Concern | Rule |
|---------|------|
| FIRST LOSS | `ROUTE_BRANCH_GAP` / `FEATURE_FLAG_GAP` — Web LEGACY while API PLP valid |
| Observability | `data-hu-media-localization-runtime-branch=PLP\|LEGACY` (+ requested/batch locale) |
| Route authority | `composeMediaPageLocalization` (same function as `/media` page) |
| Rollback | `HU_MEDIA_PLP_WEB_FORCE_LEGACY=true` forces LEGACY even if shared flag ON |
| Flag read | Runtime dynamic `process.env["HU_MEDIA_PLP_ENABLED"]` (not `NEXT_PUBLIC_*`) |
| Playwright cold-cache | Structural HTML fixture ≠ real route composition (`TEST_ARCHITECTURE_FALSE_POSITIVE` if treated as proof) |
| ACTIVE count | **30** — unchanged |

### Reset 03E.7 — live Web PLP payload truth

**Invariant:** Runtime branch `PLP` is **not** end-to-end localization proof when GET diagnostic and Web POST batch disagree on the version gate.

Normative consumer resolve must fingerprint the **authoritative live source** (same as GET diagnostic) when available. Client-supplied canonical trees may drift (whitespace, host seed skew) and must not silently force `CANONICAL_FALLBACK` while a matching `PUBLISHED` snapshot exists for the live version.

Bounded Web probe (`data-hu-media-plp-live-truth`, enabled via `HU_MEDIA_PLP_LIVE_TRUTH_PROBE=true` on staging / non-production by default) records fingerprints only for `overviewSummary`, `faq[0].question`, `faq[0].answer` plus safe request/result metadata — never participant bodies or secrets.

| Concern | Rule |
|---------|------|
| FIRST LOSS | `API_RESPONSE_CONTRACT_GAP` — POST version gate used client fingerprint; GET used live source |
| Repair | `versionSource=live_source` preferred in `resolveMediaPlpConsumerItem` |
| Observability | Fingerprint lineage: CANONICAL → RESOLVED → PROJECTED → SSR |
| False positive | Fixture-injected `PUBLISHED_LOCALIZED` skipped skewed POST gate (`TEST_ARCHITECTURE_FALSE_POSITIVE`) |
| ACTIVE count | **30** — unchanged |

### Reset 03E.9 — Media/Country carousel coverage

**Invariant:** Every card rendered by Media/Country carousels that is Media-PLP-owned must have identical identity through:

`CANONICAL SOURCE → BUILD CANDIDATE → PUBLISHED SNAPSHOT → HTTP RESOLVE / CARD PROP`

| Concern | Rule |
|---------|------|
| Inventory | Route composition catalogs + bounded news (≤12) + optional country trusted (≤12); no corpus scan |
| Live-source parity | `public_news` uses the same thin Mongo projection as the materializer (fixes empty live-source version miss) |
| Diagnostic | `diagnose:media-plp-carousel` — one compact row/entity; totals READY/REBUILD/MISSING/STALE/INTEGRITY/DOMAIN |
| Materialize plan | Explicit entity list from diagnostic; hard max ≤20; one-by-one existing `materialize:media-plp`; dry-run default |
| Election/initiative | `DOMAIN_NOT_YET_MIGRATED` — Initiative CT via `useInitiativeCardTitlePresentation`; future Pack 05 / Initiative PLP migration |
| ACTIVE count | **30** — unchanged |

### Reset 03E.10 — bounded carousel materialization runner

**Invariant:** After a single carousel entity is proven end-to-end, remaining Media PLP carousel snapshots must be fillable via a **bounded sequential** staging runner — never unbounded corpus materialization.

| Concern | Rule |
|---------|------|
| Command | `materialize:media-plp-carousel -- --mongo --locale <code>` (dry-run default; `--execute` required) |
| Selection | 03E.9 discover/classify order; only `REBUILD_REQUIRED` + `nodes > 0` + Media PLP |
| Cap | `--limit` default 20 / hard max 20 |
| Execution | one-by-one `materialize:media-plp`; provider concurrency 1; fail-fast (no `--continue-on-error`) |
| Skip | usable snapshots (0 provider/writes), zero-node, Initiative domain, source missing |
| ACTIVE count | **30** — unchanged |

### Reset 03E.11 — rendered carousel semantic closure

**Invariant:** Every participant-visible Media carousel semantic **leaf** must resolve ownership from the real rendered DOM (not declarative inventory counts). Non-English `FULLY_LOCALIZED` requires zero unowned card leaves and zero translatable `CANONICAL_FALLBACK` carousel PLP leaves.

| Concern | Rule |
|---------|------|
| Authority | Rendered `MediaSemanticNode` leaves + stack-based unowned scan inside card surfaces |
| Page status | `FULLY_LOCALIZED` / `PARTIALLY_LOCALIZED` / `CANONICAL_ONLY` / `INVALID_COVERAGE` from real leaves |
| Fallback | Runtime availability unchanged; acceptance treats carousel `CANONICAL_FALLBACK` as not fully localized |
| AUTO trees | `public_news` title/summary (category = controlled MediaRegistry vocab via UI dictionary); fact-check mission/coverage; propaganda focus/explanation |
| Chips | Coverage chips are PLP `coverage` (machine-translatable civic content), not UI/terminology by default |
| ACTIVE count | **30** — unchanged |

### Reset 03E.13 — public_news live consumer parity

**Invariant:** If materializer usability says current `public_news` entity E has a usable snapshot for locale L / version V / schema S, the HTTP + Web consumer for the `/media` News rail must resolve that same E/V/S to `PUBLISHED_LOCALIZED`. Localization must never attach to a different card.

| Concern | Rule |
|---------|------|
| Authority ID set | Same as Web SSR: `findActivePublicNewsRecords({ language: "en", limit: 12 })` + source balance (`selectMediaPlpConsumerNewsArticles`) |
| Batch key / join | `entityType` + `entityId` (= `article.id`); Web `newsById[article.id]` — not array index |
| Diagnostic | `diagnose:media-plp-news-parity -- --mongo --locale uk` (read-only; `PROVIDER_CALLS=0`) |
| Closure | 12-card News rail: all title+summary leaves localized for `FULLY_LOCALIZED`; 11+1 ⇒ `PARTIALLY_LOCALIZED` |
| ACTIVE count | **30** — unchanged |

### Reset 04 — universal PLP publication pipeline

**Rule:** Localization is a publication concern, not a rendering concern. See ADR-027.

| Concern | Rule |
|---------|------|
| Core vs adapter | Universal core + domain adapters; Media is first adapter |
| Field authority | PROTECTED → LEGAL → BRAND → MANUAL → CONTROLLED/UI → MACHINE |
| Build | Async entity×locale queue; coalesce; concurrency default 1; PARTIAL not publishable |
| News automation | Consumer-identity enqueue (`enqueueConsumerVisibleNewsPlpBuilds`); provider dormant until processor |
| Search/SEO | Post-publish invalidation hooks; HREFLANG DEFERRED |
| RESET 05 | Inventory in `RESET_05_MIGRATION_INVENTORY_v1.0.md` (includes `country-initiative-rail-card__meta`) |
| ACTIVE count | **30** — unchanged |
