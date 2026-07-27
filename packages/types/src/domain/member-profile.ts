/** Profile visibility for civic participant identity. */
export type MemberProfileVisibility = "public" | "members_only" | "private";

/** Participant profile lifecycle status. */
export type MemberProfileStatus = "active" | "suspended";

/** Mongo-backed civic participant profile (TASK-053). */
export interface MemberProfile {
  profileId: string;
  userId: string;
  memberNumber: string;
  createdAt: string;
  updatedAt: string;

  displayName: string;
  publicName: string;
  biography?: string;
  avatarUrl?: string;
  organization?: string;
  website?: string;
  linkedinUrl?: string;
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

  status: MemberProfileStatus;
}

export interface MemberProfilePrivacySettings {
  profileVisibility: MemberProfileVisibility;
  showOrganization: boolean;
  showLocation: boolean;
  showParticipationArea: boolean;
  participationVisibility: MemberProfileVisibility;
  membershipPubliclyVisible: boolean;
  skillsVisibility: MemberProfileVisibility;
  professionalLinksVisibility: MemberProfileVisibility;
}

/** Safe public civic identity projection — never includes auth internals. */
export interface PublicMemberProfile {
  profileId: string;
  publicName: string;
  displayName?: string;
  biography?: string;
  avatarUrl?: string;
  organization?: string;
  website?: string;
  linkedinUrl?: string;
  skills?: string[];
  country?: string;
  region?: string;
  community?: string;
  participationAreaId?: string;
  membershipStatus?: "member" | "participant";
  memberNumber?: string;
  memberBadgeVisible?: boolean;
}
