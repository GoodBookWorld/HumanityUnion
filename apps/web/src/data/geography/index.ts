/**
 * Web geography facade.
 *
 * Canonical implementation lives in `@hu/geography`.
 * This barrel re-exports the shared package and keeps Web-only search URL helpers.
 */
export type {
  AdministrativeRegionOption,
  CommunityOption,
  CountryOption,
  GeographyCommunityOption,
  GeographyCountryOption,
  GeographyRegionOption,
  GeographyCountry,
  GeographyRegion,
  PublicGeographyInput,
  ResolvedPublicGeography,
  SanitizedParticipationGeography,
} from "@hu/geography";

export {
  OTHER_REGION_CODE,
  OTHER_REGION_SLUG,
  OTHER_COMMUNITY_CODE,
  OTHER_COMMUNITY_SLUG,
  formatRegionCode,
  getCountries,
  getCountriesByRegion,
  getCountriesBySubregion,
  getCountryByCode,
  getCountryByCodeOrLabel,
  getCountryBySlug,
  getCountryLabel,
  getRegionByCode,
  getRegionLabel,
  getRegionsByCountry,
  getRegionsForCountry,
  isRecognizedCountrySlug,
  isRecognizedRegionSlug,
  normalizeCountryInput,
  normalizeCountrySlug,
  normalizeRegionInput,
  resolveCountrySearchSlug,
  resolveCountrySearchToken,
  resolveRegionSearchSlug,
  resolveRegionSearchToken,
  searchCountries,
  searchRegions,
  toGeographyCountryOptions,
  toGeographyRegionOptions,
  GEOGRAPHY_COUNTRIES,
  fetchCommunitiesByRegion,
  getCommunityLabel,
  normalizeCommunityInput,
  toGeographyCommunityOptions,
  buildPreferredCityCommunityLabel,
  buildPreferredRegionLabel,
  cityCommunityIdMatchesSelection,
  formatPreferredCityCommunityId,
  formatPreferredRegionId,
  normalizeParticipationGeographyLegacy,
  normalizePreferredRegionId,
  parsePreferredCityCommunityId,
  parsePreferredRegionId,
  regionIdMatchesSelection,
  sanitizeParticipationGeography,
  formatPublicGeography,
  formatPublicGeographyLabel,
  resolvePublicGeography,
} from "@hu/geography";

export { buildSearchUrlForGeographyScope } from "./helpers";
export type { GeographySearchScope } from "./helpers";
