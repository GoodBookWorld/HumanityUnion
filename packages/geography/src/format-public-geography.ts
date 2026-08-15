import {
  getCountryLabel,
  getRegionLabel,
  normalizeCountryInput,
  normalizeRegionInput,
} from "./geography.helpers";
import { getCommunityLabel } from "./geography.communities";

export interface PublicGeographyInput {
  countryCode?: string;
  regionCode?: string;
  communitySlug?: string;
  /** Legacy free-text region label from initiative metadata. */
  regionLabel?: string;
  /** Descriptive community association entered by steward. */
  communityAssociation?: string;
  /** Pre-resolved bootstrap community name when available. */
  knownCommunityName?: string;
  knownCommunityRegionLabel?: string;
  knownCommunityCountryLabel?: string;
  knownCommunityCountrySlug?: string;
  knownCommunityRegionSlug?: string;
}

export interface ResolvedPublicGeography {
  countryCode?: string;
  regionCode?: string;
  cityCommunity?: string;
  country?: string;
  region?: string;
  city?: string;
  label: string;
}

function resolveCountryLabel(countryCode?: string, fallback?: string): string | undefined {
  if (countryCode) {
    const normalized = normalizeCountryInput(countryCode);

    if (normalized) {
      return getCountryLabel(normalized) ?? fallback;
    }
  }

  return fallback?.trim() || undefined;
}

function resolveRegionLabel(
  countryCode: string | undefined,
  regionCode: string | undefined,
  fallback?: string,
): string | undefined {
  if (countryCode && regionCode) {
    const label = getRegionLabel(countryCode, regionCode);

    if (label) {
      return label;
    }
  }

  return fallback?.trim() || undefined;
}

function resolveCityLabel(
  input: PublicGeographyInput,
  countryCode?: string,
  regionCode?: string,
): string | undefined {
  if (input.knownCommunityName?.trim()) {
    return input.knownCommunityName.trim();
  }

  if (input.communityAssociation?.trim()) {
    return input.communityAssociation.trim();
  }

  if (countryCode && regionCode && input.communitySlug) {
    const fromDataset = getCommunityLabel(countryCode, regionCode, input.communitySlug);

    if (fromDataset) {
      return fromDataset;
    }
  }

  return undefined;
}

export function resolvePublicGeography(input: PublicGeographyInput): ResolvedPublicGeography {
  const countryCode =
    normalizeCountryInput(input.countryCode ?? input.knownCommunityCountrySlug) ?? undefined;

  const regionCode =
    countryCode && (input.regionCode || input.knownCommunityRegionSlug)
      ? normalizeRegionInput(countryCode, input.regionCode ?? input.knownCommunityRegionSlug)
      : undefined;

  const country = resolveCountryLabel(countryCode, input.knownCommunityCountryLabel);
  const region = resolveRegionLabel(
    countryCode,
    regionCode,
    input.knownCommunityRegionLabel ?? input.regionLabel,
  );
  const city = resolveCityLabel(input, countryCode, regionCode);

  return {
    countryCode,
    regionCode,
    cityCommunity: city,
    country,
    region,
    city,
    label: formatPublicGeographyLabel({ city, region, country }),
  };
}

export function formatPublicGeographyLabel(input: {
  city?: string;
  region?: string;
  country?: string;
}): string {
  const city = input.city?.trim();
  const region = input.region?.trim();
  const country = input.country?.trim();

  if (city && region && country) {
    return `${city} · ${region} · ${country}`;
  }

  if (city && country && !region) {
    return `${city} · ${country}`;
  }

  if (region && country) {
    return `${region} · ${country}`;
  }

  if (country) {
    return country;
  }

  return "World";
}

export function formatPublicGeography(input: PublicGeographyInput): string {
  return resolvePublicGeography(input).label;
}
