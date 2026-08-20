import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { MemberId } from "./member.js";
import type { ParticipationTransparencyCohort } from "./participation-eligibility.js";
import type { InitiativeDecisionVoteChoiceExtended } from "./initiative-decision-vote-ballot.js";
import type {
  PublicChoiceVoterCategory,
  PublicChoiceVoterCategoryBreakdown,
} from "./public-choice-ballot-mode.js";
import type { PublicChoiceCandidateId } from "./public-choice-candidate.js";

export type InitiativeDecisionVoteId = string;

export type InitiativeDecisionVoteHistoryId = string;

/** Legacy ternary choices — still the SUPPORT_OPPOSE contract. */
export type InitiativeDecisionVoteChoice = "support" | "do_not_support" | "abstain";

/**
 * Active vote on an open Initiative Collective Decision.
 * Pack 02A — exactly one voter identity: participantId XOR visitorKey.
 * SELECT_ONE_CANDIDATE may set candidateId when choice === "candidate".
 * voterCategory is a presentation/participation category, not a ballot choice.
 */
export interface InitiativeDecisionVote {
  voteId: InitiativeDecisionVoteId;
  decisionId: InitiativeCollectiveDecisionId;
  /** Present for authenticated Participant/Member votes. */
  participantId?: MemberId;
  /** Present for Visitor votes (PUBLIC_CHOICE only). Never combined with participantId. */
  visitorKey?: string;
  choice: InitiativeDecisionVoteChoiceExtended;
  /** Set when choice === "candidate" in SELECT_ONE_CANDIDATE mode. */
  candidateId?: PublicChoiceCandidateId;
  /**
   * Public Choice presentation category — mutually exclusive.
   * Member must not also count as Participant.
   */
  voterCategory?: PublicChoiceVoterCategory;
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
  participantId?: MemberId;
  visitorKey?: string;
  previousChoice?: InitiativeDecisionVoteChoiceExtended;
  previousCandidateId?: PublicChoiceCandidateId;
  newChoice: InitiativeDecisionVoteChoiceExtended;
  newCandidateId?: PublicChoiceCandidateId;
  changedAt: string;
  transparencyCohort: ParticipationTransparencyCohort;
  voterCategory?: PublicChoiceVoterCategory;
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

/** Pack 02A — SELECT_ONE_CANDIDATE tallies from the same Decision Vote store. */
export interface InitiativeDecisionVoteCandidateTally {
  candidateId: PublicChoiceCandidateId;
  count: number;
  percentage: number;
  /** Competition rank derived from count (ties share rank; next rank skips). */
  rank: number;
  /** True when at least one other candidate shares this count. */
  isTie: boolean;
}

export interface InitiativeDecisionSelectOneAggregates {
  ballotMode: "SELECT_ONE_CANDIDATE";
  candidates: InitiativeDecisionVoteCandidateTally[];
  abstain: number;
  abstainPercentage: number;
  totalEffectiveVoters: number;
  /** Mutually exclusive visitor | participant | member counts. */
  participationBreakdown: PublicChoiceVoterCategoryBreakdown;
}

export interface InitiativeDecisionSupportOpposeAggregates {
  ballotMode: "SUPPORT_OPPOSE";
  total: InitiativeDecisionVoteChoiceCounts;
  verified: InitiativeDecisionVoteChoiceCounts;
  unverified: InitiativeDecisionVoteChoiceCounts;
  /** Mutually exclusive visitor | participant | member counts (PUBLIC_CHOICE). */
  participationBreakdown: PublicChoiceVoterCategoryBreakdown;
}

export type InitiativeDecisionBallotAggregates =
  | InitiativeDecisionSupportOpposeAggregates
  | InitiativeDecisionSelectOneAggregates;

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

export function assertDecisionVoteVoterIdentity(vote: {
  participantId?: string | null;
  visitorKey?: string | null;
}): void {
  const hasParticipant = Boolean(vote.participantId?.trim());
  const hasVisitor = Boolean(vote.visitorKey?.trim());

  if (hasParticipant === hasVisitor) {
    throw new Error("Decision Vote must have exactly one of participantId or visitorKey.");
  }
}

/**
 * Resolve presentation category from stored vote fields.
 * Visitors never expose identity publicly — category is aggregate-only.
 */
export function resolveDecisionVoteVoterCategory(vote: {
  visitorKey?: string | null;
  participantId?: string | null;
  voterCategory?: PublicChoiceVoterCategory | null;
}): PublicChoiceVoterCategory {
  if (
    vote.voterCategory === "visitor" ||
    vote.voterCategory === "participant" ||
    vote.voterCategory === "member"
  ) {
    return vote.voterCategory;
  }

  if (vote.visitorKey?.trim()) {
    return "visitor";
  }

  // Authenticated without stored category defaults to participant (never invent Member).
  return "participant";
}
