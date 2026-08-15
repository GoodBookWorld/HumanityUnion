import type { ParticipationPreferences } from "@hu/types";

import {
  getCountryLabel,
  getRegionByCode,
  getRegionLabel,
  normalizeCountryInput,
  normalizeRegionInput,
  OTHER_REGION_SLUG,
} from "./geography.helpers";

export function formatPreferredRegionId(countryCode: string, regionCode: string): string {
  const normalizedCountry = normalizeCountryInput(countryCode);
  const normalizedRegion = normalizeRegionInput(countryCode, regionCode);

  if (!normalizedCountry || !normalizedRegion) {
    return `${countryCode.trim().toUpperCase()}::${regionCode.trim().toUpperCase()}`;
  }

  return `${normalizedCountry}::${normalizedRegion}`;
}

export function parsePreferredRegionId(
  regionId: string,
): { countryCode: string; regionCode: string } | null {
  const trimmed = regionId.trim();

  if (!trimmed) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("::");

  if (separatorIndex === -1) {
    return { countryCode: "", regionCode: trimmed };
  }

  const countryCode = trimmed.slice(0, separatorIndex);
  const regionCode = trimmed.slice(separatorIndex + 2);

  if (!regionCode) {
    return null;
  }

  return { countryCode, regionCode };
}

export function formatPreferredCityCommunityId(
  countryCode: string,
  regionCode: string,
  communityCode: string,
): string {
  const normalizedCountry = normalizeCountryInput(countryCode);
  const normalizedRegion = normalizeRegionInput(countryCode, regionCode);
  const normalizedCommunity = communityCode.trim();

  return `${normalizedCountry ?? countryCode.trim().toUpperCase()}::${normalizedRegion ?? regionCode.trim().toUpperCase()}::${normalizedCommunity}`;
}

export function parsePreferredCityCommunityId(
  cityCommunityId: string,
): { countryCode: string; regionCode: string; communityCode: string } | null {
  const trimmed = cityCommunityId.trim();

  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split("::");

  if (parts.length < 3) {
    return null;
  }

  const countryCode = parts[0] ?? "";
  const regionCode = parts[1] ?? "";
  const communityCode = parts.slice(2).join("::");

  if (!countryCode || !regionCode || !communityCode) {
    return null;
  }

  return { countryCode, regionCode, communityCode };
}

export function normalizePreferredRegionId(
  regionId: string,
  preferredCountryIds: readonly string[],
): string | null {
  const parsed = parsePreferredRegionId(regionId);

  if (!parsed) {
    return null;
  }

  if (parsed.countryCode) {
    const normalizedCountry = normalizeCountryInput(parsed.countryCode);
    const normalizedRegion = normalizeRegionInput(parsed.countryCode, parsed.regionCode);

    if (!normalizedCountry || !normalizedRegion || normalizedRegion === OTHER_REGION_SLUG) {
      return null;
    }

    return formatPreferredRegionId(normalizedCountry, normalizedRegion);
  }

  if (preferredCountryIds.length === 1) {
    const countryCode = normalizeCountryInput(preferredCountryIds[0] ?? "");

    if (!countryCode) {
      return null;
    }

    const normalizedRegion = normalizeRegionInput(countryCode, parsed.regionCode);

    if (!normalizedRegion || normalizedRegion === OTHER_REGION_SLUG) {
      return null;
    }

    return formatPreferredRegionId(countryCode, normalizedRegion);
  }

  for (const countryId of preferredCountryIds) {
    const normalizedCountry = normalizeCountryInput(countryId);

    if (!normalizedCountry) {
      continue;
    }

    const normalizedRegion = normalizeRegionInput(normalizedCountry, parsed.regionCode);

    if (normalizedRegion && normalizedRegion !== OTHER_REGION_SLUG) {
      return formatPreferredRegionId(normalizedCountry, normalizedRegion);
    }
  }

  return parsed.regionCode === OTHER_REGION_SLUG ? null : parsed.regionCode;
}

export function regionIdMatchesSelection(
  regionId: string,
  preferredCountryIds: readonly string[],
  preferredRegions: readonly string[],
): boolean {
  const parsed = parsePreferredRegionId(regionId);

  if (!parsed) {
    return false;
  }

  const normalizedRegionId = normalizePreferredRegionId(regionId, preferredCountryIds) ?? regionId;
  const normalizedCountries = preferredCountryIds
    .map((countryId) => normalizeCountryInput(countryId))
    .filter((countryId): countryId is string => Boolean(countryId));

  if (preferredRegions.length > 0) {
    const regionMatches = preferredRegions.some((selectedRegionId) => {
      const selected = parsePreferredRegionId(selectedRegionId);

      if (!selected) {
        return false;
      }

      if (selected.countryCode) {
        return formatPreferredRegionId(selected.countryCode, selected.regionCode) === normalizedRegionId;
      }

      return selected.regionCode === parsed.regionCode;
    });

    if (!regionMatches) {
      return false;
    }
  } else if (normalizedCountries.length > 0) {
    const countryCode = parsed.countryCode
      ? normalizeCountryInput(parsed.countryCode)
      : normalizedCountries.find((countryId) =>
          Boolean(normalizeRegionInput(countryId, parsed.regionCode)),
        );

    if (!countryCode || !normalizedCountries.includes(countryCode)) {
      return false;
    }
  }

  if (parsed.countryCode) {
    const normalizedCountry = normalizeCountryInput(parsed.countryCode);
    const normalizedRegion = normalizeRegionInput(parsed.countryCode, parsed.regionCode);
    return Boolean(normalizedCountry && normalizedRegion && normalizedRegion !== OTHER_REGION_SLUG);
  }

  if (normalizedCountries.length === 1) {
    const normalizedRegion = normalizeRegionInput(normalizedCountries[0] ?? "", parsed.regionCode);
    return Boolean(normalizedRegion && normalizedRegion !== OTHER_REGION_SLUG);
  }

  return Boolean(getRegionByCode(normalizedCountries[0] ?? "", parsed.regionCode));
}

