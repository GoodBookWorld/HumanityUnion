import type { PublicCommentAuthor } from "@hu/types";

import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { findMemberProfilesByUserIds } from "../member-profile/member-profile.repository.js";
import { resolvePublicAuthorIdentity } from "../member-profile/public-author-identity.projection.js";

/**
 * Profile UX Pack 01 — resolves a public-safe author identity (avatar,
 * display name, profile link) for a list of Ally `participantId`s
 * (auth-account `memberId`s), reusing the exact same privacy-respecting
 * projection already used for Discussion comment authors
 * (`resolvePublicCommentAuthorsForComments`). Used by both the Initiative
 * Author's Collaboration review list (Part 2/8) and the Workspace Allies
 * widget (Part 9/10) so both surfaces render identical, correct identity
 * data from one implementation.
 *
 * Two batched round trips regardless of list size: one to resolve
 * `memberId -> AuthUserRecord` (for `userId` and the registration-time
 * `displayName` fallback), one to resolve `userId -> MemberProfile`.
 */
export async function resolvePublicAuthorsForParticipantIds(
  participantIds: readonly string[],
): Promise<Map<string, PublicCommentAuthor>> {
  const uniqueParticipantIds = [...new Set(participantIds.filter((id) => id.trim().length > 0))];

  if (uniqueParticipantIds.length === 0) {
    return new Map();
  }

  const authUsersByMemberId = await findAuthUsersByMemberIds(uniqueParticipantIds);
  const userIds = [...authUsersByMemberId.values()].map((record) => record.userId);
  const profilesByUserId = await findMemberProfilesByUserIds(userIds);

  const authors = new Map<string, PublicCommentAuthor>();

  for (const participantId of uniqueParticipantIds) {
    const authUser = authUsersByMemberId.get(participantId);

    authors.set(
      participantId,
      resolvePublicAuthorIdentity(
        authUser ? profilesByUserId.get(authUser.userId) : undefined,
        authUser?.displayName ?? "Participant",
      ),
    );
  }

  return authors;
}
