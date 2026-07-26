import type { MembershipRecord } from "@hu/types";
import type { MemberProfile, MemberProfilePrivacySettings, PublicMemberProfile } from "@hu/types";

import { DEFAULT_MEMBER_AVATAR_URL } from "./member-profile.constants.js";

const INTERNAL_FIELDS = [
  "userId",
  "passwordHash",
  "email",
  "refreshTokenHash",
  "sessionId",
] as const;

export function resolveMemberAvatarUrl(avatarUrl?: string): string {
  return avatarUrl ?? DEFAULT_MEMBER_AVATAR_URL;
}

export function isMemberProfileFieldVisible(
  visibility: MemberProfile["profileVisibility"],
  options: {
    viewerIsAuthenticated: boolean;
    viewerIsOwner: boolean;
  },
): boolean {
  if (visibility === "private" && !options.viewerIsOwner) {
    return false;
  }

  if (visibility === "members_only" && !options.viewerIsAuthenticated && !options.viewerIsOwner) {
    return false;
  }

  return true;
}

export function toMemberProfilePrivacySettings(
  profile: MemberProfile,
): MemberProfilePrivacySettings {
  return {
    profileVisibility: profile.profileVisibility,
    showOrganization: profile.showOrganization,
    showLocation: profile.showLocation,
    showParticipationArea: profile.showParticipationArea,
    participationVisibility: profile.participationVisibility,
    membershipPubliclyVisible: profile.membershipPubliclyVisible ?? false,
    skillsVisibility: profile.skillsVisibility ?? "members_only",
    professionalLinksVisibility: profile.professionalLinksVisibility ?? "public",
  };
}

export function resolvePublicMembershipFields(
  profile: MemberProfile,
  membership: MembershipRecord | null,
): Pick<PublicMemberProfile, "membershipStatus" | "memberNumber" | "memberBadgeVisible"> {
  const isActiveMember = membership?.status === "active_member";
  const wantsPublic = profile.membershipPubliclyVisible === true;

  if (isActiveMember && wantsPublic && membership?.memberNumber) {
    return {
      membershipStatus: "member",
      memberNumber: membership.memberNumber,
      memberBadgeVisible: true,
    };
  }

  return {
    membershipStatus: "participant",
    memberBadgeVisible: false,
  };
}

export function toPublicMemberProfile(
  profile: MemberProfile,
  options: {
    viewerIsAuthenticated: boolean;
    viewerIsOwner: boolean;
    membership?: MembershipRecord | null;
  },
): PublicMemberProfile | null {
  if (profile.status === "suspended") {
    return null;
  }

  if (profile.profileVisibility === "private" && !options.viewerIsOwner) {
    return null;
  }

  if (profile.profileVisibility === "members_only" && !options.viewerIsAuthenticated) {
    return null;
  }

  const includeDisplayName =
    profile.profileVisibility === "public" ||
    (profile.profileVisibility === "members_only" && options.viewerIsAuthenticated) ||
    options.viewerIsOwner;

  const publicProfile: PublicMemberProfile = {
    profileId: profile.profileId,
    publicName: profile.publicName,
    biography: profile.biography,
    avatarUrl: resolveMemberAvatarUrl(profile.avatarUrl),
    ...resolvePublicMembershipFields(profile, options.membership ?? null),
  };

  const professionalLinksVisible = isMemberProfileFieldVisible(
    profile.professionalLinksVisibility ?? "public",
    options,
  );

  if (professionalLinksVisible) {
    if (profile.website) {
      publicProfile.website = profile.website;
    }

    if (profile.linkedinUrl) {
      publicProfile.linkedinUrl = profile.linkedinUrl;
    }
  }

  const skillsVisible = isMemberProfileFieldVisible(
    profile.skillsVisibility ?? "members_only",
    options,
  );

  if (skillsVisible && profile.skills.length > 0) {
    publicProfile.skills = profile.skills;
  }

  if (includeDisplayName) {
    publicProfile.displayName = profile.displayName;
  }

  if (profile.showOrganization || options.viewerIsOwner) {
    publicProfile.organization = profile.organization;
  }

  if (profile.showLocation || options.viewerIsOwner) {
    publicProfile.country = profile.country;
    publicProfile.region = profile.region;
    publicProfile.community = profile.community;
  }

  const participationVisible =
    profile.participationVisibility === "public" ||
    (profile.participationVisibility === "members_only" && options.viewerIsAuthenticated) ||
    options.viewerIsOwner;

  if ((profile.showParticipationArea && participationVisible) || options.viewerIsOwner) {
    publicProfile.participationAreaId = profile.participationAreaId;
  }

  return publicProfile;
}

export function assertPublicMemberProfileIsSafe(record: Record<string, unknown>): void {
  for (const field of INTERNAL_FIELDS) {
    if (field in record) {
      throw new Error(`Public member profile must not expose ${field}.`);
    }
  }
}

export function toWorkspaceMemberIdentity(profile: MemberProfile) {
  return {
    profileId: profile.profileId,
    displayName: profile.displayName,
    avatarUrl: resolveMemberAvatarUrl(profile.avatarUrl),
    country: profile.country,
    region: profile.region,
    community: profile.community,
    participationAreaId: profile.participationAreaId,
  };
}
