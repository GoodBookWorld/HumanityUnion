import type { MembershipRecord } from "@hu/types";
import type {
  MemberProfile,
  MemberProfilePrivacySettings,
  ParticipantStatistics,
  PublicMemberProfile,
  PublicMemberProfileHiddenSections,
  PublicParticipantStatistics,
} from "@hu/types";

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
    showInitiativesStatistics: profile.showInitiativesStatistics ?? true,
    showCollectiveDecisionsStatistics: profile.showCollectiveDecisionsStatistics ?? true,
    showAlliesStatistics: profile.showAlliesStatistics ?? true,
    showProposalsStatistics: profile.showProposalsStatistics ?? true,
    showPetitionsStatistics: profile.showPetitionsStatistics ?? true,
    showCommitmentsStatistics: profile.showCommitmentsStatistics ?? true,
    messagingPolicy: profile.messagingPolicy ?? "active_allies",
  };
}

/**
 * Profile UX Pack 02 Part 5/6/11 — pure filter applied to the one shared
 * `ParticipantStatistics` aggregation before it is placed on a Public
 * Profile projection. The profile owner always sees every number on their
 * own Public Profile (matches the existing `viewerIsOwner` bypass pattern
 * used for organization/location/participation area above); every other
 * viewer only sees the numbers the owner's Privacy switches allow.
 * Returns `undefined` (not an object of zeros) when nothing is permitted,
 * so the UI can omit the whole "Participation Statistics" block.
 */
export function toPublicParticipantStatistics(
  statistics: ParticipantStatistics,
  profile: Pick<
    MemberProfile,
    | "showInitiativesStatistics"
    | "showCollectiveDecisionsStatistics"
    | "showAlliesStatistics"
    | "showProposalsStatistics"
    | "showPetitionsStatistics"
    | "showCommitmentsStatistics"
  >,
  viewerIsOwner: boolean,
): PublicParticipantStatistics | undefined {
  const result: PublicParticipantStatistics = {};

  if (viewerIsOwner || (profile.showInitiativesStatistics ?? true)) {
    result.initiativesCount = statistics.initiativesCount;
  }

  if (viewerIsOwner || (profile.showCollectiveDecisionsStatistics ?? true)) {
    result.collectiveDecisionsCount = statistics.collectiveDecisionsCount;
  }

  if (viewerIsOwner || (profile.showAlliesStatistics ?? true)) {
    result.alliesCount = statistics.alliesCount;
  }

  if (viewerIsOwner || (profile.showProposalsStatistics ?? true)) {
    result.proposalsCount = statistics.proposalsCount;
  }

  if (viewerIsOwner || (profile.showPetitionsStatistics ?? true)) {
    result.petitionsCount = statistics.petitionsCount;
  }

  if (viewerIsOwner || (profile.showCommitmentsStatistics ?? true)) {
    result.commitmentsAcceptedCount = statistics.commitmentsAcceptedCount;
    result.commitmentsActiveCount = statistics.commitmentsActiveCount;
    result.commitmentsFulfilledCount = statistics.commitmentsFulfilledCount;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Pack 25A.1 — honorary Member status/badge is automatically public once
 * Membership is `active_member` with a Member Number. `membershipPubliclyVisible`
 * gates only the Member Number, never the Member indicator itself.
 */
export function resolvePublicMembershipFields(
  profile: MemberProfile,
  membership: MembershipRecord | null,
): Pick<PublicMemberProfile, "membershipStatus" | "memberNumber" | "memberBadgeVisible"> {
  const isActiveMember = membership?.status === "active_member";
  const memberNumber = membership?.memberNumber;

  if (!isActiveMember || !memberNumber) {
    return {
      membershipStatus: "participant",
      memberBadgeVisible: false,
    };
  }

  const fields: Pick<
    PublicMemberProfile,
    "membershipStatus" | "memberNumber" | "memberBadgeVisible"
  > = {
    membershipStatus: "member",
    memberBadgeVisible: true,
  };

  if (profile.membershipPubliclyVisible === true) {
    fields.memberNumber = memberNumber;
  }

  return fields;
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
    // Profile UX Pack 03 Part 7 — placeholder until
    // `enrichPublicMemberProfileProjection` resolves the real,
    // async, Privacy-and-Ally-aware value. Defaulting to "hidden" means a
    // request that fails before enrichment never leaks an active control.
    messagingAvailability: "hidden",
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

    if (profile.facebookUrl) {
      publicProfile.facebookUrl = profile.facebookUrl;
    }

    if (profile.youtubeUrl) {
      publicProfile.youtubeUrl = profile.youtubeUrl;
    }

    if (profile.instagramUrl) {
      publicProfile.instagramUrl = profile.instagramUrl;
    }

    if (profile.xUrl) {
      publicProfile.xUrl = profile.xUrl;
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
    if (profile.participationAreaId) {
      publicProfile.participationAreaId = profile.participationAreaId;
    }

    // Launch Readiness UX Fix Pack 01 — expose human-readable Participation
    // Area labels when Privacy permits (independent of showLocation). Labels
    // are the same geography strings already synced onto the profile; never
    // invent values or return the raw id as display text.
    const participationArea = {
      ...(profile.country ? { country: profile.country } : {}),
      ...(profile.region ? { region: profile.region } : {}),
      ...(profile.community ? { community: profile.community } : {}),
    };

    if (Object.keys(participationArea).length > 0) {
      publicProfile.participationArea = participationArea;
    }
  }

  return publicProfile;
}

/**
 * Profile UX Pack 03.3 — derives which sections of the owner's "Public
 * Profile Preview" (`/profile`) are absent specifically *because* Privacy
 * hides them, as opposed to absent because the owner never added anything.
 * Deliberately a pure diff against the same `PublicMemberProfile` the
 * public route already returns for a non-owner viewer — it never
 * re-implements a visibility rule, so it can never drift from
 * `toPublicMemberProfile` / `toPublicParticipantStatistics`. `biography`
 * and `recentPublicInitiatives` have no dedicated Privacy switch today (see
 * `MemberProfile`), so this always resolves them to `false`; the fields
 * exist for presentation-model completeness and stay correct automatically
 * if a future Privacy switch is ever added for either.
 */
export function resolvePublicMemberProfileHiddenSections(
  profile: MemberProfile,
  projection: PublicMemberProfile,
): PublicMemberProfileHiddenSections {
  return {
    statistics: projection.statistics === undefined,
    biography: Boolean(profile.biography) && !projection.biography,
    skills: profile.skills.length > 0 && !(projection.skills && projection.skills.length > 0),
    professionalLinks:
      Boolean(
        profile.website ||
          profile.linkedinUrl ||
          profile.facebookUrl ||
          profile.youtubeUrl ||
          profile.instagramUrl ||
          profile.xUrl,
      ) &&
      !(
        projection.website ||
        projection.linkedinUrl ||
        projection.facebookUrl ||
        projection.youtubeUrl ||
        projection.instagramUrl ||
        projection.xUrl
      ),
    recentPublicInitiatives: false,
  };
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
