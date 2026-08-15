import type { InitiativeId } from "./initiative.js";
import type {
  InitiativeRevisionChangeOrigin,
  InitiativeRevisionChangeSection,
  InitiativeVersionRevisionId,
} from "./initiative-version-revision.js";
import type { InitiativeImprovementProposalId } from "./initiative-improvement-proposal.js";
import type { InitiativeRevisionReactionSummary } from "./initiative-revision-reaction.js";

export interface PublicInitiativeVersionRevisionListItem {
  revisionId: InitiativeVersionRevisionId;
  version: number;
  revisionSummary: string;
  authorDisplayName: string;
  publishedAt: string;
  isCurrent: boolean;
}

/**
 * Initiative Lifecycle — Part E, Section 7/9 (Before/After, Public
 * Presentation). Visitors see the full Before → After → Origin → Related
 * Proposal IDs → Author explanation chain for every changed section — "No
 * hidden edits" (Section 7).
 */
export interface PublicInitiativeRevisionChange {
  readonly changeId: string;
  readonly section: InitiativeRevisionChangeSection;
  readonly sectionLabel: string;
  readonly before: string;
  readonly after: string;
  readonly origin: InitiativeRevisionChangeOrigin;
  readonly proposalIds: readonly InitiativeImprovementProposalId[];
  readonly authorOriginatedReason: string | null;
  readonly explanation: string;
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
  /** Initiative Lifecycle — Part E, Section 7. `[]` for any revision published before Part E. */
  changes: readonly PublicInitiativeRevisionChange[];
  reactionSummary: InitiativeRevisionReactionSummary;
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
