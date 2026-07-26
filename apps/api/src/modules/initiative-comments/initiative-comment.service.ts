import type {
  CreateInitiativeCommentInput,
  InitiativeComment,
  InitiativeCommentListResult,
  PublicCommentAuthor,
  PublicInitiativeDiscussionComment,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import {
  createInitiativeComment as createMemoryComment,
  deleteInitiativeComment as deleteMemoryComment,
  getInitiativeCommentById as getMemoryInitiativeCommentById,
  listApprovedInitiativeComments as listMemoryComments,
  resetInitiativeCommentRateLimitsMemoryForTests,
  resetInitiativeCommentStoreForTests,
} from "./initiative-comment.memory.store.js";
import {
  createInitiativeCommentMongo,
  deleteInitiativeCommentMongo,
  deleteInitiativeCommentsByIdPrefix,
  getApprovedInitiativeCommentByIdMongo,
  listApprovedInitiativeCommentsMongo,
  resetInitiativeCommentRateLimitsForTests,
} from "./initiative-comment.mongo.repository.js";
import {
  INITIATIVE_COMMENT_PERSISTENCE_KEY,
  isEngagementMongoMode,
} from "../../infrastructure/mongodb/resolve-engagement-persistence.js";
import { getInitiativeCommentReactionSummaries } from "../initiative-comment-reactions/initiative-comment-reaction.service.js";
import { resolvePublicCommentAuthorsForComments } from "./public-comment-author.projection.js";
import { emitInitiativeCommentNotifications } from "../notifications/initiative-comment-notifications.service.js";

function isMongoMode(): boolean {
  return isEngagementMongoMode(INITIATIVE_COMMENT_PERSISTENCE_KEY);
}

export function isInitiativeCommentMongoMode(): boolean {
  return isMongoMode();
}

export function resetInitiativeCommentsForTests(): void {
  resetInitiativeCommentStoreForTests();
  resetInitiativeCommentRateLimitsForTests();
  resetInitiativeCommentRateLimitsMemoryForTests();
}

export async function resetInitiativeCommentsMongoForTests(prefix: string): Promise<void> {
  if (!isMongoMode()) {
    resetInitiativeCommentsForTests();
    return;
  }

  await deleteInitiativeCommentsByIdPrefix(prefix);
  resetInitiativeCommentRateLimitsForTests();
}

async function resolveCommentAuthorNameSnapshot(authorUserId: string): Promise<string> {
  try {
    const profile = await findMemberProfileByUserId(authorUserId);
    const profileName = profile?.displayName.trim();

    if (profile?.status === "active" && profileName) {
      return profileName;
    }
  } catch {
    // Fall through to auth snapshot when profile persistence is unavailable.
  }

  const authUser = await findAuthUserById(authorUserId);
  const authName = authUser?.displayName?.trim();

  if (authName) {
    return authName;
  }

  return "Participant";
}

export async function getInitiativeCommentById(commentId: string): Promise<InitiativeComment | null> {
  if (isMongoMode()) {
    return getApprovedInitiativeCommentByIdMongo(commentId);
  }

  const comment = getMemoryInitiativeCommentById(commentId);
  return comment?.status === "approved" ? comment : null;
}

export async function createInitiativeComment(
  input: Pick<
    CreateInitiativeCommentInput,
    "initiativeId" | "authorUserId" | "body" | "parentCommentId"
  >,
): Promise<InitiativeComment> {
  const persistedInput: CreateInitiativeCommentInput = {
    ...input,
    authorDisplayName: await resolveCommentAuthorNameSnapshot(input.authorUserId),
  };

  if (isMongoMode()) {
    return createInitiativeCommentMongo(persistedInput);
  }

  return createMemoryComment(persistedInput);
}

export async function createInitiativeCommentWithNotifications(
  input: Pick<
    CreateInitiativeCommentInput,
    "initiativeId" | "authorUserId" | "body" | "parentCommentId"
  > & { actorMemberId: string | null },
): Promise<InitiativeComment> {
  const comment = await createInitiativeComment(input);

  emitInitiativeCommentNotifications({
    comment,
    actorMemberId: input.actorMemberId,
  });

  return comment;
}

export async function listApprovedInitiativeComments(input: {
  initiativeId: string;
  limit?: number;
  offset?: number;
}): Promise<InitiativeCommentListResult> {
  if (isMongoMode()) {
    return listApprovedInitiativeCommentsMongo(input);
  }

  return listMemoryComments(input);
}

export async function deleteInitiativeComment(input: {
  commentId: string;
  authorUserId: string;
}): Promise<InitiativeComment | null> {
  if (isMongoMode()) {
    return deleteInitiativeCommentMongo(input);
  }

  return deleteMemoryComment(input);
}

export function toPublicInitiativeDiscussionComment(
  comment: InitiativeComment,
  author: PublicCommentAuthor,
  reactionSummary?: {
    likes: number;
    dislikes: number;
    currentUserReaction: "like" | "dislike" | "none";
  },
): PublicInitiativeDiscussionComment {
  return {
    commentId: comment.commentId,
    author,
    authorDisplayName: author.displayName,
    body: comment.body,
    createdAt: comment.createdAt,
    replyCount: comment.parentCommentId ? 0 : 0,
    likes: reactionSummary?.likes ?? 0,
    dislikes: reactionSummary?.dislikes ?? 0,
    currentUserReaction: reactionSummary?.currentUserReaction ?? "none",
  };
}

export async function mapCommentsToPublicDiscussionComments(
  comments: InitiativeComment[],
  userId?: string | null,
): Promise<PublicInitiativeDiscussionComment[]> {
  const [reactionSummaries, authorsByCommentId] = await Promise.all([
    getInitiativeCommentReactionSummaries({
      commentIds: comments.map((comment) => comment.commentId),
      actorUserId: userId,
    }),
    resolvePublicCommentAuthorsForComments(comments),
  ]);

  return comments.map((comment) =>
    toPublicInitiativeDiscussionComment(
      comment,
      authorsByCommentId.get(comment.commentId) ?? {
        displayName: comment.authorDisplayName.trim() || "Participant",
      },
      reactionSummaries.get(comment.commentId),
    ),
  );
}

export async function buildInitiativeDiscussionSummary(input: {
  initiativeId: string;
  userId?: string | null;
}): Promise<{
  commentCount: number;
  initialComments: PublicInitiativeDiscussionComment[];
  hasMoreComments: boolean;
  canComment: boolean;
  requiresLogin: boolean;
  commentsAvailable: boolean;
}> {
  const listing = await listApprovedInitiativeComments({
    initiativeId: input.initiativeId,
    limit: 40,
    offset: 0,
  });

  return {
    commentCount: listing.total,
    initialComments: await mapCommentsToPublicDiscussionComments(listing.comments, input.userId),
    hasMoreComments: listing.hasMore,
    canComment: Boolean(input.userId),
    requiresLogin: !input.userId,
    commentsAvailable: true,
  };
}
