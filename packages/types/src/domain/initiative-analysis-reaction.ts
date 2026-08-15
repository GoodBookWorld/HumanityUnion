/**
 * Initiative Lifecycle — Part B, Section 9 (Reaction Model).
 *
 * One reaction per participant per published Analysis, mirroring the
 * existing `InitiativeCommentReaction` upsert pattern exactly (same shape,
 * same "one row per actor x target, changeable, `none` deletes" semantics)
 * — this is deliberately NOT the Initiative-level Support signal (which
 * also allows anonymous visitor keys); Part B's explicit statement that
 * these are "representative statistics only, not a legal vote" matches
 * comment reactions' existing scope more closely than Initiative Support's.
 */
export type InitiativeAnalysisReactionKind = "support" | "do_not_support";

export interface InitiativeAnalysisReaction {
  reactionId: string;
  analysisId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeAnalysisReactionKind;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeAnalysisReactionSummary {
  support: number;
  doNotSupport: number;
  currentUserReaction: InitiativeAnalysisReactionKind | "none";
}
