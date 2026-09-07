# ADR-027 — Universal PLP Publication Pipeline (RESET 04)

## Status

Accepted (RESET 04). Supplemented by RESET 05 domain adapters. Supplements ADR-026.

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

`enqueueConsumerVisibleNewsPlpBuilds` / mutation bridge with `HU_PLP_AUTO_BUILD_LOCALES`. RESET 05C wires production processor; RESET 05C.1 persists work in Mongo `plp_auto_build_work` and boots the drain **after** PLP persistence / **before** the news scheduler. Concurrency default 1. Auto-build inventory = consumer-visible union (limit 24); `/media` SSR selection remains 03E.13 limit 12.

## Consequences

- RESET 05 registers `initiative_lifecycle` (second production adapter), plus `blog_knowledge` / `discussion` / `participant_public`. Country Initiative/election rails migrate meta ownership; stage/detail consumers remain CT until live acceptance.
- Existing Media PLP.2 snapshots remain compatible (no schema bump in RESET 04/05).
- Legacy CT remains until each consumer migrates and RESET 07 removes runtime.

## Non-goals (RESET 04/05 packs)

No push/deploy/live Gemini; no locale URLs/hreflang (RESET 08); no full legacy CT removal (RESET 07).
