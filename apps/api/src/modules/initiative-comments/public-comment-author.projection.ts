import type { MemberProfile, PublicCommentAuthor } from "@hu/types";

import { findMemberProfilesByUserIds } from "../member-profile/member-profile.repository.js";
import { resolveMemberAvatarUrl } from "../member-profile/member-profile.projection.js";

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

export function resolvePublicCommentAuthor(
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

export async function resolvePublicCommentAuthorsForComments(
  comments: Array<{ commentId: string; authorUserId: string; authorDisplayName: string }>,
): Promise<Map<string, PublicCommentAuthor>> {
  const uniqueUserIds = [...new Set(comments.map((comment) => comment.authorUserId))];
  const profilesByUserId = await findMemberProfilesByUserIds(uniqueUserIds);
  const authors = new Map<string, PublicCommentAuthor>();

  for (const comment of comments) {
    authors.set(
      comment.commentId,
      resolvePublicCommentAuthor(
        profilesByUserId.get(comment.authorUserId),
        comment.authorDisplayName,
      ),
    );
  }

  return authors;
}
