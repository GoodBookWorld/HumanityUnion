import {
  GEOGRAPHY_COUNTRIES,
  getCountryLabel,
  getRegionLabel,
  getRegionsForCountry,
  normalizeCountryInput,
  OTHER_REGION_SLUG,
} from "@hu/geography";

import { getParticipationCommunityLabel } from "./participation-area-community.loader.js";

export interface BootstrapGeographyCountry {
  slug: string;
  label: string;
}

export interface BootstrapGeographyRegion {
  slug: string;
  label: string;
  countrySlug: string;
}

export const BOOTSTRAP_GEOGRAPHY_COUNTRIES: readonly BootstrapGeographyCountry[] =
  GEOGRAPHY_COUNTRIES.map((country) => ({
    slug: country.slug,
    label: country.label,
  }));

export const BOOTSTRAP_GEOGRAPHY_REGIONS: readonly BootstrapGeographyRegion[] =
  GEOGRAPHY_COUNTRIES.flatMap((country) =>
    getRegionsForCountry(country.slug).map((region) => ({
      slug: region.slug,
      countrySlug: country.slug,
      label: region.label,
    })),
  );

export function getBootstrapCountryLabel(countrySlug: string): string | undefined {
  return getCountryLabel(countrySlug);
}

export function getBootstrapRegionLabel(
  countrySlug: string,
  regionSlug: string,
  regionLabel?: string,
): string | undefined {
  if (regionSlug === OTHER_REGION_SLUG && regionLabel) {
    return regionLabel;
  }

  return getRegionLabel(countrySlug, regionSlug);
}

export function getBootstrapCommunityLabel(
  countrySlug: string,
  regionSlug: string | undefined,
  communitySlug: string,
): string | undefined {
  return getParticipationCommunityLabel({ countrySlug, regionSlug, communitySlug });
}

export function resolveParticipationAreaDisplayLabels(input: {
  countrySlug: string;
  regionSlug?: string;
  communitySlug?: string;
  regionLabel?: string;
}): {
  country: string;
  region?: string;
  community?: string;
} {
  return {
    country: getBootstrapCountryLabel(input.countrySlug) ?? input.countrySlug,
    region: input.regionSlug
      ? (getBootstrapRegionLabel(input.countrySlug, input.regionSlug, input.regionLabel) ??
        input.regionSlug)
      : undefined,
    community: input.communitySlug
      ? (getBootstrapCommunityLabel(input.countrySlug, input.regionSlug, input.communitySlug) ??
        input.communitySlug)
      : undefined,
  };
}

export { normalizeCountryInput as normalizeCountrySlug, OTHER_REGION_SLUG };
