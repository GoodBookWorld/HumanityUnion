import type {
  CivicNominationConflictOfInterest,
  CivicNominationDeclarations,
  CivicNominationEvidenceLink,
  CivicNominationExpertiseArea,
  CivicNominationInstitutionRole,
} from "@hu/types";

import { CIVIC_NOMINATION_MAX_TEXT_LENGTH, COUNTRY_REQUIRED_ROLES } from "./constants";

export interface CivicNominationFormState {
  nominationType: "self" | "other_person";
  nomineeName: string;
  institutionRole: CivicNominationInstitutionRole;
  countryCode: string;
  countryLabel: string;
  regionCode: string;
  regionLabel: string;
  communityCode: string;
  communityLabel: string;
  expertiseAreas: CivicNominationExpertiseArea[];
  experienceSummary: string;
  confirmedAchievements: string;
  evidenceLinks: CivicNominationEvidenceLink[];
  visionStatement: string;
  conflictStatus: "none_known" | "disclosed";
  conflictSummary: string;
  declarations: CivicNominationDeclarations;
}

export type CivicNominationFormErrors = Partial<
  Record<keyof CivicNominationFormState | "form", string>
>;

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function validateText(value: string, label: string): string | undefined {
  if (!isNonEmpty(value)) {
    return `${label} is required.`;
  }

  if (value.trim().length > CIVIC_NOMINATION_MAX_TEXT_LENGTH) {
    return `${label} must be ${CIVIC_NOMINATION_MAX_TEXT_LENGTH} characters or fewer.`;
  }

  return undefined;
}

function validateUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Evidence URL must use http or https.";
    }
  } catch {
    return "Evidence URL must be valid.";
  }

  return undefined;
}

export function validateCivicNominationForm(
  state: CivicNominationFormState,
): CivicNominationFormErrors {
  const errors: CivicNominationFormErrors = {};

  if (!isNonEmpty(state.nomineeName)) {
    errors.nomineeName = "Nominee name is required.";
  }

  if (state.expertiseAreas.length === 0) {
    errors.expertiseAreas = "Select at least one expertise area.";
  }

  const experienceError = validateText(state.experienceSummary, "Experience summary");
  if (experienceError) {
    errors.experienceSummary = experienceError;
  }

  const achievementsError = validateText(state.confirmedAchievements, "Confirmed achievements");
  if (achievementsError) {
    errors.confirmedAchievements = achievementsError;
  }

  const visionError = validateText(state.visionStatement, "Vision statement");
  if (visionError) {
    errors.visionStatement = visionError;
  }

  if (COUNTRY_REQUIRED_ROLES.includes(state.institutionRole) && !isNonEmpty(state.countryCode)) {
    errors.countryCode = "Country is required for this institution role.";
  }

  if (state.conflictStatus === "disclosed" && !isNonEmpty(state.conflictSummary)) {
    errors.conflictSummary = "Provide a brief conflict of interest explanation.";
  }

  for (const link of state.evidenceLinks) {
    if (!isNonEmpty(link.title) || !isNonEmpty(link.url)) {
      errors.evidenceLinks = "Each evidence link requires a title and URL.";
      break;
    }

    const urlError = validateUrl(link.url.trim());
    if (urlError) {
      errors.evidenceLinks = urlError;
      break;
    }
  }

  if (
    !state.declarations.supportsUdhr ||
    !state.declarations.supportsHumanityUnionPrinciples ||
    !state.declarations.understandsNoAutomaticAppointment ||
    !state.declarations.confirmsAccuracy
  ) {
    errors.declarations = "All declarations must be accepted before submitting.";
  }

  return errors;
}

export function toCivicNominationPayload(state: CivicNominationFormState) {
  const conflictOfInterest: CivicNominationConflictOfInterest =
    state.conflictStatus === "disclosed"
      ? { status: "disclosed", summary: state.conflictSummary.trim() }
      : { status: "none_known" };

  return {
    institutionRole: state.institutionRole,
    nominationType: state.nominationType,
    nomineeName: state.nomineeName.trim(),
    countrySlug: state.countryCode.trim() || undefined,
    regionSlug: state.regionCode.trim() || undefined,
    communitySlug: state.communityCode.trim() || undefined,
    expertiseAreas: state.expertiseAreas,
    experienceSummary: state.experienceSummary.trim(),
    confirmedAchievements: state.confirmedAchievements.trim(),
    evidenceLinks: state.evidenceLinks
      .filter((link) => link.title.trim() || link.url.trim())
      .map((link) => ({
        title: link.title.trim(),
        url: link.url.trim(),
        evidenceType: link.evidenceType,
        summary: link.summary?.trim() || undefined,
      })),
    visionStatement: state.visionStatement.trim(),
    conflictOfInterest,
    declarations: state.declarations,
  };
}

export function createEmptyEvidenceLink(): CivicNominationEvidenceLink {
  return {
    title: "",
    url: "",
    evidenceType: "research",
    summary: "",
  };
}

export function createInitialFormState(
  role: CivicNominationInstitutionRole,
): CivicNominationFormState {
  return {
    nominationType: "self",
    nomineeName: "",
    institutionRole: role,
    countryCode: "",
    countryLabel: "",
    regionCode: "",
    regionLabel: "",
    communityCode: "",
    communityLabel: "",
    expertiseAreas: [],
    experienceSummary: "",
    confirmedAchievements: "",
    evidenceLinks: [],
    visionStatement: "",
    conflictStatus: "none_known",
    conflictSummary: "",
    declarations: {
      supportsUdhr: false,
      supportsHumanityUnionPrinciples: false,
      understandsNoAutomaticAppointment: false,
      confirmsAccuracy: false,
    },
  };
}
