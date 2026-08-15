/**
 * Initiative Lifecycle — Part D, Section 8/9 (Community Reactions).
 *
 * Mirrors `InitiativeAnalysisReaction` exactly (same "one row per actor x
 * target, changeable, `none` deletes" upsert semantics, same
 * representative-statistics-only framing), scoped to one individual
 * `InitiativeStructuredProposal` rather than to a whole
 * `InitiativeImprovementProposalsCollection` — Part 8/9 says "Support
 * Proposal / Do Not Support Proposal", i.e. per published proposal, since
 * a single collection publishes many proposals at once.
 */
export type InitiativeProposalReactionKind = "support" | "do_not_support";

export interface InitiativeProposalReaction {
  reactionId: string;
  proposalId: string;
  collectionId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeProposalReactionKind;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeProposalReactionSummary {
  support: number;
  doNotSupport: number;
  currentUserReaction: InitiativeProposalReactionKind | "none";
}
