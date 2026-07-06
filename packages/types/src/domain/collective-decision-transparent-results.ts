import type {
  InitiativeCollectiveDecisionOutcomeType,
  InitiativeCollectiveDecisionStatistics,
  InitiativeCollectiveDecisionStatus,
  InitiativeCollectiveDecisionVoteCohortStatistics,
} from "./initiative-collective-decision.js";
import type { InitiativeDecisionVoteAggregates } from "./initiative-decision-vote.js";

/** Informational participation confidence level (TASK-029). Never alters outcomes. */
export type ParticipationConfidenceLevel = "high" | "medium" | "low" | "insufficient";

export const COLLECTIVE_DECISION_TRANSPARENCY_NOTE =
  "Verified and unverified counts are shown for transparency. They do not change vote weight.";

export interface CollectiveDecisionTransparentResults {
  statistics: InitiativeCollectiveDecisionStatistics;
  outcome: CollectiveDecisionPublicOutcome;
  participationConfidenceLevel: ParticipationConfidenceLevel;
  outcomeSummary: string;
  transparencyNote: string;
}

export interface CollectiveDecisionPublicOutcome {
  support: number;
  doNotSupport: number;
  abstain: number;
  verifiedStatistics: InitiativeCollectiveDecisionVoteCohortStatistics;
  unverifiedStatistics: InitiativeCollectiveDecisionVoteCohortStatistics;
  participationConfidenceLevel: ParticipationConfidenceLevel;
  outcome: InitiativeCollectiveDecisionOutcomeType;
  summary: string;
}

function mapChoiceCounts(
  counts: InitiativeDecisionVoteAggregates["total"],
): InitiativeCollectiveDecisionVoteCohortStatistics {
  return {
    support: counts.support,
    doNotSupport: counts.doNotSupport,
    abstain: counts.abstain,
    totalVotes: counts.totalVotes,
  };
}

/**
 * Version 1 informational confidence only.
 * Based on total vote count and verified share. Does not affect outcome.
 */
export function computeParticipationConfidenceLevel(input: {
  totalVotes: number;
  verifiedVotes: number;
}): ParticipationConfidenceLevel {
  if (input.totalVotes === 0) {
    return "insufficient";
  }

  if (input.totalVotes < 3) {
    return "insufficient";
  }

  const verifiedShare = input.verifiedVotes / input.totalVotes;

  if (input.totalVotes >= 10 && verifiedShare >= 0.5) {
    return "high";
  }

  if (input.totalVotes >= 5) {
    return "medium";
  }

  return "low";
}

export function calculateCollectiveDecisionOutcomeType(input: {
  status: InitiativeCollectiveDecisionStatus;
  support: number;
  doNotSupport: number;
}): InitiativeCollectiveDecisionOutcomeType {
  if (input.status === "cancelled") {
    return "cancelled";
  }

  if (input.support > input.doNotSupport) {
    return "supported";
  }

  if (input.doNotSupport > input.support) {
    return "not_supported";
  }

  return "inconclusive";
}

export function buildCollectiveDecisionOutcomeSummary(input: {
  outcome: InitiativeCollectiveDecisionOutcomeType;
  support: number;
  doNotSupport: number;
  abstain: number;
  isFinal: boolean;
}): string {
  switch (input.outcome) {
    case "cancelled":
      return "This collective decision was cancelled. No outcome was produced.";
    case "supported":
      return input.isFinal
        ? `Supported with ${input.support} support vote(s) and ${input.doNotSupport} do not support vote(s). Abstain: ${input.abstain}.`
        : `Currently supported with ${input.support} support vote(s) and ${input.doNotSupport} do not support vote(s). Abstain: ${input.abstain}.`;
    case "not_supported":
      return input.isFinal
        ? `Not supported with ${input.doNotSupport} do not support vote(s) and ${input.support} support vote(s). Abstain: ${input.abstain}.`
        : `Currently not supported with ${input.doNotSupport} do not support vote(s) and ${input.support} support vote(s). Abstain: ${input.abstain}.`;
    case "inconclusive":
      return input.isFinal
        ? `Inconclusive with ${input.support} support and ${input.doNotSupport} do not support vote(s). Abstain: ${input.abstain}.`
        : `Currently inconclusive with ${input.support} support and ${input.doNotSupport} do not support vote(s). Abstain: ${input.abstain}.`;
  }
}

export function buildTransparentCollectiveDecisionResults(input: {
  status: InitiativeCollectiveDecisionStatus;
  aggregates: InitiativeDecisionVoteAggregates;
}): CollectiveDecisionTransparentResults {
  const totalVotes = input.aggregates.total.totalVotes;
  const verifiedVotes = input.aggregates.verified.totalVotes;
  const unverifiedVotes = input.aggregates.unverified.totalVotes;
  const participationConfidenceLevel = computeParticipationConfidenceLevel({
    totalVotes,
    verifiedVotes,
  });

  const statistics: InitiativeCollectiveDecisionStatistics = {
    eligibleParticipantCount: 0,
    registeredEligibleCount: 0,
    totalVotesCast: totalVotes,
    verifiedVotesCast: verifiedVotes,
    unverifiedVotesCast: unverifiedVotes,
    supportCount: input.aggregates.total.support,
    doNotSupportCount: input.aggregates.total.doNotSupport,
    abstainCount: input.aggregates.total.abstain,
    verifiedSupportCount: input.aggregates.verified.support,
    verifiedDoNotSupportCount: input.aggregates.verified.doNotSupport,
    verifiedAbstainCount: input.aggregates.verified.abstain,
    unverifiedSupportCount: input.aggregates.unverified.support,
    unverifiedDoNotSupportCount: input.aggregates.unverified.doNotSupport,
    unverifiedAbstainCount: input.aggregates.unverified.abstain,
    participationRate: null,
    participationConfidence: null,
  };

  const outcomeType = calculateCollectiveDecisionOutcomeType({
    status: input.status,
    support: input.aggregates.total.support,
    doNotSupport: input.aggregates.total.doNotSupport,
  });

  const isFinal = input.status === "closed" || input.status === "cancelled";
  const outcomeSummary = buildCollectiveDecisionOutcomeSummary({
    outcome: outcomeType,
    support: input.aggregates.total.support,
    doNotSupport: input.aggregates.total.doNotSupport,
    abstain: input.aggregates.total.abstain,
    isFinal,
  });

  const outcome: CollectiveDecisionPublicOutcome = {
    support: input.aggregates.total.support,
    doNotSupport: input.aggregates.total.doNotSupport,
    abstain: input.aggregates.total.abstain,
    verifiedStatistics: mapChoiceCounts(input.aggregates.verified),
    unverifiedStatistics: mapChoiceCounts(input.aggregates.unverified),
    participationConfidenceLevel,
    outcome: outcomeType,
    summary: outcomeSummary,
  };

  return {
    statistics,
    outcome,
    participationConfidenceLevel,
    outcomeSummary,
    transparencyNote: COLLECTIVE_DECISION_TRANSPARENCY_NOTE,
  };
}
