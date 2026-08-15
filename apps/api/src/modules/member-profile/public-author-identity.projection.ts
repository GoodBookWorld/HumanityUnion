import type { MemberProfile, PublicCommentAuthor } from "@hu/types";

import { resolveMemberAvatarUrl } from "./member-profile.projection.js";

/**
 * UX Evolution Pack 02.4 Part 3/4 — the single, shared "resolve a public
 * author identity from a MemberProfile" rule.
 *
 * This was previously duplicated only inside
 * `initiative-comments/public-comment-author.projection.ts`. Initiative
 * steward display (Overview, Lifecycle Initiative stage) needs the exact
 * same privacy-respecting resolution — active profile required for a real
 * name, `public` visibility required for a profile link, never expose email
 * or other private/unpublished fields — so it now lives here in
 * `member-profile` (a module both `initiatives` and `initiative-comments`
 * already depend on) and both call sites share one implementation instead
 * of two copies that could silently drift apart.
 */

const FALLBACK_AUTHOR_NAME = "Participant";

function resolveDisplayName(profile: MemberProfile | undefined, nameSnapshot: string): string {
  const currentName = profile?.displayName.trim();

  if (profile?.status === "active" && currentName) {
    return currentName;
  }

  const snapshot = nameSnapshot.trim();

  if (snapshot) {
    return snapshot;
  }

  return FALLBACK_AUTHOR_NAME;
}

function resolveProfileUrl(profile: MemberProfile | undefined): string | undefined {
  if (!profile || profile.status !== "active" || profile.profileVisibility !== "public") {
    return undefined;
  }

  return `/member/${encodeURIComponent(profile.publicName)}`;
}

/**
 * Resolves a public-safe author identity (display name, optional avatar,
 * optional profile link) from a `MemberProfile`, falling back to a
 * non-profile name snapshot (e.g. a registration-time display name) when no
 * active public profile exists. Never returns email or any other private
 * field, and never returns an internal placeholder like "Unknown Steward" —
 * the fallback chain always ends in a human-readable name or the generic
 * "Participant" label already used for comment authors.
 */
export function resolvePublicAuthorIdentity(
  profile: MemberProfile | undefined,
  nameSnapshot: string,
): PublicCommentAuthor {
  const displayName = resolveDisplayName(profile, nameSnapshot);

  if (!profile || profile.status !== "active") {
    return { displayName };
  }

  return {
    publicUserId: profile.profileId,
    displayName,
    avatarUrl: resolveMemberAvatarUrl(profile.avatarUrl),
    profileUrl: resolveProfileUrl(profile),
  };
}
