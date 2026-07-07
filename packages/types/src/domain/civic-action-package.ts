import type {
  CivicCompatibilityReviewId,
  CivicCompatibilityStatus,
} from "./civic-compatibility-review.js";
import type { DecisionSessionId } from "./decision-session.js";
import type {
  InitiativeCollectiveDecisionId,
  InitiativeCollectiveDecisionOutcomeType,
  InitiativeCollectiveDecisionVoteCohortStatistics,
  ParticipationScope,
} from "./initiative-collective-decision.js";
import type { InitiativeId } from "./initiative.js";

/** TASK-039 Civic Action Package identifier. */
export type CivicActionPackageId = string;

/** Immutable public civic document lifecycle after collective decision close. */
export type CivicActionPackageStatus = "issued" | "archived";

export const CIVIC_ACTION_PACKAGE_TRANSITIONS: Record<
  CivicActionPackageStatus,
  readonly CivicActionPackageStatus[]
> = {
  issued: ["archived"],
  archived: [],
};

export function canTransitionCivicActionPackage(
  from: CivicActionPackageStatus,
  to: CivicActionPackageStatus,
): boolean {
  return CIVIC_ACTION_PACKAGE_TRANSITIONS[from].includes(to);
}

export function isCivicActionPackageTerminal(status: CivicActionPackageStatus): boolean {
  return status === "archived";
}

/** Reference-only civic history carried by the CAP — no duplicated entity payloads. */
export interface CivicActionPackageContent {
  initiativeId: InitiativeId;
  initiativeTitle: string;
  initiativeVersion: number;
  collaborativeAnalysesCount: number;
  improvementProposalsCount: number;
  revisionCount: number;
  decisionSessionId: DecisionSessionId;
  decisionSessionTitle: string;
  decisionId: InitiativeCollectiveDecisionId;
  decisionQuestion: string;
  decisionResultSummary: string;
  decisionOutcome: InitiativeCollectiveDecisionOutcomeType;
  verifiedStatistics: InitiativeCollectiveDecisionVoteCohortStatistics;
  unverifiedStatistics: InitiativeCollectiveDecisionVoteCohortStatistics;
  transparencyNote: string;
  civicCompatibilityReviewId?: CivicCompatibilityReviewId;
  civicCompatibilityReviewStatus?: CivicCompatibilityStatus;
  publicInitiativeUrl: string;
  publicDecisionUrl: string;
}

/** TASK-039 Civic Action Package aggregate root — one per closed collective decision. */
export interface CivicActionPackage {
  capId: CivicActionPackageId;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  issuedAt: string;
  capNumber: number;
  capVersion: number;
  status: CivicActionPackageStatus;
  title: string;
  summary: string;
  participationScope: ParticipationScope;
  country: string;
  region?: string;
  community?: string;
  content: CivicActionPackageContent;
  createdAt: string;
  updatedAt: string;
}
