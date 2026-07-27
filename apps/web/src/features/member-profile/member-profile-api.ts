import type { MemberProfile, MemberProfilePrivacySettings, PublicMemberProfile } from "@hu/types";

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

export async function getWorkspaceMemberIdentity(): Promise<WorkspaceMemberIdentity> {
  return apiRequest<WorkspaceMemberIdentity>("/api/v1/member-profile/me/workspace-identity");
}

export async function getPublicMemberProfile(profileId: string): Promise<PublicMemberProfile> {
  return apiRequest<PublicMemberProfile>(
    `/api/v1/public/member-profiles/${encodeURIComponent(profileId)}`,
  );
}
