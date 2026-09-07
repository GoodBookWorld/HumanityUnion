/**
 * RESET 05 — country Initiative rail geography + activity ownership helpers.
 * Geography uses locale-aware @hu/geography — never machine-translates English labels.
 */

import { formatPublicGeography } from "@hu/geography";
import {
  isKnownInitiativeActivityArea,
  type WorldInitiativeCardProjection,
} from "@hu/types";

import {
  ACTIVITY_AREA_MESSAGE_KEY_BY_VALUE,
  resolveActivityAreaDisplayLabel,
  type InitiativeExperienceTranslator,
} from "../public-initiative-experience/initiative-experience-i18n";

export type CountryInitiativeRailMetaView = {
  readonly activityAreaLabel: string;
  readonly activityAreaOwner: "UI_DICTIONARY" | "PROTECTED_CANONICAL";
  readonly activityAreaResult: "LOCALIZED_DICTIONARY" | "PROTECTED_CANONICAL";
  readonly activityAreaMessageKey: string | undefined;
  readonly geographyLabel: string;
  readonly geographyOwner: "GEOGRAPHY";
  readonly geographyResult: "LOCALIZED_DICTIONARY" | "PROTECTED_CANONICAL";
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

  const geographyLabel =
    formatPublicGeography({
      countryCode: initiative.countryCode,
      regionCode: initiative.regionCode,
      communitySlug: initiative.communitySlug,
      locale,
    }) || initiative.geographyLabel;

  const geographyLocalized =
    locale.toLowerCase() !== "en" &&
    geographyLabel.trim() !== "" &&
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
  };
}
