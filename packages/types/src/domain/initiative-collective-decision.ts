import type { DecisionSessionId } from "./decision-session.js";
import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

/** TASK-025 Collective Decision identifier. */
export type InitiativeCollectiveDecisionId = string;

/** Public decision lifecycle after Decision Session (Capability 02). */
export type InitiativeCollectiveDecisionStatus = "draft" | "opened" | "closed" | "cancelled";

/** Geographic participation boundary for eligibility (TASK-025). */
export type ParticipationScope = "world" | "country" | "region" | "community";

export const INITIATIVE_COLLECTIVE_DECISION_TRANSITIONS: Record<
  InitiativeCollectiveDecisionStatus,
  readonly InitiativeCollectiveDecisionStatus[]
> = {
  draft: ["opened", "cancelled"],
  opened: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export function canTransitionInitiativeCollectiveDecision(
  from: InitiativeCollectiveDecisionStatus,
  to: InitiativeCollectiveDecisionStatus,
): boolean {
  return INITIATIVE_COLLECTIVE_DECISION_TRANSITIONS[from].includes(to);
}

export function isInitiativeCollectiveDecisionTerminal(
  status: InitiativeCollectiveDecisionStatus,
): boolean {
  return status === "closed" || status === "cancelled";
}

/** Vote breakdown for one verification cohort. Structure only — no tally in TASK-026. */
export interface InitiativeCollectiveDecisionVoteCohortStatistics {
  support: number;
  doNotSupport: number;
  abstain: number;
  totalVotes: number;
}

export type InitiativeCollectiveDecisionOutcomeType =
  "supported" | "not_supported" | "inconclusive" | "cancelled";

/** Decision Outcome structure (TASK-025). Populated by future tally implementation. */
export interface InitiativeCollectiveDecisionOutcome {
  support: number;
  doNotSupport: number;
  abstain: number;
  verifiedStatistics: InitiativeCollectiveDecisionVoteCohortStatistics;
  unverifiedStatistics: InitiativeCollectiveDecisionVoteCohortStatistics;
  participationConfidence: number | null;
  outcome: InitiativeCollectiveDecisionOutcomeType;
}

/** Transparent participation aggregates (TASK-025). Structure only in TASK-026. */
export interface InitiativeCollectiveDecisionStatistics {
  eligibleParticipantCount: number;
  registeredEligibleCount: number;
  totalVotesCast: number;
  verifiedVotesCast: number;
  unverifiedVotesCast: number;
  supportCount: number;
  doNotSupportCount: number;
  abstainCount: number;
  verifiedSupportCount: number;
  verifiedDoNotSupportCount: number;
  verifiedAbstainCount: number;
  unverifiedSupportCount: number;
  unverifiedDoNotSupportCount: number;
  unverifiedAbstainCount: number;
  participationRate: number | null;
  participationConfidence: number | null;
}

/** TASK-025 Collective Decision aggregate root. */
export interface InitiativeCollectiveDecision {
  decisionId: InitiativeCollectiveDecisionId;
  initiativeId: InitiativeId;
  decisionSessionId: DecisionSessionId;
  stewardId: MemberId;
  sequenceNumber: number;
  participationScope: ParticipationScope;
  status: InitiativeCollectiveDecisionStatus;
  question: string;
  openedAt?: string;
  closesAt: string;
  closedAt?: string;
  cancelledAt?: string;
  supersedesDecisionId?: InitiativeCollectiveDecisionId;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeCollectiveDecisionEligibility {
  eligible: boolean;
  reasons: string[];
  decisionSessionId?: DecisionSessionId;
  initiativeVersion: number;
}

export function createEmptyInitiativeCollectiveDecisionVoteCohortStatistics(): InitiativeCollectiveDecisionVoteCohortStatistics {
  return {
    support: 0,
    doNotSupport: 0,
    abstain: 0,
    totalVotes: 0,
  };
}

export function createEmptyInitiativeCollectiveDecisionOutcome(
  outcome: InitiativeCollectiveDecisionOutcomeType = "inconclusive",
): InitiativeCollectiveDecisionOutcome {
  return {
    support: 0,
    doNotSupport: 0,
    abstain: 0,
    verifiedStatistics: createEmptyInitiativeCollectiveDecisionVoteCohortStatistics(),
    unverifiedStatistics: createEmptyInitiativeCollectiveDecisionVoteCohortStatistics(),
    participationConfidence: null,
    outcome,
  };
}

export function createEmptyInitiativeCollectiveDecisionStatistics(): InitiativeCollectiveDecisionStatistics {
  return {
    eligibleParticipantCount: 0,
    registeredEligibleCount: 0,
    totalVotesCast: 0,
    verifiedVotesCast: 0,
    unverifiedVotesCast: 0,
    supportCount: 0,
    doNotSupportCount: 0,
    abstainCount: 0,
    verifiedSupportCount: 0,
    verifiedDoNotSupportCount: 0,
    verifiedAbstainCount: 0,
    unverifiedSupportCount: 0,
    unverifiedDoNotSupportCount: 0,
    unverifiedAbstainCount: 0,
    participationRate: null,
    participationConfidence: null,
  };
}
