# ADR-027 — Universal PLP Publication Pipeline (RESET 04)

## Status

Accepted (RESET 04). Supplements ADR-026. Does **not** migrate Initiative/Blog/Discussions.

## Context

Media PLP (RESET 02–03E.13) is live-proven on staging. Remaining domains must not invent parallel translation architectures. RESET 04 extracts a **domain-neutral publication contract** so RESET 05+ can migrate domains via adapters.

## Decision

**Localization is a publication concern, not a rendering concern.**

```
Canonical Content
  → Localization Build (async, entity×locale, version-aware)
  → Atomic Published Localized Presentation (PLP.2)
  → API / SSR resolve (PUBLISHED_LOCALIZED | CANONICAL_FALLBACK)
  → React
```

### Classification of existing code

| Class | Role |
|-------|------|
| A. UNIVERSAL PLP CORE | publish/resolve/usability/integrity/persistence + RESET 04 `universal/` |
| B. MEDIA ADAPTER | `media/` + `universal/adapters/media-plp-adapter` |
| C. TEMPORARY OPERATORS | materialize/diagnose CLIs |
| D. LEGACY CT RUNTIME | content_translations warm/resolve (ACTIVE until domain migrates) |

### Domain adapter contract

Domains join via `registerPlpDomainAdapter`. Adapters supply entity types, canonical resolve, fingerprint, field policy, and optional SEO. Core must not know RSS, PublicNewsCard, Media Registry, or Media-specific IDs.

### Field authority (highest → lowest)

PROTECTED_CANONICAL → LEGAL → BRAND → MANUAL_OR_AUTHOR_APPROVED → CONTROLLED_VOCABULARY → UI_DICTIONARY → MACHINE_CONTENT → NON_LOCALIZABLE_DATA

Mapped to `PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY`. Machine must never overwrite higher authority.

### Build triggers

Canonical publish/update; Registry locale enable; manual/author update; terminology change; Admin rebuild; dynamic source refresh; **consumer-visible collection refresh** (News must use consumer identity authority — 03E.13).

### Worker safety

Provider concurrency default **1**; no fanout; no build-on-read; thin import boundary; coalesce queue; stale version cannot overwrite; PARTIAL cannot PUBLISH.

### Search / SEO

`notifyPlpSearchSeoInvalidation` after atomic publish. HREFLANG remains **DEFERRED**. No locale-prefixed URLs in RESET 04.

### Dynamic RSS

`enqueueConsumerVisibleNewsPlpBuilds` / mutation bridge with `HU_PLP_AUTO_BUILD_LOCALES`. Queue active; provider dormant until processor wired. Selection = `/media` consumer set.

## Consequences

- RESET 05 migrates Initiative/Lifecycle (including `country-initiative-rail-card__meta`) through a new adapter — not Media forks.
- Existing Media PLP.2 snapshots remain compatible (no schema bump in RESET 04).
- Legacy CT remains until each domain migrates.

## Non-goals

No push/deploy/live Gemini; no Initiative migration; no locale URLs; no legacy removal.
