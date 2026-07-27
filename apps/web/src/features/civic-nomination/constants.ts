import type {
  CivicNominationEvidenceType,
  CivicNominationExpertiseArea,
  CivicNominationInstitutionRole,
} from "@hu/types";

export const CIVIC_NOMINATION_MAX_TEXT_LENGTH = 1500;

export const NOMINATABLE_INSTITUTION_ROLES: readonly CivicNominationInstitutionRole[] = [
  "humanity_council",
  "chamber_of_intellectual_analysis",
  "expert_analysis_team",
  "state_collaboration_department",
];

export const NOMINATION_EXPERTISE_AREAS: readonly CivicNominationExpertiseArea[] = [
  "environment",
  "technology",
  "security",
  "medicine",
  "education",
  "economics",
  "law",
  "human_rights",
  "public_administration",
  "emergency_response",
  "agriculture",
  "energy",
  "information_integrity",
  "international_cooperation",
  "other",
];

export const NOMINATION_EVIDENCE_TYPES: readonly CivicNominationEvidenceType[] = [
  "research",
  "project",
  "publication",
  "official_role",
  "ngo_work",
  "public_service",
  "technology",
  "media_reference",
  "other",
];

export const COUNTRY_REQUIRED_ROLES: readonly CivicNominationInstitutionRole[] = [
  "humanity_council",
  "state_collaboration_department",
];

export const INSTITUTION_ROLE_LABELS: Record<CivicNominationInstitutionRole, string> = {
  humanity_council: "Humanity Council",
  chamber_of_intellectual_analysis: "Chamber of Intellectual Analysis",
  expert_analysis_team: "Expert Analysis Team",
  state_collaboration_department: "State Collaboration Department",
};

export const EXPERTISE_AREA_LABELS: Record<CivicNominationExpertiseArea, string> = {
  environment: "Environment",
  technology: "Technology",
  security: "Security",
  medicine: "Medicine",
  education: "Education",
  economics: "Economics",
  law: "Law",
  human_rights: "Human Rights",
  public_administration: "Public Administration",
  emergency_response: "Emergency Response",
  agriculture: "Agriculture",
  energy: "Energy",
  information_integrity: "Information Integrity",
  international_cooperation: "International Cooperation",
  other: "Other",
};

export const EVIDENCE_TYPE_LABELS: Record<CivicNominationEvidenceType, string> = {
  research: "Research",
  project: "Project",
  publication: "Publication",
  official_role: "Official Role",
  ngo_work: "NGO Work",
  public_service: "Public Service",
  technology: "Technology",
  media_reference: "Media Reference",
  other: "Other",
};

export function civicNominationFormPath(role?: CivicNominationInstitutionRole): string {
  if (!role) {
    return "/institutions/nominations/new";
  }

  return `/institutions/nominations/new?role=${encodeURIComponent(role)}`;
}

export function civicNominationPosterPath(nominationId: string): string {
  return `/institutions/nominations/${encodeURIComponent(nominationId)}`;
}

export function formatCountrySlug(slug: string | undefined): string {
  if (!slug) {
    return "Not specified";
  }

  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isValidInstitutionRole(
  value: string | null,
): value is CivicNominationInstitutionRole {
  return NOMINATABLE_INSTITUTION_ROLES.includes(value as CivicNominationInstitutionRole);
}
