import type { PublicCommentAuthor } from "@hu/types";

import { findMemberProfilesByUserIds } from "../member-profile/member-profile.repository.js";
import { resolvePublicAuthorIdentity } from "../member-profile/public-author-identity.projection.js";

/**
 * UX Evolution Pack 02.4 — the actual identity-resolution rule (active
 * profile required for a name, `public` visibility required for a link,
 * never expose private fields) now lives in `member-profile` so Initiative
 * steward display can reuse it too. Kept as a re-export here so existing
 * comment call sites are unaffected.
 */
export const resolvePublicCommentAuthor = resolvePublicAuthorIdentity;

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
