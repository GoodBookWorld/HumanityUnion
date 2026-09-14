/**
 * RESET 05D — web re-exports the shared country rail selector.
 * Authoritative implementation: @hu/media-registry (no duplicated selection).
 */

export {
  COUNTRY_PUBLIC_NEWS_CANDIDATE_LIMIT,
  COUNTRY_PUBLIC_NEWS_RAIL_LIMIT,
  buildCountryPreferredSourceNames,
  filterPublicNewsForCountry,
  isCountryRelevantArticle,
  mapGeographyRegionToRegistryTag,
  selectCountryPublicNewsRail,
  type CountryPublicNewsContext,
  type CountryPublicNewsMediaRef,
  type CountryPublicNewsSelectionResult,
} from "@hu/media-registry";

import type { PublicNewsArticleItem } from "@hu/types";

/** Compat shape for older call sites. */
export type CountryPublicNewsFilterResult = {
  articles: PublicNewsArticleItem[];
  usedFallback: boolean;
};
