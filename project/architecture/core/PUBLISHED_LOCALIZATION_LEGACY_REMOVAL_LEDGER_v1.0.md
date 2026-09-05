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
| L07 CivicMediaTranslatedEditorial | `ACTIVE_LEGACY_FALLBACK` (default) / `REPLACED_PENDING_LIVE_ACCEPTANCE` when `HU_MEDIA_PLP_ENABLED=true` |
| L08 useTrustedMediaExplanationsOverlay | same (`disabled` in PLP mode) |
| L09 loadCivicMediaEditorialSeed | same (skipped when PLP on) |
| L10 media/page editorial wiring | same (PLP branch behind flag) |
| L11 country trusted SSR seed | same |
| L12 use-localized-public-news-card | `ACTIVE_LEGACY_FALLBACK` (news PLP consume later within Media flag) |
| L13 resolve-public-news-presentation | `ACTIVE_LEGACY_FALLBACK` |

Rollback: unset `HU_MEDIA_PLP_ENABLED` → legacy Media path. PLP lookup failure → coherent CANONICAL_FALLBACK (does not re-enter generate-on-miss overlays).
