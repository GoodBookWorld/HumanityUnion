import {
  getRegionLabel,
  normalizeCountryInput,
  normalizeRegionInput,
  OTHER_REGION_SLUG,
} from "@hu/geography";
import type { Initiative } from "@hu/types";

import { resolveActiveParticipationArea } from "../participation-area/participation-area.store.js";

export interface InitiativeSearchGeography {
  country: string;
  region: string;
  community: string;
}

export function resolveInitiativeSearchGeography(
  initiative: Initiative | null | undefined,
): InitiativeSearchGeography {
  if (!initiative) {
    return { country: "", region: "", community: "" };
  }

  const metadata = initiative.metadata;

  return {
    country: metadata.countrySlug ? (normalizeCountryInput(metadata.countrySlug) ?? "") : "",
    region: metadata.regionSlug
      ? (normalizeRegionInput(metadata.countrySlug ?? "", metadata.regionSlug) ??
        metadata.regionSlug.trim().toUpperCase())
      : "",
    community: (metadata.communitySlug ?? "").trim().toLowerCase(),
  };
}

export function enrichInitiativeMetadataGeography(
  initiative: Initiative,
  participantId: string,
): Initiative["metadata"] {
  const activeArea = resolveActiveParticipationArea(participantId, new Date().toISOString());
  const metadata = initiative.metadata;

  const countryCode = metadata.countrySlug
    ? normalizeCountryInput(metadata.countrySlug)
    : activeArea
      ? normalizeCountryInput(activeArea.countrySlug)
      : undefined;

  const regionCode = metadata.regionSlug
    ? normalizeRegionInput(countryCode ?? activeArea?.countrySlug ?? "", metadata.regionSlug)
    : activeArea?.regionSlug
      ? normalizeRegionInput(activeArea.countrySlug, activeArea.regionSlug)
      : undefined;

  const communitySlug = metadata.communitySlug || activeArea?.communitySlug || "";

  const regionLabel =
    regionCode && countryCode
      ? regionCode === OTHER_REGION_SLUG
        ? (activeArea?.regionLabel ?? metadata.region)
        : (getRegionLabel(countryCode, regionCode) ?? metadata.region)
      : metadata.region;

  return {
    ...metadata,
    countrySlug: countryCode ?? metadata.countrySlug,
    regionSlug: regionCode ?? metadata.regionSlug,
    communitySlug,
    region: regionLabel,
  };
}
