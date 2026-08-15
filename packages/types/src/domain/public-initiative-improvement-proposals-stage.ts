import type { InitiativeStructuredProposalStatus } from "./initiative-improvement-proposals-stage.js";
import type { InitiativeProposalReactionSummary } from "./initiative-proposal-reaction.js";

/**
 * Initiative Lifecycle — Part D, Section 8 (Public Presentation).
 *
 * Visitors never see editing controls, draft status, or AI Assistant
 * output — only these fields, for `"published"` proposals from the
 * latest published collection (plus whatever later curation status —
 * `"included_in_revision"` / `"keep_for_later"` / `"not_applicable"` —
 * the Author has since applied; those remain publicly visible so a
 * visitor can see how a proposal was ultimately handled, exactly like
 * Collaborative Analysis's public status is never hidden after the fact).
 */
export interface PublicInitiativeStructuredProposal {
  readonly proposalId: string;
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly reason: string;
  readonly expectedImprovement: string;
  readonly supportingSources: string;
  readonly relatedDiscussionReferences: string;
  readonly originalAuthorDisplayNames: readonly string[];
  readonly status: InitiativeStructuredProposalStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly reactionSummary: InitiativeProposalReactionSummary;
}

export interface PublicInitiativeImprovementProposalsCollectionProjection {
  readonly collectionId: string;
  readonly initiativeId: string;
  readonly authorDisplayName: string;
  readonly publishedAt: string;
  readonly version: number;
  readonly proposals: readonly PublicInitiativeStructuredProposal[];
}
