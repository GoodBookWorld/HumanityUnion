import type { ParticipationPreferences } from "@hu/types";
import {
  formatPreferredCityCommunityId,
  formatPreferredRegionId,
  normalizeCountryInput,
  normalizePreferredRegionId,
  normalizeRegionInput,
  OTHER_COMMUNITY_CODE,
  OTHER_COMMUNITY_SLUG,
  OTHER_REGION_SLUG,
  parsePreferredCityCommunityId,
  parsePreferredRegionId,
} from "@hu/geography";

import { resolveParticipationCommunitySlug } from "../participation-area/participation-area-community.loader.js";

export interface ParticipantPreferenceGeographySource {
  /** Home Participants are auth users whose status is not "disabled". */
  eligible: boolean;
  participationPreferences?: Partial<
    Pick<
      ParticipationPreferences,
      | "preferredCountryIds"
      | "preferredRegions"
      | "preferredCityCommunityIds"
      | "preferredGeographicScopes"
      | "preferredActivityAreas"
    >
  > | null;
}

interface CanonicalRegion {
  country: string;
  identity: string;
}

interface CanonicalCity extends CanonicalRegion {
  parentRegionIdentity: string;
}

function canonicalRegion(
  regionId: string,
  preferredCountryIds: readonly string[],
): CanonicalRegion | null {
  const normalized = normalizePreferredRegionId(regionId, preferredCountryIds);
  const parsed = normalized ? parsePreferredRegionId(normalized) : null;

  if (!parsed?.countryCode || !parsed.regionCode) {
    return null;
  }

  const country = normalizeCountryInput(parsed.countryCode);
  const region = country ? normalizeRegionInput(country, parsed.regionCode) : undefined;

  if (!country || !region || region === OTHER_REGION_SLUG) {
    return null;
  }

  return {
    country,
    identity: formatPreferredRegionId(country, region),
  };
}

function canonicalCity(cityId: string): CanonicalCity | null {
  const parsed = parsePreferredCityCommunityId(cityId);

  if (!parsed) {
    return null;
  }

  const country = normalizeCountryInput(parsed.countryCode);
  const region = country ? normalizeRegionInput(country, parsed.regionCode) : undefined;

  if (!country || !region || region === OTHER_REGION_SLUG) {
    return null;
  }

  const community = resolveParticipationCommunitySlug({
    countrySlug: country,
    regionSlug: region,
    communitySlug: parsed.communityCode,
  });

  if (
    !community ||
    community === OTHER_COMMUNITY_SLUG ||
    community === OTHER_COMMUNITY_CODE
  ) {
    return null;
  }

  return {
    country,
    parentRegionIdentity: formatPreferredRegionId(country, region),
    identity: formatPreferredCityCommunityId(country, region, community),
  };
}

/**
 * Countries are distinct canonical countries in preference geography.
 * Regions are MODEL B: each saved city is one area, and a saved region counts
 * only when that same Participant selected no city under it.
 */
export function countParticipantPreferenceGeography(
  participants: readonly ParticipantPreferenceGeographySource[],
): { countries: number; regions: number } {
  const countries = new Set<string>();
  const regions = new Set<string>();

  for (const participant of participants) {
    if (!participant.eligible || !participant.participationPreferences) {
      continue;
    }

    const preferences = participant.participationPreferences;
    const explicitCountryIds = preferences.preferredCountryIds ?? [];
    const explicitCountries = explicitCountryIds
      .map((countryId) => normalizeCountryInput(countryId))
      .filter((countryId): countryId is string => Boolean(countryId));

    for (const country of explicitCountries) {
      countries.add(country);
    }

    const selectedRegions = (preferences.preferredRegions ?? [])
      .map((regionId) => canonicalRegion(regionId, explicitCountries))
      .filter((region): region is CanonicalRegion => Boolean(region));

    const selectedCities = (preferences.preferredCityCommunityIds ?? [])
      .map((cityId) => canonicalCity(cityId))
      .filter((city): city is CanonicalCity => Boolean(city));

    const cityParentRegions = new Set(selectedCities.map((city) => city.parentRegionIdentity));

    for (const region of selectedRegions) {
      countries.add(region.country);

      if (!cityParentRegions.has(region.identity)) {
        regions.add(region.identity);
      }
    }

    for (const city of selectedCities) {
      countries.add(city.country);
      regions.add(city.identity);
    }
  }

  return {
    countries: countries.size,
    regions: regions.size,
  };
}
