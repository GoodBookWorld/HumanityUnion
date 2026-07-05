import type { InitiativeCollaborativeAnalysisId } from "./initiative-collaborative-analysis.js";
import type {
  InitiativeDescription,
  InitiativeId,
  InitiativeMetadata,
  InitiativeTitle,
} from "./initiative.js";
import type { InitiativeImprovementProposalId } from "./initiative-improvement-proposal.js";
import type { MemberId } from "./member.js";

export type InitiativeVersionRevisionId = string;

/** Published initiative version snapshot (Collective Intelligence revision cycle). */
export interface InitiativeVersionRevision {
  revisionId: InitiativeVersionRevisionId;
  initiativeId: InitiativeId;
  version: number;
  previousVersion: number | null;
  authorId: MemberId;
  createdAt: string;
  publishedAt: string;
  revisionSummary: string;
  title: InitiativeTitle;
  description: InitiativeDescription;
  metadata: InitiativeMetadata;
  acceptedProposalIds: InitiativeImprovementProposalId[];
  partiallyAcceptedProposalIds: InitiativeImprovementProposalId[];
  declinedProposalIds: InitiativeImprovementProposalId[];
}

/** Steward workspace draft before publishing a new initiative version. */
export interface InitiativeRevisionDraft {
  draftId: string;
  initiativeId: InitiativeId;
  authorId: MemberId;
  title: InitiativeTitle;
  description: InitiativeDescription;
  metadata: InitiativeMetadata;
  revisionSummary: string;
  appliedProposalIds: InitiativeImprovementProposalId[];
  skippedProposalIds: InitiativeImprovementProposalId[];
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeRevisionDraftContext {
  draft: InitiativeRevisionDraft | null;
  currentVersion: number;
  eligibleProposals: InitiativeRevisionEligibleProposal[];
  currentInitiative: {
    title: InitiativeTitle;
    description: InitiativeDescription;
    metadata: InitiativeMetadata;
  };
}

export interface InitiativeRevisionEligibleProposal {
  proposalId: InitiativeImprovementProposalId;
  analysisId: InitiativeCollaborativeAnalysisId;
  targetSection: string;
  proposedChange: string;
  status: "accepted" | "partially_accepted";
}
