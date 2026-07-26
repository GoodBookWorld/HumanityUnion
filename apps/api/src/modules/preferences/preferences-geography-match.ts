import type { Initiative, MemberPreferences } from "@hu/types";
import {
  getCountryLabel,
  getRegionLabel,
  normalizeCountryInput,
  normalizeRegionInput,
  parsePreferredCityCommunityId,
  parsePreferredRegionId,
} from "@hu/geography";

import { getParticipationCommunityLabel } from "../participation-area/participation-area-community.loader.js";

function resolveInitiativeCountryCode(initiative: Initiative): string | undefined {
  const countrySlug = initiative.metadata.countrySlug?.trim();

  if (!countrySlug) {
    return undefined;
  }

  return normalizeCountryInput(countrySlug);
}

function resolveInitiativeRegionCode(initiative: Initiative): string | undefined {
  const countryCode = resolveInitiativeCountryCode(initiative);
  const regionSlug = initiative.metadata.regionSlug?.trim();

  if (!countryCode || !regionSlug) {
    return undefined;
  }

  return normalizeRegionInput(countryCode, regionSlug);
}

function resolveInitiativeCommunityCode(initiative: Initiative): string | undefined {
  const countryCode = resolveInitiativeCountryCode(initiative);
  const regionCode = resolveInitiativeRegionCode(initiative);
  const communitySlug = initiative.metadata.communitySlug?.trim();

  if (!countryCode || !regionCode || !communitySlug) {
    return undefined;
  }

  return communitySlug;
}

function matchesPreferredCityCommunity(
  preferences: MemberPreferences,
  initiative: Initiative,
): string | null {
  const cityCommunityIds = preferences.participationPreferences.preferredCityCommunityIds;

  if (cityCommunityIds.length === 0) {
    return null;
  }

  const countryCode = resolveInitiativeCountryCode(initiative);
  const regionCode = resolveInitiativeRegionCode(initiative);
  const communityCode = resolveInitiativeCommunityCode(initiative);

  if (!countryCode || !regionCode || !communityCode) {
    return null;
  }

  for (const cityCommunityId of cityCommunityIds) {
    const parsed = parsePreferredCityCommunityId(cityCommunityId);

    if (!parsed) {
      continue;
    }

    const preferredCountry = normalizeCountryInput(parsed.countryCode);
    const preferredRegion = normalizeRegionInput(parsed.countryCode, parsed.regionCode);

    if (
      preferredCountry === countryCode &&
      preferredRegion === regionCode &&
      parsed.communityCode === communityCode
    ) {
      const label =
        getParticipationCommunityLabel({
          countrySlug: countryCode,
          regionSlug: regionCode,
          communitySlug: communityCode,
        }) ?? parsed.communityCode;

      return label;
    }
  }

  return null;
}

function matchesPreferredRegion(
  preferences: MemberPreferences,
  initiative: Initiative,
): string | null {
  const preferredRegions = preferences.participationPreferences.preferredRegions;

  if (preferredRegions.length === 0) {
    return null;
  }

  const countryCode = resolveInitiativeCountryCode(initiative);
  const regionCode = resolveInitiativeRegionCode(initiative);

  if (!countryCode || !regionCode) {
    return null;
  }

  const initiativeCountryCode: string = countryCode;
  const initiativeRegionCode: string = regionCode;

  for (const regionId of preferredRegions) {
    const parsed = parsePreferredRegionId(regionId);

    if (!parsed) {
      continue;
    }

    const explicitCountryCode = parsed.countryCode
      ? normalizeCountryInput(parsed.countryCode)
      : undefined;
    const regionCountryCode: string = explicitCountryCode ?? initiativeCountryCode;
    const preferredRegion = normalizeRegionInput(regionCountryCode, parsed.regionCode);

    if (regionCountryCode === initiativeCountryCode && preferredRegion === initiativeRegionCode) {
      return getRegionLabel(initiativeCountryCode, initiativeRegionCode) ?? initiativeRegionCode;
    }
  }

  return null;
}

function matchesPreferredCountry(
  preferences: MemberPreferences,
  initiative: Initiative,
): string | null {
  const preferredCountryIds = preferences.participationPreferences.preferredCountryIds;

  if (preferredCountryIds.length === 0) {
    return null;
  }

  const countryCode = resolveInitiativeCountryCode(initiative);

  if (!countryCode) {
    return null;
  }

  if (preferredCountryIds.some((countryId) => normalizeCountryInput(countryId) === countryCode)) {
    return getCountryLabel(countryCode) ?? countryCode;
  }

  return null;
}

export function findPreferredGeographyMatchReason(
  preferences: MemberPreferences,
  initiative: Initiative,
): string | null {
  return (
    matchesPreferredCityCommunity(preferences, initiative) ??
    matchesPreferredRegion(preferences, initiative) ??
    matchesPreferredCountry(preferences, initiative)
  );
}

export function hasPreferredGeographySelections(preferences: MemberPreferences): boolean {
  const participation = preferences.participationPreferences;

  return (
    participation.preferredCountryIds.length > 0 ||
    participation.preferredRegions.length > 0 ||
    participation.preferredCityCommunityIds.length > 0
  );
}
