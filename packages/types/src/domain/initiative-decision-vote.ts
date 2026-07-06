import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { MemberId } from "./member.js";
import type { ParticipationTransparencyCohort } from "./participation-eligibility.js";

export type InitiativeDecisionVoteId = string;

export type InitiativeDecisionVoteHistoryId = string;

export type InitiativeDecisionVoteChoice = "support" | "do_not_support" | "abstain";

/** Active participant vote on an open Initiative Collective Decision. */
export interface InitiativeDecisionVote {
  voteId: InitiativeDecisionVoteId;
  decisionId: InitiativeCollectiveDecisionId;
  participantId: MemberId;
  choice: InitiativeDecisionVoteChoice;
  transparencyCohort: ParticipationTransparencyCohort;
  castAt: string;
  updatedAt: string;
  version: number;
}

/** Immutable audit record for each cast or vote change. */
export interface InitiativeDecisionVoteHistoryEntry {
  historyId: InitiativeDecisionVoteHistoryId;
  voteId: InitiativeDecisionVoteId;
  decisionId: InitiativeCollectiveDecisionId;
  participantId: MemberId;
  previousChoice?: InitiativeDecisionVoteChoice;
  newChoice: InitiativeDecisionVoteChoice;
  changedAt: string;
  transparencyCohort: ParticipationTransparencyCohort;
}

export interface InitiativeDecisionVoteChoiceCounts {
  support: number;
  doNotSupport: number;
  abstain: number;
  totalVotes: number;
}

/** Transparent unweighted vote aggregates (TASK-028 helper only). */
export interface InitiativeDecisionVoteAggregates {
  total: InitiativeDecisionVoteChoiceCounts;
  verified: InitiativeDecisionVoteChoiceCounts;
  unverified: InitiativeDecisionVoteChoiceCounts;
}

export function createEmptyInitiativeDecisionVoteChoiceCounts(): InitiativeDecisionVoteChoiceCounts {
  return {
    support: 0,
    doNotSupport: 0,
    abstain: 0,
    totalVotes: 0,
  };
}

export function createEmptyInitiativeDecisionVoteAggregates(): InitiativeDecisionVoteAggregates {
  return {
    total: createEmptyInitiativeDecisionVoteChoiceCounts(),
    verified: createEmptyInitiativeDecisionVoteChoiceCounts(),
    unverified: createEmptyInitiativeDecisionVoteChoiceCounts(),
  };
}
