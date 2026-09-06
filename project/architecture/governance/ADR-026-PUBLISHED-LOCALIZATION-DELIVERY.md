# ADR-026 — Published Localization Delivery

| Field | Value |
|-------|-------|
| ID | ADR-026 |
| Title | Published Localization Delivery (Translation Delivery Reset 01) |
| Status | Accepted (architecture baseline; runtime unchanged) |
| Date | 2026-09-05 |
| Normative docs | `PUBLISHED_LOCALIZATION_DELIVERY_ARCHITECTURE_v1.0.md`, `PUBLISHED_LOCALIZATION_LEGACY_REMOVAL_LEDGER_v1.0.md` |

---

## Context

Packs 08K–08K.3.3 established ownership wrappers, `PublicLocalizedPresentation`, semantic fingerprints, PARTIAL repair, shared Media overlays, and geography resolvers. Participant-facing localization still largely behaves as a **rendering concern**:

- Web assembles and merges raw + translated field bags  
- SSR seeds warm rows, then client generate-on-miss / PARTIAL upgrades change language after hydration  
- Multiple surfaces independently resolve the same entity/locale  
- Staging has OOMed when diagnostics/reconcile hydrated translation corpora  

Manual Brand / Legal / Terminology control and bounded worker concurrency (default 1) must be preserved.

## Decision

Adopt a single delivery architecture:

**Canonical Public Content → asynchronous Localization Build → atomic Published Localized Presentation → API/SSR → React**

Normative principle: **localization is a publication concern, not a rendering concern.**

1. **PublishedLocalizedPresentation** is the public read artifact (identity: entityType, entityId, locale, canonicalVersion, localizationSchemaVersion).  
2. Lifecycle: BUILDING → PUBLISHED | FAILED; PUBLISHED → SUPERSEDED.  
3. **PARTIAL must not be published** as participant-facing localized content.  
4. Read API: `resolvePublishedPresentation` → `PUBLISHED_LOCALIZED` or coherent `CANONICAL_FALLBACK` (no mixed field fallback; no provider on read).  
5. Priority: protected → Legal → Brand → manual → terminology/geography → machine → canonical fallback.  
6. Build uses existing bounded worker (default concurrency 1) and provider seam; no unbounded fan-out.  
7. Memory/load safety: no corpus hydrate on normal Web/API reads; indexed lookup; thin diagnostics.  
8. Media is the first migration slice; cold-cache acceptance gates implementation.  
9. `HREFLANG_STATUS` remains DEFERRED until locale-addressable URLs (Phase H).  
10. **Reset 03E.2:** Publication state is not evidence of localization. Non-English `PUBLISHED_LOCALIZED` requires `CLI.1` semantic content-integrity (translatable values must differ from canonical). Missing/failed integrity ⇒ `CANONICAL_FALLBACK`. Canonical fallback is availability, not successful localization.  
11. **Reset 03E.3:** Ownership + content difference are still insufficient. Non-English `PUBLISHED_LOCALIZED` also requires `LSI.1` structural reachability (canonical → build → presentation → apply → renderer). Render-authority structural parity is enforced in test/dev from real `/media` markers.  

Reset 01 documents the baseline only — **no runtime behavior change**.

## Consequences

### Positive

- Coherent first paint (no mixed-language cards when published)  
- Clear rollback via phased flags  
- Manual/Brand/Legal control preserved above machine MT  
- Aligns with future `/uk/...` style SEO routing without a second translation engine  

### Negative / costs

- Requires new persistence for snapshots and a Media vertical implementation pack  
- Temporary dual-path complexity during Phases B–G  
- Legacy removal discipline required (ledger)

### Explicit non-goals of this ADR acceptance

No Mongo migration, provider calls, worker changes, Web fixes, staging/prod commands, or backfill in Reset 01.

## Alternatives considered

1. **Continue Pack 08K render-time localization** — rejected: mixed language, generate-on-miss, OOM risk, duplicate resolves.  
2. **Edge/CDN translate on request** — rejected: provider on read path; no atomic snapshot; SEO inconsistency.  
3. **Big-bang cutover** — rejected: no safe rollback; Media-first phased migration preferred.
