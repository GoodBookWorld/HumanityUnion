import type { PublicCommentAuthor } from "@hu/types";

import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { resolvePublicAuthorIdentity } from "../member-profile/public-author-identity.projection.js";

export async function resolveBlogPublicAuthor(input: {
  authorParticipantId: string;
  authorDisplayNameSnapshot: string;
}): Promise<PublicCommentAuthor> {
  const authUser = await findAuthUserByMemberId(input.authorParticipantId);
  const profile = authUser ? await findMemberProfileByUserId(authUser.userId) : undefined;

  return resolvePublicAuthorIdentity(
    profile ?? undefined,
    input.authorDisplayNameSnapshot,
  );
}
