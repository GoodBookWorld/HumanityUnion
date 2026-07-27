import type {
  CivicNominationConflictOfInterestStatus,
  CivicNominationEvidenceLink,
  CivicNominationExpertiseArea,
  CivicNominationId,
  CivicNominationInstitutionRole,
  CivicNominationStatus,
  CivicNominationType,
} from "./civic-nomination.js";

export interface PublicCivicNominationDeclarationStatus {
  supportsUdhr: boolean;
  supportsHumanityUnionPrinciples: boolean;
  understandsNoAutomaticAppointment: boolean;
  confirmsAccuracy: boolean;
}

export interface PublicCivicNominationConflictOfInterest {
  status: CivicNominationConflictOfInterestStatus;
  summary?: string;
}

/** Privacy-safe public projection — no userId, email, or auth internals. */
export interface PublicCivicNominationProjection {
  nominationId: CivicNominationId;
  institutionRole: CivicNominationInstitutionRole;
  nominationType: CivicNominationType;
  nomineeName: string;
  nomineeDisplayName?: string;
  nominatedByDisplayName: string;
  countrySlug?: string;
  regionSlug?: string;
  communitySlug?: string;
  expertiseAreas: CivicNominationExpertiseArea[];
  experienceSummary: string;
  confirmedAchievements: string;
  evidenceLinks: CivicNominationEvidenceLink[];
  visionStatement: string;
  conflictOfInterest: PublicCivicNominationConflictOfInterest;
  declarationStatus: PublicCivicNominationDeclarationStatus;
  status: CivicNominationStatus;
  publishedAt?: string;
  updatedAt: string;
  nominationVersion: number;
  legalNotice: string;
  transparencyNote: string;
}

export interface PublicCivicNominationListItem {
  nominationId: CivicNominationId;
  institutionRole: CivicNominationInstitutionRole;
  nominationType: CivicNominationType;
  nomineeName: string;
  nomineeDisplayName?: string;
  countrySlug?: string;
  expertiseAreas: CivicNominationExpertiseArea[];
  status: CivicNominationStatus;
  publishedAt?: string;
  updatedAt: string;
  publicUrl: string;
}
