import {
  isRecognizedCountrySlug,
  isRecognizedRegionSlug,
  normalizeCountryInput,
  normalizeRegionInput,
  OTHER_COMMUNITY_SLUG,
  OTHER_REGION_SLUG,
} from "@hu/geography";

import {
  isRecognizedParticipationCommunitySlug,
  resolveParticipationCommunitySlug,
} from "../participation-area/participation-area-community.loader.js";

/**
 * Pack 09F1 — server-side geography parent/child integrity for structured writes.
 * Does not reject legacy free-text values that predate canonical IDs.
 */
export function assertOptionalStructuredGeography(
  input: {
    countrySlug?: string;
    regionSlug?: string;
    communitySlug?: string;
  },
  options: { strictParents?: boolean } = {},
): void {
  const { strictParents = false } = options;
  const rawCountry = input.countrySlug?.trim();
  const rawRegion = input.regionSlug?.trim();
  const rawCommunity = input.communitySlug?.trim();

  if (!rawCountry && !rawRegion && !rawCommunity) {
    return;
  }

  const countrySlug = rawCountry ? normalizeCountryInput(rawCountry) : undefined;

  if (rawCountry) {
    if (!countrySlug) {
      // Legacy free-text country name — do not reject.
      return;
    }

    if (!isRecognizedCountrySlug(countrySlug)) {
      throw new Error("countrySlug is not a recognized country code.");
    }
  }

  if (rawRegion && countrySlug) {
    const regionSlug = normalizeRegionInput(countrySlug, rawRegion);

    if (!regionSlug || !isRecognizedRegionSlug(countrySlug, regionSlug)) {
      if (/^[A-Za-z]{2}-[A-Za-z0-9]+$/.test(rawRegion) || rawRegion === OTHER_REGION_SLUG) {
        throw new Error("regionSlug must belong to the selected countrySlug.");
      }
    } else if (rawCommunity && regionSlug !== OTHER_REGION_SLUG) {
      assertCommunityBelongsToRegion({
        countrySlug,
        regionSlug,
        communitySlug: rawCommunity,
      });
    }
  }

  if (strictParents && rawCommunity && countrySlug && !rawRegion) {
    throw new Error("regionSlug is required when communitySlug is provided.");
  }
}

function assertCommunityBelongsToRegion(input: {
  countrySlug: string;
  regionSlug: string;
  communitySlug: string;
}): void {
  const { communitySlug } = input;

  if (communitySlug === OTHER_COMMUNITY_SLUG || communitySlug.toLowerCase() === "other-not-listed") {
    return;
  }

  if (!/^\d+$/.test(communitySlug)) {
    return;
  }

  const resolved = resolveParticipationCommunitySlug(input);

  if (
    !resolved ||
    !isRecognizedParticipationCommunitySlug({
      ...input,
      communitySlug: resolved,
    })
  ) {
    throw new Error("communitySlug must belong to the selected regionSlug and countrySlug.");
  }
}
