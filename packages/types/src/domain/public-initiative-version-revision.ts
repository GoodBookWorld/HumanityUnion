import type { InitiativeId } from "./initiative.js";
import type { InitiativeVersionRevisionId } from "./initiative-version-revision.js";
import type { InitiativeImprovementProposalId } from "./initiative-improvement-proposal.js";

export interface PublicInitiativeVersionRevisionListItem {
  revisionId: InitiativeVersionRevisionId;
  version: number;
  revisionSummary: string;
  authorDisplayName: string;
  publishedAt: string;
  isCurrent: boolean;
}

export interface PublicInitiativeVersionRevisionProjection {
  revisionId: InitiativeVersionRevisionId;
  initiativeId: InitiativeId;
  version: number;
  previousVersion: number | null;
  revisionSummary: string;
  title: string;
  description: string;
  authorDisplayName: string;
  publishedAt: string;
  isCurrent: boolean;
  acceptedProposalIds: InitiativeImprovementProposalId[];
  partiallyAcceptedProposalIds: InitiativeImprovementProposalId[];
  declinedProposalIds: InitiativeImprovementProposalId[];
}

export interface InitiativeRevisionMetrics {
  revisionCount: number;
  acceptedProposalImplementationRate: number;
  averageAcceptedPerRevision: number;
  averageRevisionIntervalDays: number | null;
  implementedProposalCount: number;
}

export interface PublicInitiativeWithVersionHistory {
  currentVersion: number;
  revisions: PublicInitiativeVersionRevisionListItem[];
  metrics: InitiativeRevisionMetrics;
}
