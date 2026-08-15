import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeId } from "./initiative.js";
import type {
  InitiativeImplementationCommitmentId,
  InitiativeImplementationCommitmentStatus,
} from "./initiative-implementation-commitment.js";
import type {
  ImplementationCommitmentTraceability,
  InitiativeImplementationCommitmentProposalStatus,
} from "./initiative-implementation-commitment-lifecycle.js";

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
  /** Initiative Lifecycle — Part I. */
  packageId: string | null;
  approvedAction: string | null;
  actionIndex: number | null;
  proposalStatus: InitiativeImplementationCommitmentProposalStatus | null;
  suggestedResponsibleRole: string | null;
  priority: string | null;
  requiredResources: readonly string[];
  relatedRisks: readonly string[];
  references: readonly string[];
  traceability: ImplementationCommitmentTraceability | null;
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
  packageId: string | null;
  approvedAction: string | null;
  proposalStatus: InitiativeImplementationCommitmentProposalStatus | null;
  priority: string | null;
}

export interface InitiativeImplementationCommitmentMetrics {
  commitmentCount: number;
  publishedCommitments: number;
  completedCommitments: number;
  withdrawnCommitments: number;
}
