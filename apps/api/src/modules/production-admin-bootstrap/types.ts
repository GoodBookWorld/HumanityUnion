import type { DirectMessagingPolicy, MemberProfileVisibility } from "@hu/types";

export interface SourceAdminProfileAttribution {
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
  membershipPubliclyVisible?: boolean;
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

export interface SourceAdminIdentity {
  label: string;
  memberId: string;
  userId: string;
  profileId: string;
  email: string;
  displayName: string;
  publicName: string;
  uniqueName: string;
  /** Must be "admin" for allow-listed Volody; never inferred. */
  authRole: "admin";
  languages?: string[];
  memberCreatedAt?: string;
  authCreatedAt?: string;
  profile?: SourceAdminProfileAttribution;
  sourcePasswordHash?: string;
}

export interface SourceAdminManifest {
  version: number;
  identities: SourceAdminIdentity[];
}

export interface SanitizedAdminAuthUserDocument {
  userId: string;
  memberId: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: "admin";
  status: "active";
  emailVerificationStatus: "pending";
  createdAt: string;
  updatedAt: string;
}

export interface SanitizedAdminMemberDocument {
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

export interface SanitizedAdminMemberProfileDocument {
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
  membershipPubliclyVisible: boolean;
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

export interface AdminPreparedDocuments {
  label: string;
  memberId: string;
  userId: string;
  profileId: string;
  emailMasked: string;
  publicName: string;
  uniqueName: string;
  authRole: "admin";
  auth: SanitizedAdminAuthUserDocument;
  member: SanitizedAdminMemberDocument;
  profile: SanitizedAdminMemberProfileDocument;
  discardedSourcePasswordHash?: string;
}

export type AdminBootstrapMode = "dry-run" | "execute";

export interface AdminBootstrapPlanRow {
  label: string;
  memberId: string;
  userId: string;
  profileId: string;
  emailMasked: string;
  publicName: string;
  uniqueName: string;
  authRole: "admin";
  memberRoles: ["member"];
  operation: "would_create" | "created" | "aborted";
}

export interface AdminBootstrapResult {
  mode: AdminBootstrapMode;
  database: string;
  transactionUsed: boolean;
  rollbackPerformed: boolean;
  admin: AdminBootstrapPlanRow;
  written: {
    authUsers: number;
    members: number;
    memberProfiles: number;
    memberships: number;
  };
  sessionsWritten: number;
  tokensWritten: number;
  protectedStewardsUntouched: boolean;
}
