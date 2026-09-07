/**
 * RESET 05 / 05A — country Initiative rail geography + activity ownership helpers.
 * Geography uses locale-aware @hu/geography — never machine-translates English labels.
 * "World" is a missing-specificity fallback, not a successful geography resolve.
 */

import {
  isKnownInitiativeActivityArea,
  type WorldInitiativeCardProjection,
} from "@hu/types";

import {
  ACTIVITY_AREA_MESSAGE_KEY_BY_VALUE,
  resolveActivityAreaDisplayLabel,
  type InitiativeExperienceTranslator,
} from "../public-initiative-experience/initiative-experience-i18n";
import {
  formatInitiativePublicGeography,
  isPublicGeographyWorldFallback,
} from "../public-initiative-experience/format-initiative-public-geography";

export type CountryInitiativeRailMetaView = {
  readonly activityAreaLabel: string;
  readonly activityAreaOwner: "UI_DICTIONARY" | "PROTECTED_CANONICAL";
  readonly activityAreaResult: "LOCALIZED_DICTIONARY" | "PROTECTED_CANONICAL";
  readonly activityAreaMessageKey: string | undefined;
  readonly geographyLabel: string;
  readonly geographyOwner: "GEOGRAPHY";
  readonly geographyResult: "LOCALIZED_DICTIONARY" | "PROTECTED_CANONICAL";
  /** True when more-specific codes existed but resolve collapsed to World. */
  readonly geographyCollapsedToWorld: boolean;
};

/**
 * Resolve participant-facing meta for country Initiative/election rails.
 */
export function resolveCountryInitiativeRailMeta(input: {
  readonly initiative: WorldInitiativeCardProjection;
  readonly locale: string;
  readonly tExperience: InitiativeExperienceTranslator;
}): CountryInitiativeRailMetaView {
  const { initiative, locale, tExperience } = input;
  const activityAreaLabel = resolveActivityAreaDisplayLabel(
    initiative.activityArea,
    tExperience,
  );
  let activityAreaMessageKey: string | undefined;
  let activityAreaOwner: CountryInitiativeRailMetaView["activityAreaOwner"] =
    "PROTECTED_CANONICAL";
  let activityAreaResult: CountryInitiativeRailMetaView["activityAreaResult"] =
    "PROTECTED_CANONICAL";
  if (isKnownInitiativeActivityArea(initiative.activityArea)) {
    activityAreaMessageKey = `initiativeExperience.activityAreas.${ACTIVITY_AREA_MESSAGE_KEY_BY_VALUE[initiative.activityArea]}`;
    activityAreaOwner = "UI_DICTIONARY";
    activityAreaResult = "LOCALIZED_DICTIONARY";
  }

  const hasSpecificCodes = Boolean(
    initiative.countryCode?.trim() ||
      initiative.regionCode?.trim() ||
      initiative.communitySlug?.trim(),
  );

  const fromCodes = formatInitiativePublicGeography({
    countryCode: initiative.countryCode,
    regionCode: initiative.regionCode,
    communitySlug: initiative.communitySlug,
    locale,
    lifecycleProfile: initiative.lifecycleProfile,
  });

  // Never treat sentinel "World" as a successful resolve that blocks projection fallback.
  let geographyLabel = fromCodes;
  if (isPublicGeographyWorldFallback(fromCodes)) {
    const projected = initiative.geographyLabel?.trim();
    if (projected && !isPublicGeographyWorldFallback(projected)) {
      geographyLabel = projected;
    }
  }

  const geographyCollapsedToWorld =
    hasSpecificCodes && isPublicGeographyWorldFallback(geographyLabel);

  const geographyLocalized =
    locale.toLowerCase() !== "en" &&
    !isPublicGeographyWorldFallback(geographyLabel) &&
    geographyLabel !== initiative.geographyLabel;

  return {
    activityAreaLabel,
    activityAreaOwner,
    activityAreaResult,
    activityAreaMessageKey,
    geographyLabel,
    geographyOwner: "GEOGRAPHY",
    geographyResult: geographyLocalized
      ? "LOCALIZED_DICTIONARY"
      : "PROTECTED_CANONICAL",
    geographyCollapsedToWorld,
  };
}
