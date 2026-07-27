import type { CivicNominationId, CivicNominationInstitutionRole } from "./civic-nomination.js";
import type { ParticipationScope } from "./initiative-collective-decision.js";
import type { MemberId } from "./member.js";
import type { ParticipationTransparencyCohort } from "./participation-eligibility.js";

export type CivicNominationVoteId = string;

export type CivicNominationVoteHistoryId = string;

export type CivicNominationVoteChoice = "support" | "do_not_support" | "abstain";

export type CivicNominationVotingSessionStatus = "not_open" | "open" | "closed" | "cancelled";

export type CivicNominationVotingOutcomeLabel =
  "supported" | "not_supported" | "inconclusive" | "cancelled";

/** Active participant vote on an open civic nomination voting session. */
export interface CivicNominationVote {
  voteId: CivicNominationVoteId;
  nominationId: CivicNominationId;
  participantId: MemberId;
  profileId: string;
  choice: CivicNominationVoteChoice;
  transparencyCohort: ParticipationTransparencyCohort;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** Immutable audit record for each cast or vote change. */
export interface CivicNominationVoteHistoryEntry {
  historyId: CivicNominationVoteHistoryId;
  voteId: CivicNominationVoteId;
  nominationId: CivicNominationId;
  participantId: MemberId;
  previousChoice?: CivicNominationVoteChoice;
  newChoice: CivicNominationVoteChoice;
  changedAt: string;
  transparencyCohort: ParticipationTransparencyCohort;
}

export interface CivicNominationVotingSession {
  votingSessionId: string;
  nominationId: CivicNominationId;
  institutionRole: CivicNominationInstitutionRole;
  participationScope: ParticipationScope;
  status: CivicNominationVotingSessionStatus;
  openedAt?: string;
  closesAt: string;
  closedAt?: string;
  cancelledAt?: string;
  nominationVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CivicNominationVotingResult {
  totalVotes: number;
  supportVotes: number;
  doNotSupportVotes: number;
  abstainVotes: number;
  verifiedVotes: number;
  unverifiedVotes: number;
  verifiedSupportVotes: number;
  verifiedDoNotSupportVotes: number;
  verifiedAbstainVotes: number;
  unverifiedSupportVotes: number;
  unverifiedDoNotSupportVotes: number;
  unverifiedAbstainVotes: number;
  outcomeLabel: CivicNominationVotingOutcomeLabel;
}

export function createEmptyCivicNominationVotingResult(
  outcomeLabel: CivicNominationVotingOutcomeLabel = "inconclusive",
): CivicNominationVotingResult {
  return {
    totalVotes: 0,
    supportVotes: 0,
    doNotSupportVotes: 0,
    abstainVotes: 0,
    verifiedVotes: 0,
    unverifiedVotes: 0,
    verifiedSupportVotes: 0,
    verifiedDoNotSupportVotes: 0,
    verifiedAbstainVotes: 0,
    unverifiedSupportVotes: 0,
    unverifiedDoNotSupportVotes: 0,
    unverifiedAbstainVotes: 0,
    outcomeLabel,
  };
}

export const CIVIC_NOMINATION_VOTING_ELIGIBLE_ROLES: readonly CivicNominationInstitutionRole[] = [
  "humanity_council",
  "chamber_of_intellectual_analysis",
  "expert_analysis_team",
  "state_collaboration_department",
];

export function resolveCivicNominationVotingScope(
  institutionRole: CivicNominationInstitutionRole,
): ParticipationScope {
  switch (institutionRole) {
    case "humanity_council":
    case "state_collaboration_department":
      return "country";
    case "chamber_of_intellectual_analysis":
    case "expert_analysis_team":
      return "world";
    default:
      throw new Error("Institution role is not eligible for civic nomination voting.");
  }
}

export function computeCivicNominationVotingOutcomeLabel(input: {
  supportVotes: number;
  doNotSupportVotes: number;
  sessionStatus: CivicNominationVotingSessionStatus;
}): CivicNominationVotingOutcomeLabel {
  if (input.sessionStatus === "cancelled") {
    return "cancelled";
  }

  if (input.supportVotes > input.doNotSupportVotes) {
    return "supported";
  }

  if (input.doNotSupportVotes > input.supportVotes) {
    return "not_supported";
  }

  return "inconclusive";
}
