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
 *
 * Presentation locale is sent as both `?locale=` and `X-HU-Presentation-Locale`
 * so authenticated preview cannot fall through to Participant interfaceLanguage
 * when the Web UI locale (hu_lang / next-intl) differs from prefs.
 */
export async function getMyPublicMemberProfilePreview(
  locale?: string,
): Promise<MemberProfilePublicPreview> {
  const trimmed = typeof locale === "string" ? locale.trim() : "";
  const query = trimmed ? `?locale=${encodeURIComponent(trimmed)}` : "";
  return apiRequest<MemberProfilePublicPreview>(
    `/api/v1/member-profile/me/public-preview${query}`,
    trimmed
      ? {
          headers: {
            "X-HU-Presentation-Locale": trimmed,
          },
        }
      : undefined,
  );
}

export async function getPublicMemberProfile(
  profileId: string,
  locale?: string,
): Promise<PublicMemberProfile> {
  const trimmed = typeof locale === "string" ? locale.trim() : "";
  const query = trimmed ? `?locale=${encodeURIComponent(trimmed)}` : "";
  return apiRequest<PublicMemberProfile>(
    `/api/v1/public/member-profiles/${encodeURIComponent(profileId)}${query}`,
    trimmed
      ? {
          headers: {
            "X-HU-Presentation-Locale": trimmed,
          },
        }
      : undefined,
  );
}

/**
 * UX Evolution Pack 02.4 Part 6 — resolves the same public profile page
 * every comment-author / Initiative-author link points to
 * (`/member/{publicName}`), keyed by the human-readable `publicName`
 * rather than the opaque `profileId`.
 *
 * Pass `credentials: "omit"` when the caller must match anonymous `/member`
 * SSR (owner-preview PLP field merge) and must not elevate to viewerIsOwner.
 */
export async function getPublicMemberProfileByPublicName(
  publicName: string,
  locale?: string,
  init?: RequestInit,
): Promise<PublicMemberProfile> {
  const trimmed = typeof locale === "string" ? locale.trim() : "";
  const query = trimmed ? `?locale=${encodeURIComponent(trimmed)}` : "";
  const headers = new Headers(init?.headers);
  if (trimmed && !headers.has("X-HU-Presentation-Locale")) {
    headers.set("X-HU-Presentation-Locale", trimmed);
  }
  return apiRequest<PublicMemberProfile>(
    `/api/v1/public/member-profiles/by-name/${encodeURIComponent(publicName)}${query}`,
    {
      ...init,
      headers,
    },
  );
}
