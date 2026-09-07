# RESET 05 — Migration Inventory v1.0 (audited)

**Status:** Inventory **resolved** for participant-facing public/civic surfaces.  
**Schema:** `PLP.2` (no bump — existing Media snapshots remain compatible).  
**Pack date:** 2026-09-06

CSS class names are **not** canonical identities. Identity = domain entity type + stable entityId + semanticPath.

---

## Explicit sentinel — `country-initiative-rail-card__meta`

| Item | Value |
|------|--------|
| CSS / surface | `.country-initiative-rail-card__meta` (render chrome only) |
| Render | `CountryInitiativeRailCard` — activityArea · geography; `CountryElectionRailCard` — geography |
| Canonical sources | `activityArea` (catalog) + GEOGRAPHY codes (`countryCode` / `regionCode` / `communitySlug`) |
| Verified ownership | **activityArea** → `CONTROLLED_VOCABULARY` / UI_DICTIONARY (`initiativeExperience.activityAreas.*`) |
| | **geographyLabel** English projection is `PROTECTED_CANONICAL`; display via `@hu/geography` `formatPublicGeography({ locale, … })` — **GEOGRAPHY** authority (not MACHINE) |
| Adapter | `initiative_lifecycle` |
| Consumer markers | `data-hu-plp-adapter="initiative_lifecycle"`; `MediaSemanticNode` on both meta leaves |
| Legacy marker | `DOMAIN_NOT_YET_MIGRATED` **removed** for these rails |
| Do not | Hardcode Ukrainian; locally patch strings; treat meta CSS as identity |

---

## Domain inventory (audited)

| Domain / surface | Entity type | Stable id | Fingerprint | Field policy | Current path | Target adapter | Status |
|------------------|-------------|-----------|-------------|--------------|--------------|----------------|--------|
| Country Initiative rail | `initiative` | `initiativePlpEntityId(id)` | sha256 card tree | `INITIATIVE_CARD_FIELD_OWNERSHIP` | PLP + GEOGRAPHY + UI dict | `initiative_lifecycle` | **MIGRATED_CONSUMER** |
| Country election rail | `initiative` | same | same | same | same | `initiative_lifecycle` | **MIGRATED_CONSUMER** |
| Initiative detail title/summary | `initiative` | same | same | title/summary MACHINE | Legacy CT (L16–L18) | `initiative_lifecycle` | **ADAPTER_READY_CONSUMER_LEGACY** |
| Lifecycle stage prose (CA→Archive) | stage kinds | stage record ids | TBD per stage publish | inventory rows | CT / PublicTranslatedFields | `initiative_lifecycle` (same contract) | **ADAPTER_READY_CONSUMER_LEGACY** |
| Blog / Knowledge / Publications | `blog_post` | postId | sha256 tree | title/excerpt MACHINE; content MANUAL; category CONTROLLED | CT (L14–L15) | `blog_knowledge` | **ADAPTER_READY_CONSUMER_LEGACY** |
| Public Discussions | `discussion_comment` | commentId | sha256 tree | body MACHINE; private → null | CT (L19) | `discussion` | **ADAPTER_READY_CONSUMER_LEGACY** |
| Public Participant profile | `participant_public` | profileId | sha256 tree | bio/org MACHINE; visibility gate | CT | `participant_public` | **ADAPTER_READY_CONSUMER_LEGACY** |
| Media (reference) | Media entity types | Media ids | existing | Media policies | PLP | `media` | **MIGRATED** (reference) |

Lifecycle stage inventory authority: `INITIATIVE_LIFECYCLE_PLP_INVENTORY` + `evaluateInitiativeLifecycleSemanticClosure()`.

---

## Exclusions (intentional — not MACHINE PLP)

| Class | Examples | Reason |
|-------|----------|--------|
| UI_DICTIONARY | status badges, stage chrome, “Updated”, CTAs | Interface chrome |
| CONTROLLED_VOCABULARY | `activityArea`, blog `category` | Catalog / registry |
| GEOGRAPHY / PROTECTED_CANONICAL | geo codes; English geographyLabel fallback | `@hu/geography` authority |
| BRAND / LEGAL | brand/legal modules | KEEP (K01–K02) |
| NON_LOCALIZABLE_DATA | ids, hrefs, timestamps, counts | Technical |
| PRIVACY_INELIGIBLE | private discussion, members_only/hidden profiles, DMs, auth | Never enter public PLP |

---

## Semantic-gap detection

- `evaluateCountryInitiativeRailSemanticGaps(html)` — fails on unowned `__meta` / `DOMAIN_NOT_YET_MIGRATED`
- `evaluateReset05SemanticGaps` — rail + lifecycle inventory closure
- Fixture: intentionally unowned meta **must** fail acceptance

---

## Build / publication contract

Canonical → Build Request → Domain Adapter → Field Authority → Integrity → Atomic PLP Publish → API/SSR → React  

No generate-on-read / SSR provider / client overlay / per-page Gemini / parallel locale registry for migrated consumers.

Canonical Initiative card fingerprint change ⇒ prior localized snapshot stale (`isPlpBuildStaleAgainstLive`).  
Successful publish ⇒ `notifyPlpSearchSeoInvalidation` (hreflang still DEFERRED — RESET 08).

---

## Notes

- Universal PLP core has **no** Initiative-specific branching (acceptance-tested).
- Both lifecycle profiles (`PUBLIC_CIVIC` / `PUBLIC_CHOICE`) share entity type `initiative`.
- Participant is the universal actor identity (not Member).
- Full legacy CT removal remains **RESET 07**.
