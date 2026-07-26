import {
  isRecognizedCountrySlug,
  isRecognizedRegionSlug,
  normalizeCountryInput,
  normalizeRegionInput,
  OTHER_REGION_SLUG,
} from "@hu/geography";

import {
  isRecognizedParticipationCommunitySlug,
  resolveParticipationCommunitySlug,
} from "./participation-area-community.loader.js";
import { ParticipationAreaValidationError } from "./participation-area.errors.js";

export interface ValidatedParticipationAreaInput {
  countrySlug: string;
  regionSlug?: string;
  communitySlug?: string;
  regionLabel?: string;
}

function readOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ParticipationAreaValidationError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

export function validateParticipationAreaInput(body: unknown): ValidatedParticipationAreaInput {
  if (!body || typeof body !== "object") {
    throw new ParticipationAreaValidationError("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const countrySlugRaw = readOptionalString(record.countrySlug, "countrySlug");
  const regionSlugRaw = readOptionalString(record.regionSlug, "regionSlug");
  const communitySlugRaw = readOptionalString(record.communitySlug, "communitySlug");
  const regionLabel =
    typeof record.regionLabel === "string" ? record.regionLabel.trim() : undefined;

  if (!countrySlugRaw) {
    throw new ParticipationAreaValidationError("countrySlug is required.");
  }

  const countrySlug = normalizeCountryInput(countrySlugRaw);

  if (!countrySlug || !isRecognizedCountrySlug(countrySlug)) {
    throw new ParticipationAreaValidationError("countrySlug is not recognized.");
  }

  const regionSlug = regionSlugRaw ? normalizeRegionInput(countrySlug, regionSlugRaw) : undefined;

  if (regionSlugRaw && (!regionSlug || !isRecognizedRegionSlug(countrySlug, regionSlug))) {
    throw new ParticipationAreaValidationError(
      "regionSlug must belong to the selected countrySlug.",
    );
  }

  if (regionSlug === OTHER_REGION_SLUG && (!regionLabel || regionLabel.length === 0)) {
    throw new ParticipationAreaValidationError(
      "regionLabel is required when regionSlug is other-not-listed.",
    );
  }

  const communitySlug = communitySlugRaw
    ? resolveParticipationCommunitySlug({
        countrySlug,
        regionSlug,
        communitySlug: communitySlugRaw,
      })
    : undefined;

  if (communitySlugRaw && !communitySlug) {
    throw new ParticipationAreaValidationError("communitySlug is not recognized.");
  }

  if (communitySlug && !regionSlug) {
    throw new ParticipationAreaValidationError(
      "regionSlug is required when communitySlug is provided.",
    );
  }

  if (
    communitySlug &&
    !isRecognizedParticipationCommunitySlug({
      countrySlug,
      regionSlug,
      communitySlug,
    })
  ) {
    throw new ParticipationAreaValidationError(
      "communitySlug requires a matching regionSlug and countrySlug.",
    );
  }

  return {
    countrySlug,
    regionSlug,
    communitySlug,
    regionLabel: regionSlug === OTHER_REGION_SLUG ? regionLabel : undefined,
  };
}
