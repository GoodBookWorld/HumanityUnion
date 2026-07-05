import type { InitiativeCollaborativeAnalysisId } from "./initiative-collaborative-analysis.js";
import type { InitiativeId } from "./initiative.js";
import type {
  InitiativeImprovementProposalId,
  InitiativeImprovementProposalStatus,
} from "./initiative-improvement-proposal.js";

export interface PublicInitiativeImprovementProposalProjection {
  proposalId: InitiativeImprovementProposalId;
  initiativeId: InitiativeId;
  analysisId: InitiativeCollaborativeAnalysisId;
  targetSection: string;
  currentIssue: string;
  proposedChange: string;
  rationale: string;
  expectedImprovement: string;
  references: string;
  status: Exclude<InitiativeImprovementProposalStatus, "draft" | "archived">;
  authorDisplayName: string;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decisionNote?: string;
  implementedInVersion: number | null;
}

export interface PublicInitiativeImprovementProposalListItem {
  proposalId: InitiativeImprovementProposalId;
  targetSection: string;
  proposedChange: string;
  status: Exclude<InitiativeImprovementProposalStatus, "draft" | "archived">;
  authorDisplayName: string;
  updatedAt: string;
  decidedAt?: string;
  implementedInVersion: number | null;
}

export interface InitiativeImprovementProposalMetrics {
  submittedCount: number;
  acceptedCount: number;
  partiallyAcceptedCount: number;
  declinedCount: number;
}
