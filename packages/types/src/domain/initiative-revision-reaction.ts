/**
 * Initiative Lifecycle — Part E, Section 9 (Public Presentation / Community
 * Reactions). Mirrors `InitiativeProposalReaction` exactly (same
 * one-row-per-actor-per-target, changeable, `"none"` deletes upsert
 * semantics, same representative-statistics-only framing) — scoped to one
 * whole published `InitiativeVersionRevision` rather than an individual
 * proposal, since Section 9 says "Support Revision / Do Not Support
 * Revision", i.e. a reaction on the Revision as a whole.
 */
export type InitiativeRevisionReactionKind = "support" | "do_not_support";

export interface InitiativeRevisionReaction {
  reactionId: string;
  revisionId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeRevisionReactionKind;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeRevisionReactionSummary {
  support: number;
  doNotSupport: number;
  currentUserReaction: InitiativeRevisionReactionKind | "none";
}
