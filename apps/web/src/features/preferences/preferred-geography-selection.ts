import type { ParticipationPreferences } from "@hu/types";
import { formatPreferredRegionId, OTHER_REGION_SLUG, sanitizeParticipationGeography } from "@hu/geography";

function withCountry(values: readonly string[], countryCode: string): string[] {
  return values.includes(countryCode) ? [...values] : [...values, countryCode];
}

function withRegion(values: readonly string[], regionId: string): string[] {
  return values.includes(regionId) ? [...values] : [...values, regionId];
}

export function applyPreferredCountrySelection(
  participationPreferences: ParticipationPreferences,
  preferredCountryIds: readonly string[],
): ParticipationPreferences {
  return sanitizeParticipationGeography({
    ...participationPreferences,
    preferredCountryIds: [...preferredCountryIds],
  }).participationPreferences;
}

/**
 * Commits a completed country + administrative-region picker selection.
 * Returns null when the selection is incomplete, "other", or not a canonical region.
 */
export function commitPreferredRegionSelection(
  participationPreferences: ParticipationPreferences,
  regionCountryCode: string,
  regionCode: string,
): ParticipationPreferences | null {
  const country = regionCountryCode.trim();
  const region = regionCode.trim();

  if (!country || !region || region === OTHER_REGION_SLUG) {
    return null;
  }

  const regionId = formatPreferredRegionId(country, region);
  const next = sanitizeParticipationGeography({
    ...participationPreferences,
    preferredCountryIds: withCountry(participationPreferences.preferredCountryIds, country),
    preferredRegions: withRegion(participationPreferences.preferredRegions, regionId),
  }).participationPreferences;

  if (!next.preferredRegions.includes(regionId)) {
    return null;
  }

  return next;
}

export function removePreferredRegionSelection(
  participationPreferences: ParticipationPreferences,
  regionId: string,
): ParticipationPreferences {
  return sanitizeParticipationGeography({
    ...participationPreferences,
    preferredRegions: participationPreferences.preferredRegions.filter((entry) => entry !== regionId),
  }).participationPreferences;
}
