import type {
  CivicNomination,
  CivicNominationConflictOfInterest,
  CivicNominationDeclarations,
  CivicNominationEvidenceLink,
  CivicNominationExpertiseArea,
  CivicNominationInstitutionRole,
  CivicNominationType,
} from "@hu/types";
import {
  CIVIC_NOMINATION_COUNTRY_REQUIRED_ROLES,
  CIVIC_NOMINATION_EVIDENCE_TYPES,
  CIVIC_NOMINATION_EXPERTISE_AREAS,
  CIVIC_NOMINATION_INSTITUTION_ROLES,
} from "@hu/types";

const FORBIDDEN_PERSONAL_TRAIT_FIELDS = [
  "age",
  "gender",
  "religion",
  "ethnicity",
  "maritalStatus",
  "politicalAffiliation",
  "address",
  "phoneNumber",
  "phone",
  "dateOfBirth",
  "sex",
  "race",
  "familyStatus",
] as const;

const MAX_TEXT_LENGTH = 1500;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertNoForbiddenPersonalTraitFields(input: Record<string, unknown>): void {
  for (const field of FORBIDDEN_PERSONAL_TRAIT_FIELDS) {
    if (field in input) {
      throw new Error(`Personal trait field "${field}" is not allowed on civic nominations.`);
    }
  }
}

function assertValidUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Evidence URL must use http or https.");
    }
  } catch {
    throw new Error("Evidence URL must be valid.");
  }
}

function validateEvidenceLinks(links: CivicNominationEvidenceLink[]): void {
  if (!Array.isArray(links)) {
    throw new Error("Evidence links must be an array.");
  }

  for (const link of links) {
    if (!isNonEmptyString(link.title)) {
      throw new Error("Evidence link title is required.");
    }

    if (!isNonEmptyString(link.url)) {
      throw new Error("Evidence link URL is required.");
    }

    assertValidUrl(link.url.trim());

    if (!CIVIC_NOMINATION_EVIDENCE_TYPES.includes(link.evidenceType)) {
      throw new Error("Evidence link type is invalid.");
    }
  }
}

function validateExpertiseAreas(areas: CivicNominationExpertiseArea[]): void {
  if (!Array.isArray(areas) || areas.length === 0) {
    throw new Error("At least one expertise area is required.");
  }

  for (const area of areas) {
    if (!CIVIC_NOMINATION_EXPERTISE_AREAS.includes(area)) {
      throw new Error(`Invalid expertise area: ${area}`);
    }
  }
}

function validateTextField(value: string, fieldName: string): void {
  if (!isNonEmptyString(value)) {
    throw new Error(`${fieldName} is required.`);
  }

  if (value.trim().length > MAX_TEXT_LENGTH) {
    throw new Error(`${fieldName} must be ${MAX_TEXT_LENGTH} characters or fewer.`);
  }
}

function validateDeclarations(declarations: CivicNominationDeclarations): void {
  if (
    !declarations.supportsUdhr ||
    !declarations.supportsHumanityUnionPrinciples ||
    !declarations.understandsNoAutomaticAppointment ||
    !declarations.confirmsAccuracy
  ) {
    throw new Error("All civic nomination declarations must be accepted.");
  }
}

function validateConflictOfInterest(conflict: CivicNominationConflictOfInterest): void {
  if (conflict.status !== "none_known" && conflict.status !== "disclosed") {
    throw new Error("Conflict of interest status is invalid.");
  }

  if (conflict.status === "disclosed" && !isNonEmptyString(conflict.summary)) {
    throw new Error("Conflict of interest summary is required when a conflict is disclosed.");
  }
}

function validateInstitutionRole(role: CivicNominationInstitutionRole): void {
  if (!CIVIC_NOMINATION_INSTITUTION_ROLES.includes(role)) {
    throw new Error("Institution role is not eligible for civic nomination.");
  }
}

function validateCountryRequirement(
  role: CivicNominationInstitutionRole,
  countrySlug?: string,
): void {
  if (CIVIC_NOMINATION_COUNTRY_REQUIRED_ROLES.includes(role) && !isNonEmptyString(countrySlug)) {
    throw new Error("Country is required for this institution role.");
  }
}

export interface CivicNominationDraftInput {
  institutionRole: CivicNominationInstitutionRole;
  nominationType: CivicNominationType;
  nomineeName: string;
  nomineeProfileId?: string;
  countrySlug?: string;
  regionSlug?: string;
  communitySlug?: string;
  expertiseAreas: CivicNominationExpertiseArea[];
  experienceSummary: string;
  confirmedAchievements: string;
  evidenceLinks: CivicNominationEvidenceLink[];
  visionStatement: string;
  conflictOfInterest: CivicNominationConflictOfInterest;
  declarations: CivicNominationDeclarations;
}

export type CivicNominationUpdateInput = Partial<
  Omit<
    CivicNominationDraftInput,
    "institutionRole" | "nominationType" | "declarations" | "conflictOfInterest"
  >
> & {
  conflictOfInterest?: CivicNominationConflictOfInterest;
  declarations?: CivicNominationDeclarations;
};

