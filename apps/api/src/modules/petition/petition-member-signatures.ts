import type { Signature } from "@hu/types";

import { findMemberById } from "../member/infrastructure/member.repository.js";
import { findMembershipByUserId } from "../membership/membership.repository.js";

/**
 * HU-LC-05C.4C.6N — number of Active signatures given by earned Members.
 *
 * A signature's `participantId` is the account's `memberId`; earned Membership
 * is keyed by the auth `userId`, which is the Participant account record's
 * `identityId` (both written by `confirmMemberRegistration`). Only an
 * `active_member` Membership counts; a signer whose account or Membership
 * cannot be resolved counts as a Participant only.
 */
export async function countActiveMemberSignatures(
  signatures: readonly Signature[],
): Promise<number> {
  const memberFlags = await Promise.all(
    signatures
      .filter((signature) => signature.status === "Active")
      .map(async (signature) => {
        try {
          const account = await findMemberById(signature.participantId);
          if (!account) {
            return false;
          }
          const membership = await findMembershipByUserId(account.identityId);
          return membership?.status === "active_member";
        } catch {
          return false;
        }
      }),
  );

  return memberFlags.filter(Boolean).length;
}
