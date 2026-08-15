import type {
  CreateInitiativeCommentInput,
  InitiativeComment,
  InitiativeCommentListResult,
  PublicCommentAuthor,
  PublicInitiativeDiscussionComment,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  validateDirectInitiativeAncestry,
  type InitiativeExistenceChecker,
} from "../../shared/initiative-ancestry/index.js";
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

/**
 * Initiative Ancestry — Recovery Task 05.
 *
 * Initiative Comments use DIRECT Initiative ancestry: a comment stores its
 * own `initiativeId` and never derives it transitively through another
 * civic artifact. Per ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md, this
 * service — not the Express route — is the enforcement boundary for that
 * invariant: `createInitiativeComment` validates ancestry itself, so a
 * comment cannot be persisted without a validated `initiativeId` regardless
 * of whether the caller is the HTTP route or a direct (e.g. test, future
 * internal) invocation. Routes remain useful for request-shape parsing,
 * authentication, and product-level eligibility gating, but are not trusted
 * as the sole invariant boundary.
 *
 * Persistence is unchanged: comments continue to store a plain `initiativeId`
 * string (see `@hu/types` `InitiativeComment`), not a nested ancestry object.
 * The validated ancestry result is used only to source that field, making it
 * evident that the persisted value came from a checked Initiative rather than
 * unchecked caller input. This module does not become a second civic root —
 * it depends on Initiative, it does not duplicate it.
 */
export interface InitiativeCommentAncestryDependencies {
  readonly initiativeExistenceChecker: InitiativeExistenceChecker;
}

/**
 * Default existence checker: an Initiative "exists" for comment-ancestry
 * purposes only if it is both present and currently eligible for public
 * exposure. This intentionally folds in the same eligibility rule the route
 * previously checked separately (`canExposePublicInitiativeProjection`), so
 * that a single Initiative lookup here serves both the ancestry invariant
 * and the pre-existing product rule, rather than requiring two lookups (one
 * in the route, one in the service) for a single comment creation.
 */
const defaultInitiativeCommentAncestryDependencies: InitiativeCommentAncestryDependencies = {
  initiativeExistenceChecker: {
    initiativeExists(initiativeId) {
      const initiative = getInitiativeById(initiativeId);
      return initiative !== null && canExposePublicInitiativeProjection(initiative);
    },
  },
};

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
  deps: InitiativeCommentAncestryDependencies = defaultInitiativeCommentAncestryDependencies,
): Promise<InitiativeComment> {
  // Enforcement boundary: this validates Initiative ancestry before any
  // persistence is attempted, regardless of caller. See module doc above.
  const ancestry = await validateDirectInitiativeAncestry(
    { initiativeId: input.initiativeId },
    deps.initiativeExistenceChecker,
  );

  // Safety Architecture Pack 01 — Discussion surface. Rejected content never
  // reaches storage, Stage Intelligence, or notification fan-out.
  const { assertLifecycleContentSafe } = await import("../lifecycle-safety/index.js");
  await assertLifecycleContentSafe({
    surfaceId: "discussion",
    initiativeId: ancestry.initiativeId,
    actorParticipantId: null,
    text: input.body,
    fieldName: "body",
  });

  const persistedInput: CreateInitiativeCommentInput = {
    ...input,
    // Persisted initiativeId is sourced from the validated ancestry result,
    // not directly from unchecked caller input.
    initiativeId: ancestry.initiativeId,
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
  deps?: InitiativeCommentAncestryDependencies,
): Promise<InitiativeComment> {
  const comment = await createInitiativeComment(input, deps);

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
  /**
   * UX Evolution Pack 02.3 — the raw (un-projected) comments backing
   * `initialComments`, exposed so a caller can additively attach
   * per-comment collaboration state (see
   * `attachCollaborationStateToComments`) without a second Initiative
   * comment query. Internal-only: never part of the public
   * `PublicInitiativeDiscussionSummary` response shape, so it must be
   * stripped before this result reaches an HTTP response.
   */
  rawComments: InitiativeComment[];
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
    rawComments: listing.comments,
  };
}