export function validateCivicNominationDraftInput(
  input: Record<string, unknown>,
): CivicNominationDraftInput {
  assertNoForbiddenPersonalTraitFields(input);

  const institutionRole = input.institutionRole;
  const nominationType = input.nominationType;

  if (
    institutionRole !== "humanity_council" &&
    institutionRole !== "chamber_of_intellectual_analysis" &&
    institutionRole !== "expert_analysis_team" &&
    institutionRole !== "state_collaboration_department"
  ) {
    throw new Error("Institution role is not eligible for civic nomination.");
  }

  if (nominationType !== "self" && nominationType !== "other_person") {
    throw new Error("Nomination type must be self or other_person.");
  }

  validateInstitutionRole(institutionRole);

  if (!isNonEmptyString(input.nomineeName)) {
    throw new Error("Nominee name is required.");
  }

  validateExpertiseAreas(input.expertiseAreas as CivicNominationExpertiseArea[]);
  validateTextField(String(input.experienceSummary), "Experience summary");
  validateTextField(String(input.confirmedAchievements), "Confirmed achievements");
  validateTextField(String(input.visionStatement), "Vision statement");
  validateEvidenceLinks(input.evidenceLinks as CivicNominationEvidenceLink[]);
  validateConflictOfInterest(input.conflictOfInterest as CivicNominationConflictOfInterest);
  validateDeclarations(input.declarations as CivicNominationDeclarations);
  validateCountryRequirement(institutionRole, input.countrySlug as string | undefined);

  return {
    institutionRole,
    nominationType,
    nomineeName: String(input.nomineeName).trim(),
    nomineeProfileId:
      typeof input.nomineeProfileId === "string" ? input.nomineeProfileId.trim() : undefined,
    countrySlug: typeof input.countrySlug === "string" ? input.countrySlug.trim() : undefined,
    regionSlug: typeof input.regionSlug === "string" ? input.regionSlug.trim() : undefined,
    communitySlug: typeof input.communitySlug === "string" ? input.communitySlug.trim() : undefined,
    expertiseAreas: input.expertiseAreas as CivicNominationExpertiseArea[],
    experienceSummary: String(input.experienceSummary).trim(),
    confirmedAchievements: String(input.confirmedAchievements).trim(),
    evidenceLinks: input.evidenceLinks as CivicNominationEvidenceLink[],
    visionStatement: String(input.visionStatement).trim(),
    conflictOfInterest: input.conflictOfInterest as CivicNominationConflictOfInterest,
    declarations: input.declarations as CivicNominationDeclarations,
  };
}

export function validateCivicNominationUpdateInput(
  input: Record<string, unknown>,
): CivicNominationUpdateInput {
  assertNoForbiddenPersonalTraitFields(input);

  const update: CivicNominationUpdateInput = {};

  if ("nomineeName" in input) {
    if (!isNonEmptyString(input.nomineeName)) {
      throw new Error("Nominee name is required.");
    }

    update.nomineeName = String(input.nomineeName).trim();
  }

  if ("nomineeProfileId" in input) {
    update.nomineeProfileId =
      typeof input.nomineeProfileId === "string" ? input.nomineeProfileId.trim() : undefined;
  }

  if ("countrySlug" in input) {
    update.countrySlug =
      typeof input.countrySlug === "string" ? input.countrySlug.trim() : undefined;
  }

  if ("regionSlug" in input) {
    update.regionSlug = typeof input.regionSlug === "string" ? input.regionSlug.trim() : undefined;
  }

  if ("communitySlug" in input) {
    update.communitySlug =
      typeof input.communitySlug === "string" ? input.communitySlug.trim() : undefined;
  }

  if ("expertiseAreas" in input) {
    validateExpertiseAreas(input.expertiseAreas as CivicNominationExpertiseArea[]);
    update.expertiseAreas = input.expertiseAreas as CivicNominationExpertiseArea[];
  }

  if ("experienceSummary" in input) {
    validateTextField(String(input.experienceSummary), "Experience summary");
    update.experienceSummary = String(input.experienceSummary).trim();
  }

  if ("confirmedAchievements" in input) {
    validateTextField(String(input.confirmedAchievements), "Confirmed achievements");
    update.confirmedAchievements = String(input.confirmedAchievements).trim();
  }

  if ("evidenceLinks" in input) {
    validateEvidenceLinks(input.evidenceLinks as CivicNominationEvidenceLink[]);
    update.evidenceLinks = input.evidenceLinks as CivicNominationEvidenceLink[];
  }

  if ("visionStatement" in input) {
    validateTextField(String(input.visionStatement), "Vision statement");
    update.visionStatement = String(input.visionStatement).trim();
  }

  if ("conflictOfInterest" in input) {
    validateConflictOfInterest(input.conflictOfInterest as CivicNominationConflictOfInterest);
    update.conflictOfInterest = input.conflictOfInterest as CivicNominationConflictOfInterest;
  }

  if ("declarations" in input) {
    validateDeclarations(input.declarations as CivicNominationDeclarations);
    update.declarations = input.declarations as CivicNominationDeclarations;
  }

  return update;
}

export function validateCivicNominationForSubmission(nomination: CivicNomination): void {
  validateInstitutionRole(nomination.institutionRole);
  validateExpertiseAreas(nomination.expertiseAreas);
  validateTextField(nomination.experienceSummary, "Experience summary");
  validateTextField(nomination.confirmedAchievements, "Confirmed achievements");
  validateTextField(nomination.visionStatement, "Vision statement");
  validateEvidenceLinks(nomination.evidenceLinks);
  validateConflictOfInterest(nomination.conflictOfInterest);
  validateDeclarations(nomination.declarations);
  validateCountryRequirement(nomination.institutionRole, nomination.countrySlug);

  if (!isNonEmptyString(nomination.nomineeName)) {
    throw new Error("Nominee name is required.");
  }
}

export function assertPublicCivicNominationProjectionIsSafe(
  projection: Record<string, unknown>,
): void {
  const forbidden = [
    "nominatedByUserId",
    "userId",
    "email",
    "passwordHash",
    "sessionId",
    "refreshToken",
    "memberNumber",
  ];

  for (const field of forbidden) {
    if (field in projection) {
      throw new Error(`Public civic nomination projection must not expose ${field}.`);
    }
  }
}
