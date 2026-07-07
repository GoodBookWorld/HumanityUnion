import type { CivicActionPackageId, CivicActionPackageStatus } from "./civic-action-package.js";
import type {
  InitiativeCollectiveDecisionId,
  InitiativeCollectiveDecisionOutcomeType,
  InitiativeCollectiveDecisionVoteCohortStatistics,
  ParticipationScope,
} from "./initiative-collective-decision.js";
import type { InitiativeId } from "./initiative.js";

export interface CivicActionPackageMetrics {
  capCount: number;
  issuedCapCount: number;
  archivedCapCount: number;
}

export interface PublicCivicActionPackageReferenceLinks {
  initiativeUrl: string;
  decisionUrl: string;
  decisionSessionUrl: string;
  civicCompatibilityReviewUrl: string | null;
}

export interface PublicCivicActionPackageListItem {
  capId: CivicActionPackageId;
  capNumber: number;
  capVersion: number;
  status: CivicActionPackageStatus;
  title: string;
  summary: string;
  issuedAt: string;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  decisionQuestion: string;
  participationScope: ParticipationScope;
}

/** Public projection — no participantId, voteId, or individual votes. */
export interface PublicCivicActionPackageProjection {
  capId: CivicActionPackageId;
  capNumber: number;
  capVersion: number;
  status: CivicActionPackageStatus;
  issuedAt: string;
  title: string;
  summary: string;
  participationScope: ParticipationScope;
  country: string;
  region?: string;
  community?: string;
  initiativeId: InitiativeId;
  initiativeTitle: string;
  initiativeVersion: number;
  decisionId: InitiativeCollectiveDecisionId;
  decisionQuestion: string;
  decisionOutcome: InitiativeCollectiveDecisionOutcomeType;
  decisionResultSummary: string;
  support: number;
  doNotSupport: number;
  abstain: number;
  verifiedStatistics: InitiativeCollectiveDecisionVoteCohortStatistics;
  unverifiedStatistics: InitiativeCollectiveDecisionVoteCohortStatistics;
  collaborativeAnalysesCount: number;
  improvementProposalsCount: number;
  revisionCount: number;
  civicProcessSummary: string;
  transparencyNote: string;
  civicCompatibilityReviewId: string | null;
  civicCompatibilityReviewStatus: string | null;
  references: PublicCivicActionPackageReferenceLinks;
}
