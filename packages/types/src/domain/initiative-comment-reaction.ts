export type InitiativeCommentReactionKind = "like" | "dislike";

export interface InitiativeCommentReaction {
  reactionId: string;
  commentId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeCommentReactionKind;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeCommentReactionSummary {
  likes: number;
  dislikes: number;
  currentUserReaction: InitiativeCommentReactionKind | "none";
}
