export type CivicNominationId = string;

export type CivicNominationInstitutionRole =
  | "humanity_council"
  | "chamber_of_intellectual_analysis"
  | "expert_analysis_team"
  | "state_collaboration_department";

export type CivicNominationType = "self" | "other_person";

export type CivicNominationStatus = "draft" | "submitted" | "published" | "withdrawn" | "archived";

export type CivicNominationEvidenceType =
  | "research"
  | "project"
  | "publication"
  | "official_role"
  | "ngo_work"
  | "public_service"
  | "technology"
  | "media_reference"
  | "other";

export type CivicNominationConflictOfInterestStatus = "none_known" | "disclosed";

export type CivicNominationExpertiseArea =
  | "environment"
  | "technology"
  | "security"
  | "medicine"
  | "education"
  | "economics"
  | "law"
  | "human_rights"
  | "public_administration"
  | "emergency_response"
  | "agriculture"
  | "energy"
  | "information_integrity"
  | "international_cooperation"
  | "other";

export const CIVIC_NOMINATION_INSTITUTION_ROLES: readonly CivicNominationInstitutionRole[] = [
  "humanity_council",
  "chamber_of_intellectual_analysis",
  "expert_analysis_team",
  "state_collaboration_department",
];

export const CIVIC_NOMINATION_EXPERTISE_AREAS: readonly CivicNominationExpertiseArea[] = [
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

export const CIVIC_NOMINATION_EVIDENCE_TYPES: readonly CivicNominationEvidenceType[] = [
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

export const CIVIC_NOMINATION_TRANSITIONS: Record<
  CivicNominationStatus,
  readonly CivicNominationStatus[]
> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["published", "withdrawn"],
  published: ["archived"],
  withdrawn: [],
  archived: [],
};

export function canTransitionCivicNomination(
  from: CivicNominationStatus,
  to: CivicNominationStatus,
): boolean {
  return CIVIC_NOMINATION_TRANSITIONS[from].includes(to);
}

export function isCivicNominationTerminal(status: CivicNominationStatus): boolean {
  return status === "withdrawn" || status === "archived";
}

export interface CivicNominationEvidenceLink {
  title: string;
  url: string;
  evidenceType: CivicNominationEvidenceType;
  summary?: string;
}

export interface CivicNominationConflictOfInterest {
  status: CivicNominationConflictOfInterestStatus;
  summary?: string;
}

export interface CivicNominationDeclarations {
  supportsUdhr: boolean;
  supportsHumanityUnionPrinciples: boolean;
  understandsNoAutomaticAppointment: boolean;
  confirmsAccuracy: boolean;
}

/** Civic Nomination aggregate root (TASK-072). */
export interface CivicNomination {
  nominationId: CivicNominationId;
  institutionRole: CivicNominationInstitutionRole;
  nominationType: CivicNominationType;
  nomineeName: string;
  nomineeProfileId?: string;
  nominatedByProfileId: string;
  nominatedByUserId: string;
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
  status: CivicNominationStatus;
  submittedAt?: string;
  publishedAt?: string;
  withdrawnAt?: string;
  archivedAt?: string;
  nominationVersion: number;
  createdAt: string;
  updatedAt: string;
}

export const CIVIC_NOMINATION_COUNTRY_REQUIRED_ROLES: readonly CivicNominationInstitutionRole[] = [
  "humanity_council",
  "state_collaboration_department",
];
