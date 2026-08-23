/**
 * Pack 09F1 — Country → Region → City dependency contract helpers.
 *
 * Canonical identifiers (via @hu/geography):
 * - Country: ISO alpha-2 (`CA`)
 * - Region: ISO-3166-2-style (`CA-BC`) or `other-not-listed`
 * - City/Community: CSC numeric code as string, or `other-not-listed`
 */

import {
  getRegionsByCountry,
  isRecognizedCountrySlug,
  isRecognizedRegionSlug,
  normalizeCountryInput,
  normalizeRegionInput,
  OTHER_COMMUNITY_SLUG,
  OTHER_REGION_SLUG,
} from "@hu/geography";

export const GEOGRAPHY_EMPTY_COPY = {
  selectCountryFirst: "Select a country first.",
  selectRegionFirst: "Select a region to choose a city.",
  noRegions: "No regions available for this country.",
  noRegionsUseOther:
    "No structured regions for this country. Choose Other / Not listed if needed.",
  /** Valid empty dataset (HTTP 200, JSON []). */
  noCities: "No cities or communities are listed for this region.",
  noCitiesUseOther:
    "No structured cities for this region. Choose Other / Not listed if needed.",
  /** User typed a query with zero matches (dataset was non-empty). */
  noCityMatches: "No matching cities or communities found.",
  /** Pack 10F — distinct from empty dataset (valid JSON with 0 communities). */
  cityDeliveryFailure: "City data could not be loaded.",
  loadingCities: "Loading cities and communities…",
  cityHelper: "City, municipality, or district within the selected region.",
  citySearchPlaceholder: "Search cities or communities…",
} as const;

/**
 * @deprecated Pack 10H1 — search is never required to reveal cities.
 * Retained only as a windowing/perf alias constant for older tests.
 */
export const CITY_REQUIRE_SEARCH_ABOVE = 80;

export function formatCityListHelper(count: number): string {
  return `${count} cities and communities available. Scroll the list or search to filter.`;
}

/** @deprecated Pack 10H1 — use formatCityListHelper. */
export function formatLargeCitySearchHelper(count: number): string {
  return formatCityListHelper(count);
}

export interface GeographyCascadeValues {
  countryCode: string;
  regionCode: string;
  communityCode: string;
  countryLabel?: string;
  regionLabel?: string;
  communityLabel?: string;
}

/** True when @hu/geography has first-level administrative subdivisions for the country. */
export function countryHasStructuredRegions(countryCode: string): boolean {
  const normalized = normalizeCountryInput(countryCode);
  if (!normalized) {
    return false;
  }
  return getRegionsByCountry(normalized).length > 0;
}

export function isCanonicalOtherRegion(regionCode: string): boolean {
  return regionCode === OTHER_REGION_SLUG;
}

export function isCanonicalOtherCommunity(communityCode: string): boolean {
  return communityCode === OTHER_COMMUNITY_SLUG;
}

/**
 * When Country changes: clear Region and City.
 * Callers should also reload region options for the new country.
 */
export function patchAfterCountryChange(
  nextCountryCode: string,
  countryLabel = "",
): Pick<
  GeographyCascadeValues,
  "countryCode" | "countryLabel" | "regionCode" | "regionLabel" | "communityCode" | "communityLabel"
> {
  return {
    countryCode: nextCountryCode,
    countryLabel,
    regionCode: "",
    regionLabel: "",
    communityCode: "",
    communityLabel: "",
  };
}

/**
 * When Region changes: clear City.
 * Callers should also reload city options for the new region.
 */
export function patchAfterRegionChange(
  nextRegionCode: string,
  regionLabel = "",
): Pick<GeographyCascadeValues, "regionCode" | "regionLabel" | "communityCode" | "communityLabel"> {
  return {
    regionCode: nextRegionCode,
    regionLabel,
    communityCode: "",
    communityLabel: "",
  };
}

/**
 * Soft client-side consistency check for structured IDs.
 * Does not invent data; returns false for invalid parent/child pairs.
 */
export function isStructuredGeographyConsistent(input: {
  countryCode?: string;
  regionCode?: string;
  communityCode?: string;
}): boolean {
  const country = input.countryCode ? normalizeCountryInput(input.countryCode) : undefined;

  if (input.countryCode?.trim() && !country) {
    return false;
  }

  if (country && !isRecognizedCountrySlug(country)) {
    return false;
  }

  if (!input.regionCode?.trim()) {
    return !input.communityCode?.trim();
  }

  if (!country) {
    return false;
  }

  const region = normalizeRegionInput(country, input.regionCode);

  if (!region || !isRecognizedRegionSlug(country, region)) {
    return false;
  }

  if (!input.communityCode?.trim()) {
    return true;
  }

  if (region === OTHER_REGION_SLUG) {
    return input.communityCode === OTHER_COMMUNITY_SLUG || !input.communityCode.trim();
  }

  return true;
}
