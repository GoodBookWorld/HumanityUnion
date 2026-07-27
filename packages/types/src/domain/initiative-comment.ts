export type InitiativeCommentStatus = "approved" | "pending" | "removed" | "rejected";

export type InitiativeCommentModerationState = "none" | "flagged" | "reviewed";

/** Public-safe comment author projection resolved at read time. */
export interface PublicCommentAuthor {
  publicUserId?: string;
  displayName: string;
  avatarUrl?: string;
  profileUrl?: string;
}

export interface InitiativeComment {
  commentId: string;
  initiativeId: string;
  authorUserId: string;
  authorDisplayName: string;
  body: string;
  status: InitiativeCommentStatus;
  moderationState: InitiativeCommentModerationState;
  parentCommentId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateInitiativeCommentInput {
  initiativeId: string;
  authorUserId: string;
  /** Fallback snapshot captured at post time; not used as canonical author identity. */
  authorDisplayName?: string;
  body: string;
  parentCommentId?: string;
}

export interface InitiativeCommentListResult {
  comments: InitiativeComment[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
