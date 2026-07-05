import type { InitiativeCollaborativeAnalysisId } from "./initiative-collaborative-analysis.js";
import type { InitiativeId } from "./initiative.js";
import type { InitiativeImprovementProposalId } from "./initiative-improvement-proposal.js";
import type { InitiativeVersionRevisionId } from "./initiative-version-revision.js";
import type { MemberId } from "./member.js";

export type DecisionSessionId = string;

/** Structured decision preparation lifecycle (Collective Intelligence). */
export type DecisionSessionStatus = "draft" | "published" | "closed" | "archived";

/** Reference-only decision package captured at publish time. */
export interface DecisionSessionPackageReferences {
  revisionIds: InitiativeVersionRevisionId[];
  analysisIds: InitiativeCollaborativeAnalysisId[];
  proposalIds: InitiativeImprovementProposalId[];
}

export interface DecisionSession {
  sessionId: DecisionSessionId;
  initiativeId: InitiativeId;
  initiativeVersion: number;
  stewardId: MemberId;
  title: string;
  purpose: string;
  decisionQuestion: string;
  status: DecisionSessionStatus;
  opensAt: string;
  closesAt: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  closedAt?: string;
  packageReferences?: DecisionSessionPackageReferences;
}

export interface DecisionSessionEligibility {
  eligible: boolean;
  reasons: string[];
  initiativeVersion: number;
  publishedAnalysisCount: number;
  stewardReviewedProposalCount: number;
}
