import type { InitiativeDiscussionProposalCandidate } from "@hu/types";

import {
  countProposalCandidatesForSourceParticipant,
  listProposalCandidatesBySourceParticipantId,
} from "./initiative-proposal-candidate.store.js";

/**
 * Pack 19C.2B — Participant Proposal statistics.
 *
 * Canonical source: `InitiativeDiscussionProposalCandidate`.
 * Attribution: `sourceParticipantId` (comment author), never `creatorParticipantId`.
 * Unit: one count per distinct `candidateId` in status `"candidate"`.
 *
 * Excludes Part D structured proposals, legacy CI proposals, and unmarked comments.
 */

export async function countProposalsForParticipant(participantId: string): Promise<number> {
  const candidates = await listProposalCandidatesBySourceParticipantId(participantId);

  return countProposalCandidatesForSourceParticipant(candidates, participantId);
}

export function computeProposalStatistics(
  candidates: readonly Pick<
    InitiativeDiscussionProposalCandidate,
    "candidateId" | "sourceParticipantId" | "status"
  >[],
  participantId: string,
): { proposalsCount: number } {
  return {
    proposalsCount: countProposalCandidatesForSourceParticipant(candidates, participantId),
  };
}
