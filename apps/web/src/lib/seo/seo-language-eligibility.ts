/**
 * Pack 02I — SEO language indexability eligibility.
 *
 * Three distinct Language Registry concepts (do not conflate):
 *
 * 1. **enabled** — locale is selectable for UI / interface runtime.
 * 2. **searchEnabled** — eligible for multilingual search indexing (Pack 02H).
 * 3. **seoIndexingEnabled** — eligible for SEO / sitemap language metadata readiness.
 *
 * Content translation availability (`contentTranslationEnabled`, cached
 * translations, UI catalog completeness) is a fourth concern and must not
 * alone decide SEO indexability.
 *
 * A locale is SEO-indexable only when Registry `enabled` AND `seoIndexingEnabled`.
 * This helper does **not** authorize emitting hreflang language alternates
 * (see `hreflang-policy.ts` — HREFLANG_DEFERRED).
 */

export { isSeoIndexableLanguage } from "@hu/types";
export type { SeoIndexableLanguageRecord } from "@hu/types";
