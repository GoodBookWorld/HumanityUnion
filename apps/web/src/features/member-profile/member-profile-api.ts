import type {
  MemberProfile,
  MemberProfilePrivacySettings,
  MemberProfilePublicPreview,
  ParticipantStatistics,
  PublicMemberProfile,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface WorkspaceMemberIdentity {
  profileId: string;
  displayName: string;
  avatarUrl: string;
  country?: string;
  region?: string;
  community?: string;
  participationAreaId?: string;
}

export async function getMyMemberProfile(): Promise<MemberProfile> {
  return apiRequest<MemberProfile>("/api/v1/member-profile/me");
}

export async function updateMyMemberProfile(patch: Partial<MemberProfile>): Promise<MemberProfile> {
  return apiRequest<MemberProfile>("/api/v1/member-profile/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
}

export async function getMyMemberProfilePrivacy(): Promise<MemberProfilePrivacySettings> {
  return apiRequest<MemberProfilePrivacySettings>("/api/v1/member-profile/me/privacy");
}

export async function updateMyMemberProfilePrivacy(
  patch: Partial<MemberProfilePrivacySettings>,
): Promise<MemberProfilePrivacySettings> {
  return apiRequest<MemberProfilePrivacySettings>("/api/v1/member-profile/me/privacy", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
}

/** Profile UX Pack 02 Part 4/11 — same shared aggregation the Workspace statistics widget uses. */
export async function getMyMemberProfileStatistics(): Promise<ParticipantStatistics> {
  return apiRequest<ParticipantStatistics>("/api/v1/member-profile/me/statistics");
}

export async function getWorkspaceMemberIdentity(): Promise<WorkspaceMemberIdentity> {
  return apiRequest<WorkspaceMemberIdentity>("/api/v1/member-profile/me/workspace-identity");
}

/**
 * Profile UX Pack 03.3 — the signed-in owner's "Public Profile Preview"
 * (`/profile`): the exact same public-facing projection
 * `/member/{publicName}` renders for another authenticated Participant,
 * plus which sections Privacy currently hides. See
 * `getMyPublicMemberProfilePreview` (API) for why this never duplicates
 * Privacy logic.
 */
export async function getMyPublicMemberProfilePreview(): Promise<MemberProfilePublicPreview> {
  return apiRequest<MemberProfilePublicPreview>("/api/v1/member-profile/me/public-preview");
}

export async function getPublicMemberProfile(profileId: string): Promise<PublicMemberProfile> {
  return apiRequest<PublicMemberProfile>(
    `/api/v1/public/member-profiles/${encodeURIComponent(profileId)}`,
  );
}

/**
 * UX Evolution Pack 02.4 Part 6 — resolves the same public profile page
 * every comment-author / Initiative-author link points to
 * (`/member/{publicName}`), keyed by the human-readable `publicName`
 * rather than the opaque `profileId`.
 */
export async function getPublicMemberProfileByPublicName(
  publicName: string,
): Promise<PublicMemberProfile> {
  return apiRequest<PublicMemberProfile>(
    `/api/v1/public/member-profiles/by-name/${encodeURIComponent(publicName)}`,
  );
}
