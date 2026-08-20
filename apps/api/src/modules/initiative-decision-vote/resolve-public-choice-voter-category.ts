import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMembershipByUserId } from "../membership/membership.repository.js";
import type { PublicChoiceVoterCategory } from "@hu/types";

/**
 * Resolve mutually exclusive Public Choice presentation category for an
 * authenticated voter. Member = active_member membership only.
 * Failures degrade to "participant" — never invent Member status.
 */
export async function resolveAuthenticatedPublicChoiceVoterCategory(
  participantId: string,
): Promise<"participant" | "member"> {
  try {
    const authUser = await findAuthUserByMemberId(participantId);
    if (!authUser) {
      return "participant";
    }

    const membership = await findMembershipByUserId(authUser.userId);
    if (membership?.status === "active_member") {
      return "member";
    }

    return "participant";
  } catch {
    return "participant";
  }
}

export function visitorPublicChoiceVoterCategory(): PublicChoiceVoterCategory {
  return "visitor";
}
