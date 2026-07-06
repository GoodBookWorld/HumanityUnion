import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeId } from "./initiative.js";
import type {
  InitiativeImplementationCommitmentId,
  InitiativeImplementationCommitmentStatus,
} from "./initiative-implementation-commitment.js";

export interface PublicInitiativeImplementationCommitmentProjection {
  commitmentId: InitiativeImplementationCommitmentId;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  title: string;
  summary: string;
  organization?: string;
  authorDisplayName: string;
  commitmentScope: string;
  status: Exclude<InitiativeImplementationCommitmentStatus, "draft">;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
  publishedAt?: string;
  withdrawnAt?: string;
  completedAt?: string;
}

export interface PublicInitiativeImplementationCommitmentListItem {
  commitmentId: InitiativeImplementationCommitmentId;
  decisionId: InitiativeCollectiveDecisionId;
  title: string;
  summary: string;
  organization?: string;
  authorDisplayName: string;
  commitmentScope: string;
  status: Exclude<InitiativeImplementationCommitmentStatus, "draft">;
  expectedStartDate?: string;
  expectedCompletionDate?: string;
  publishedAt?: string;
  withdrawnAt?: string;
  completedAt?: string;
}

export interface InitiativeImplementationCommitmentMetrics {
  commitmentCount: number;
  publishedCommitments: number;
  completedCommitments: number;
  withdrawnCommitments: number;
}
