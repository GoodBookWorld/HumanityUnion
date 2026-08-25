import type { SignatureStatus } from "@hu/types";

import { listActiveSignaturesByMemberId } from "./persistence/petition-signature.repository.js";

/**
 * Pack 19C.2B — Participant Petition statistics.
 *
 * Canonical source: Petition `Signature` (`memberId` = Participant identity).
 * Count: distinct petitions with an Active signature for the Participant.
 * Withdrawn signatures do not count; re-signing reuses the same row → still one.
 */

export function countActivePetitionSignaturesForParticipant(
  signatures: readonly {
    petitionId: string;
    memberId: string;
    status: SignatureStatus | string;
  }[],
  participantId: string,
): number {
  const petitions = new Set<string>();

  for (const signature of signatures) {
    if (signature.memberId !== participantId || signature.status !== "Active") {
      continue;
    }

    if (!signature.petitionId) {
      continue;
    }

    petitions.add(signature.petitionId);
  }

  return petitions.size;
}

export async function countPetitionsForParticipant(participantId: string): Promise<number> {
  const signatures = await listActiveSignaturesByMemberId(participantId);

  return countActivePetitionSignaturesForParticipant(signatures, participantId);
}

export function computePetitionStatistics(
  signatures: readonly {
    petitionId: string;
    memberId: string;
    status: SignatureStatus | string;
  }[],
  participantId: string,
): { petitionsCount: number } {
  return {
    petitionsCount: countActivePetitionSignaturesForParticipant(signatures, participantId),
  };
}
