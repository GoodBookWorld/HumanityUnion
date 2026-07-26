import {
  getCountryLabel,
  getRegionLabel,
  normalizeCountryInput,
  normalizeRegionInput,
} from "@hu/geography";

import { getKnownInitiativeCommunity } from "../modules/initiatives/initiative-communities.js";

export interface PublicGeographyInput {
  countryCode?: string;
  regionCode?: string;
  communitySlug?: string;
  regionLabel?: string;
  communityAssociation?: string;
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

export function resolvePublicGeography(input: PublicGeographyInput): ResolvedPublicGeography {
  const knownCommunity = input.communitySlug
    ? getKnownInitiativeCommunity(input.communitySlug)
    : undefined;

  const countryCode =
    normalizeCountryInput(input.countryCode ?? knownCommunity?.countrySlug) ?? undefined;

  const regionCode =
    countryCode && (input.regionCode || knownCommunity?.regionSlug)
      ? normalizeRegionInput(countryCode, input.regionCode ?? knownCommunity?.regionSlug)
      : undefined;

  const country =
    (countryCode ? getCountryLabel(countryCode) : undefined) ?? knownCommunity?.countryLabel;

  const region =
    (countryCode && regionCode ? getRegionLabel(countryCode, regionCode) : undefined) ??
    knownCommunity?.regionLabel ??
    input.regionLabel?.trim();

  const city = knownCommunity?.name ?? input.communityAssociation?.trim() ?? undefined;

  const label = formatPublicGeographyLabel({ city, region, country });

  return {
    countryCode,
    regionCode,
    cityCommunity: city,
    country,
    region,
    city,
    label,
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
