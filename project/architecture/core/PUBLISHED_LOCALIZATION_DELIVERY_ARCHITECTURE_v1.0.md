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
