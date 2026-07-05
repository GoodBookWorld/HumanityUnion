import type { InitiativeCollaborativeAnalysisId } from "./initiative-collaborative-analysis.js";
import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

export type InitiativeImprovementProposalId = string;

/** Structured improvement proposal lifecycle (Collective Intelligence). */
export type InitiativeImprovementProposalStatus =
  "draft" | "submitted" | "accepted" | "partially_accepted" | "declined" | "archived";

export type InitiativeImprovementProposalDecision = "accepted" | "partially_accepted" | "declined";

export interface InitiativeImprovementProposal {
  proposalId: InitiativeImprovementProposalId;
  initiativeId: InitiativeId;
  analysisId: InitiativeCollaborativeAnalysisId;
  authorId: MemberId;
  targetSection: string;
  currentIssue: string;
  proposedChange: string;
  rationale: string;
  expectedImprovement: string;
  references: string;
  status: InitiativeImprovementProposalStatus;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decisionNote?: string;
}