export function cityCommunityIdMatchesSelection(
  cityCommunityId: string,
  preferredCountryIds: readonly string[],
  preferredRegions: readonly string[],
): boolean {
  const parsed = parsePreferredCityCommunityId(cityCommunityId);

  if (!parsed) {
    return false;
  }

  const normalizedCountry = normalizeCountryInput(parsed.countryCode);
  const normalizedRegion = normalizeRegionInput(parsed.countryCode, parsed.regionCode);

  if (!normalizedCountry || !normalizedRegion || normalizedRegion === OTHER_REGION_SLUG) {
    return false;
  }

  const normalizedCountries = preferredCountryIds
    .map((countryId) => normalizeCountryInput(countryId))
    .filter((countryId): countryId is string => Boolean(countryId));

  if (
    normalizedCountries.length > 0 &&
    !normalizedCountries.includes(normalizedCountry)
  ) {
    return false;
  }

  if (preferredRegions.length > 0) {
    const regionId = formatPreferredRegionId(normalizedCountry, normalizedRegion);
    const legacyRegionId = normalizedRegion;

    return preferredRegions.some((selectedRegionId) => {
      const selected = parsePreferredRegionId(selectedRegionId);

      if (!selected) {
        return false;
      }

      if (selected.countryCode) {
        return formatPreferredRegionId(selected.countryCode, selected.regionCode) === regionId;
      }

      return selected.regionCode === legacyRegionId;
    });
  }

  return normalizedCountries.length > 0;
}

export function buildPreferredCityCommunityLabel(input: {
  countryCode: string;
  regionCode: string;
  communityName: string;
  ambiguousCommunityNames?: ReadonlySet<string>;
}): string {
  const regionLabel = getRegionLabel(input.countryCode, input.regionCode);
  const countryLabel = getCountryLabel(input.countryCode);
  const normalizedName = input.communityName.trim().toLowerCase();
  const isAmbiguous = input.ambiguousCommunityNames?.has(normalizedName) ?? false;

  if (isAmbiguous && regionLabel && countryLabel) {
    return `${input.communityName}, ${regionLabel}, ${countryLabel}`;
  }

  return input.communityName;
}

export function buildPreferredRegionLabel(regionId: string): string {
  const parsed = parsePreferredRegionId(regionId);

  if (!parsed) {
    return regionId;
  }

  if (parsed.countryCode) {
    const regionLabel = getRegionLabel(parsed.countryCode, parsed.regionCode);
    const countryLabel = getCountryLabel(parsed.countryCode);

    if (regionLabel && countryLabel) {
      return `${regionLabel}, ${countryLabel}`;
    }

    return regionLabel ?? parsed.regionCode;
  }

  return getRegionLabel("", parsed.regionCode) ?? parsed.regionCode;
}

export interface SanitizedParticipationGeography {
  participationPreferences: ParticipationPreferences;
  removedCityCount: number;
  removedRegionCount: number;
}

export function sanitizeParticipationGeography(
  participationPreferences: ParticipationPreferences,
): SanitizedParticipationGeography {
  const preferredCountryIds = [
    ...new Set(
      participationPreferences.preferredCountryIds
        .map((countryId) => normalizeCountryInput(countryId))
        .filter((countryId): countryId is string => Boolean(countryId)),
    ),
  ];

  const normalizedRegions = participationPreferences.preferredRegions
    .map((regionId) => normalizePreferredRegionId(regionId, preferredCountryIds))
    .filter((regionId): regionId is string => Boolean(regionId));

  const preferredRegions = [...new Set(normalizedRegions)];

  const preferredCityCommunityIds = participationPreferences.preferredCityCommunityIds.filter(
    (cityCommunityId) =>
      cityCommunityIdMatchesSelection(cityCommunityId, preferredCountryIds, preferredRegions),
  );

  const removedRegionCount = Math.max(
    0,
    participationPreferences.preferredRegions.length - preferredRegions.length,
  );
  const removedCityCount = Math.max(
    0,
    participationPreferences.preferredCityCommunityIds.length - preferredCityCommunityIds.length,
  );

  return {
    participationPreferences: {
      ...participationPreferences,
      preferredCountryIds,
      preferredRegions,
      preferredCityCommunityIds,
    },
    removedCityCount,
    removedRegionCount,
  };
}

export function normalizeParticipationGeographyLegacy(
  participationPreferences: ParticipationPreferences,
): ParticipationPreferences {
  return sanitizeParticipationGeography(participationPreferences).participationPreferences;
}
