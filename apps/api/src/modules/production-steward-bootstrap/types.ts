import type { MemberProfileVisibility } from "@hu/types";
import type { DirectMessagingPolicy } from "@hu/types";

export interface SourceProfileAttribution {
  memberNumber?: string;
  biography?: string;
  avatarUrl?: string;
  organization?: string;
  website?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  skills?: string[];
  country?: string;
  region?: string;
  community?: string;
  participationAreaId?: string;
  participationVisibility?: MemberProfileVisibility;
  language?: string;
  timezone?: string;
  profileVisibility?: MemberProfileVisibility;
  showOrganization?: boolean;
  showLocation?: boolean;
  showParticipationArea?: boolean;
  skillsVisibility?: MemberProfileVisibility;
  professionalLinksVisibility?: MemberProfileVisibility;
  showInitiativesStatistics?: boolean;
  showCollectiveDecisionsStatistics?: boolean;
  showAlliesStatistics?: boolean;
  showProposalsStatistics?: boolean;
  showPetitionsStatistics?: boolean;
  showCommitmentsStatistics?: boolean;
  messagingPolicy?: DirectMessagingPolicy;
  createdAt?: string;
}

export interface SourceStewardIdentity {
  label: string;
  memberId: string;
  userId: string;
  profileId: string;
  /** Normalized or raw email — never logged. */
  email: string;
  displayName: string;
  publicName: string;
  uniqueName: string;
  languages?: string[];
  memberCreatedAt?: string;
  authCreatedAt?: string;
  profile?: SourceProfileAttribution;
  /**
   * Optional source passwordHash for tests asserting it is never copied.
   * Production manifests must omit this field.
   */
  sourcePasswordHash?: string;
}

export interface SourceStewardManifest {
  version: number;
  identities: SourceStewardIdentity[];
}

export interface SanitizedAuthUserDocument {
  userId: string;
  memberId: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: "member";
  status: "active";
  emailVerificationStatus: "pending";
  createdAt: string;
  updatedAt: string;
}

export interface SanitizedMemberDocument {
  memberId: string;
  identityId: string;
  displayName: string;
  uniqueName: string;
  languages: string[];
  status: "active";
  verificationLevel: "email";
  roles: ["member"];
  registrationStatus: "registered";
  version: 1;
  createdAt: string;
  updatedAt: string;
}

export interface SanitizedMemberProfileDocument {
  profileId: string;
  userId: string;
  memberNumber: string;
  displayName: string;
  publicName: string;
  biography?: string;
  avatarUrl?: string;
  organization?: string;
  website?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  skills: string[];
  country?: string;
  region?: string;
  community?: string;
  participationAreaId?: string;
  participationVisibility: MemberProfileVisibility;
  language: string;
  timezone?: string;
  profileVisibility: MemberProfileVisibility;
  showOrganization: boolean;
  showLocation: boolean;
  showParticipationArea: boolean;
  membershipPubliclyVisible: false;
  skillsVisibility: MemberProfileVisibility;
  professionalLinksVisibility: MemberProfileVisibility;
  showInitiativesStatistics: boolean;
  showCollectiveDecisionsStatistics: boolean;
  showAlliesStatistics: boolean;
  showProposalsStatistics: boolean;
  showPetitionsStatistics: boolean;
  showCommitmentsStatistics: boolean;
  messagingPolicy: DirectMessagingPolicy;
  status: "active";
  createdAt: string;
  updatedAt: string;
}

export interface StewardPreparedDocuments {
  label: string;
  memberId: string;
  userId: string;
  profileId: string;
  emailMasked: string;
  publicName: string;
  uniqueName: string;
  auth: SanitizedAuthUserDocument;
  member: SanitizedMemberDocument;
  profile: SanitizedMemberProfileDocument;
  /** Present only for assertions — never written or logged. */
  discardedSourcePasswordHash?: string;
}

export type BootstrapMode = "dry-run" | "execute";

export interface StewardBootstrapPlanRow {
  label: string;
  memberId: string;
  userId: string;
  profileId: string;
  emailMasked: string;
  publicName: string;
  uniqueName: string;
  operation: "would_create" | "created" | "aborted";
}

export interface StewardBootstrapResult {
  mode: BootstrapMode;
  database: string;
  transactionUsed: boolean;
  rollbackPerformed: boolean;
  stewards: StewardBootstrapPlanRow[];
  written: {
    authUsers: number;
    members: number;
    memberProfiles: number;
  };
  sessionsWritten: number;
  tokensWritten: number;
}
