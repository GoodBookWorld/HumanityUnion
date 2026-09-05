# Pack 08K — Route / Boundary Matrix

Participant-facing routes that must consume **PublicLocalizedPresentation** (or an equivalent shared presentation contract) for semantic prose. UI chrome stays next-intl / `uiDictionaryValue`.

| Route / surface | Family | Presentation path | Boundary |
|-----------------|--------|-------------------|----------|
| `/blog` | `blog_post` | Blog index cards via `resolveBlogPostPresentation` | `localizePublicPresentation` coverage on resolve |
| `/blog/[slug]` | `blog_post` | Article body via `resolveBlogPostPresentation` | Public localization boundary |
| `/media` | `civic_media` | Principles + trusted editorial | PublicLocalizedPresentation / CivicMediaTranslatedEditorial |
| `/knowledge` | `knowledge_article` | Knowledge center index titles | `adapters/knowledge-article-presentation` |
| `/knowledge/[slug]` | `knowledge_article` | Article purpose / overview / sections | `adapters/knowledge-article-presentation` |
| `/search` | `search_result` | Result title / summary | `adapters/search-result-presentation` |
| PWA initiative feed | `initiative` / feed item | Feed titles / context | `adapters/pwa-feed-presentation` |
| `/initiatives` | `initiative` | World initiatives cards | Initiative presentation owners |
| `/initiatives/public/[initiativeId]` | `initiative` + lifecycle | Title / description + lifecycle rails | `useInitiativePublicPresentation` + PublicTranslatedFields |
| `#discussion` (initiative public) | `discussion_comment` | Comment body | Discussion presentation / PublicLocalizedPresentation |
| `#collaborative-analysis` | `collaborative_analysis` | CA fields | `PublicTranslatedFields` |
| `#petition` | `petition` | Petition statement / paragraphs | `PublicTranslatedFields` / presentation tree |
| Improvement proposal public | `improvement_proposal` | Proposal semantic fields | LifecycleTranslatedRecordCard |
| Revision public | `initiative_revision` | Revision summary / title | LifecycleTranslatedRecordCard |
| Decision session public | `decision_session` | Session title / summary | LifecycleTranslatedRecordCard |
| Collective decision public | `collective_decision` | Decision title / summary | LifecycleTranslatedRecordCard |
| Commitment public | `implementation_commitment` | Commitment title / summary | LifecycleTranslatedRecordCard |
| Tracking public | `implementation_tracking` | Tracking title / summary | LifecycleTranslatedRecordCard |
| Official response public | `official_response` | Response summary | `PublicTranslatedFields` |
| Public impact | `public_impact` | Impact summary | LifecycleTranslatedRecordCard |
| `/civic-archive` / `[initiativeId]` | `civic_archive` | Archive narrative | Civic archive presentation |
| Country / community CI rails | `ci_rail` | Collaboration / overlap titles | `adapters/ci-rail-presentation` |
| Country trusted media evidence | `civic_media` / search-shaped | Trusted card explanations | Protected outlet identity + AUTO explanation |
| Home interactive map | geography display + UI chrome | `InteractiveWorldMap` + iframe tooltip | Geography resolver + next-intl; no CT for ordinary names |
| Country Recommended Media rail | `civic_media` trusted | Shared overlay + `TrustedMediaRailCard` | Same `civic_media` identity/version as `/media` |
| Member recent public initiatives | `ci_rail` / initiative title | Disclosure titles | `adapters/ci-rail-presentation` |
| Public news related initiatives | `search_result` | Related titles | `adapters/search-result-presentation` |
| Capability / Civic Integration widgets | `ci_rail` | Widget titles | `adapters/ci-rail-presentation` |

## Acceptance notes

- **AUTO_TRANSLATABLE** by default for plain semantic strings.
- **Protected** values (`protectedIdentity`, `protectedTechnical`, …) must remain byte-identical.
- Partial trees (e.g. petition 4/5 paragraphs) → `FALLBACK_CANONICAL`, never `COMPLETE`.
- `INTENTIONAL_LOCALIZATION_DEBT` must remain empty.
- Browser acceptance: `apps/web/src/features/language/pack08k-browser-acceptance.test.ts` (SSR markup; viewports 375 / 900 / 1280 documented in test names).
- Read-only staging diagnostic: `pnpm --filter @hu/api diagnose:public-localization` (identities/counts only; not `site_translation_coverage`).

See also:

- `PUBLIC_LOCALIZATION_DEVELOPER_CONTRACT_v1.0.md`
- `LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md` § Pack 08K
