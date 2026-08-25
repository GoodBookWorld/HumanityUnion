import type {
  InitiativeDiscussionProposalCandidate,
  InitiativeImplementationCommitment,
  ParticipantStatistics,
} from "@hu/types";

import {
  countProposalCandidatesForSourceParticipant,
  listProposalCandidatesBySourceParticipantId,
} from "../initiative-discussion-collaboration/initiative-proposal-candidate.store.js";
import {
  countActiveCollaborationsForParticipant,
  listWorkspaceAlliesForParticipant,
} from "../initiative-discussion-collaboration/workspace-allies.service.js";
import { listCommitmentsByParticipant } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { computeImplementationCommitmentStatistics } from "../initiative-implementation-commitment/initiative-implementation-commitment-statistics.js";
import { listInitiativesBySteward } from "../initiatives/initiative.store.js";
import { countActivePetitionSignaturesForParticipant } from "../petition/petition-signature-statistics.js";
import { listActiveSignaturesByMemberId } from "../petition/persistence/petition-signature.repository.js";
import type { PetitionSignatureMongoRecord } from "../petition/persistence/petition-signature.mongo-document.js";

/**
 * Profile UX Pack 02 Part 11 / Pack 19B / Pack 19C.2B — the ONE shared
 * aggregation layer behind Workspace, Member Profile, and the privacy-filtered
 * Public Profile. Every consumer must call `getParticipantStatistics` rather
 * than recomputing these numbers independently.
 *
 * Definitions (kept identical across every surface — privacy only gates
 * whether a number is *displayed*, never how it is *calculated*):
 *  - `initiativesCount`: Initiatives this Participant stewards.
 *  - `collectiveDecisionsCount`: Initiatives where this Participant is an
 *    ACTIVE Initiative Ally.
 *  - `alliesCount`: unique active Allies across stewarded Initiatives.
 *  - `proposalsCount`: Discussion Proposal Candidates where
 *    `sourceParticipantId` is this Participant (one per `candidateId`).
 *  - `petitionsCount`: distinct Petitions with an Active Signature
 *    (`memberId` = Participant).
 *  - `commitmentsAcceptedCount` / `commitmentsActiveCount` /
 *    `commitmentsFulfilledCount`: Pack 19B Implementation Commitment stats
 *    from canonical Commitment records (not notifications / proposalHistory).
 */
export interface ParticipantStatisticsDependencies {
  listInitiativesStewardedBy: (participantId: string) => Array<{ initiativeId: string }>;
  listWorkspaceAlliesForParticipant: (
    participantId: string,
  ) => Promise<Array<{ participantId: string }>>;
  countActiveCollaborationsForParticipant: (participantId: string) => Promise<number>;
  listProposalCandidatesForParticipant: (
    participantId: string,
  ) => Promise<
    readonly Pick<
      InitiativeDiscussionProposalCandidate,
      "candidateId" | "sourceParticipantId" | "status"
    >[]
  >;
  listActivePetitionSignaturesForParticipant: (
    participantId: string,
  ) => Promise<
    readonly Pick<PetitionSignatureMongoRecord, "petitionId" | "memberId" | "status">[]
  >;
  listCommitmentsForParticipant: (
    participantId: string,
  ) => readonly Pick<
    InitiativeImplementationCommitment,
    "participantId" | "proposalStatus" | "acceptedAt" | "status"
  >[];
}

const defaultParticipantStatisticsDependencies: ParticipantStatisticsDependencies = {
  listInitiativesStewardedBy: listInitiativesBySteward,
  listWorkspaceAlliesForParticipant,
  countActiveCollaborationsForParticipant,
  listProposalCandidatesForParticipant: listProposalCandidatesBySourceParticipantId,
  listActivePetitionSignaturesForParticipant: listActiveSignaturesByMemberId,
  listCommitmentsForParticipant: listCommitmentsByParticipant,
};

export async function getParticipantStatistics(
  participantId: string,
  deps: ParticipantStatisticsDependencies = defaultParticipantStatisticsDependencies,
): Promise<ParticipantStatistics> {
  const [allies, collectiveDecisionsCount, proposalCandidates, activePetitionSignatures] =
    await Promise.all([
      deps.listWorkspaceAlliesForParticipant(participantId),
      deps.countActiveCollaborationsForParticipant(participantId),
      deps.listProposalCandidatesForParticipant(participantId),
      deps.listActivePetitionSignaturesForParticipant(participantId),
    ]);

  const commitmentStats = computeImplementationCommitmentStatistics(
    deps.listCommitmentsForParticipant(participantId),
    participantId,
  );

  return {
    initiativesCount: deps.listInitiativesStewardedBy(participantId).length,
    collectiveDecisionsCount,
    alliesCount: allies.length,
    proposalsCount: countProposalCandidatesForSourceParticipant(
      proposalCandidates,
      participantId,
    ),
    petitionsCount: countActivePetitionSignaturesForParticipant(
      activePetitionSignatures,
      participantId,
    ),
    commitmentsAcceptedCount: commitmentStats.accepted,
    commitmentsActiveCount: commitmentStats.active,
    commitmentsFulfilledCount: commitmentStats.fulfilled,
  };
}
