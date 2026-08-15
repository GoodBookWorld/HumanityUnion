import { randomUUID } from "node:crypto";

import type {
  AuthRole,
  BlogComment,
  BlogReactionKind,
  BlogReactionSummary,
  PublicBlogComment,
  PublicBlogCommentListResponse,
} from "@hu/types";

import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { evaluateLifecycleSafety } from "../lifecycle-safety/lifecycle-safety.service.js";
import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { resolveBlogPublicAuthor } from "./blog-author-identity.js";
import { emitBlogCommentNotifications } from "./blog-comment-notifications.js";
import {
  BlogCommentAccessDeniedError,
  BlogCommentConflictError,
  BlogCommentNotFoundError,
  BlogCommentRateLimitError,
  BlogCommentValidationError,
} from "./blog-interaction.errors.js";
import {
  BlogSafetyNeedsReviewError,
  BlogSafetyRejectedError,
  BlogNotFoundError,
} from "./blog.errors.js";
import { canEditorialPublish, resolveBlogCapabilities } from "./blog-permissions.js";
import {
  countVisibleBlogComments,
  findBlogCommentById,
  insertBlogComment,
  listPendingBlogCommentsByPost,
  listPublicTopLevelBlogComments,
  listVisibleRepliesForParents,
  replaceBlogComment,
} from "./persistence/blog-comment.repository.js";
import {
  getBlogReactionSummary,
  resetBlogReactionRateLimitsForTests,
  setBlogReaction,
} from "./persistence/blog-reaction.repository.js";
import { findBlogPostById, findBlogPostBySlug } from "./persistence/blog.repository.js";

const MAX_COMMENT_LENGTH = 2000;
const MIN_COMMENT_INTERVAL_MS = 5000;
const DEFAULT_COMMENT_LIMIT = 40;
const MAX_COMMENT_LIMIT = 100;

const lastCommentAtByActor = new Map<string, number>();

export function resetBlogCommentRateLimitsForTests(): void {
  lastCommentAtByActor.clear();
}

export function resetBlogInteractionRateLimitsForTests(): void {
  lastCommentAtByActor.clear();
  resetBlogReactionRateLimitsForTests();
}

function assertCommentRateLimit(actorParticipantId: string): void {
  const last = lastCommentAtByActor.get(actorParticipantId) ?? 0;
  if (Date.now() - last < MIN_COMMENT_INTERVAL_MS) {
    throw new BlogCommentRateLimitError();
  }
}

function normalizeCommentContent(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new BlogCommentValidationError("Comment content is required.");
  }
  const withoutHtml = raw.replace(/<[^>]*>/g, "");
  const normalized = withoutHtml.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new BlogCommentValidationError("Comment content cannot be empty.");
  }
  if (normalized.length > MAX_COMMENT_LENGTH) {
    throw new BlogCommentValidationError(
      `Comment must be at most ${MAX_COMMENT_LENGTH} characters.`,
    );
  }
  return normalized;
}

async function requirePublishedPostBySlug(slug: string) {
  const post = await findBlogPostBySlug(slug);
  if (!post || post.status !== "published") {
    throw new BlogNotFoundError("Published Blog post not found.");
  }
  return post;
}

async function requirePublishedPostById(postId: string) {
  const post = await findBlogPostById(postId);
  if (!post || post.status !== "published") {
    throw new BlogNotFoundError("Published Blog post not found.");
  }
  return post;
}

async function resolveAuthorSnapshot(participantId: string): Promise<string> {
  const authUser = await findAuthUserByMemberId(participantId);
  return (authUser?.displayName ?? "Participant").trim() || "Participant";
}

function toPublicComment(input: {
  comment: BlogComment;
  author: Awaited<ReturnType<typeof resolveBlogPublicAuthor>>;
  replies?: readonly PublicBlogComment[];
}): PublicBlogComment {
  const removed = input.comment.status === "removed";
  return {
    commentId: input.comment.commentId,
    author: input.author,
    content: removed ? "" : input.comment.content,
    removed,
    createdAt: input.comment.createdAt,
    editedAt: removed ? undefined : input.comment.editedAt,
    replies: input.replies ? [...input.replies] : [],
  };
}

export async function listPublicBlogComments(input: {
  slug: string;
  limit?: number;
  offset?: number;
}): Promise<PublicBlogCommentListResponse> {
  const post = await requirePublishedPostBySlug(input.slug);
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_COMMENT_LIMIT, 1), MAX_COMMENT_LIMIT);
  const offset = Math.max(input.offset ?? 0, 0);

  const listing = await listPublicTopLevelBlogComments({
    postId: post.postId,
    limit,
    offset,
  });

  const topLevel = listing.items;
  const topIds = topLevel.map((comment) => comment.commentId);
  const replies = await listVisibleRepliesForParents({
    postId: post.postId,
    parentCommentIds: topIds,
  });

  const authorIds = new Set<string>();
  for (const comment of [...topLevel, ...replies]) {
    authorIds.add(comment.authorParticipantId);
  }

  const authors = new Map<
    string,
    Awaited<ReturnType<typeof resolveBlogPublicAuthor>>
  >();
  await Promise.all(
    [...authorIds].map(async (participantId) => {
      const snapshot =
        [...topLevel, ...replies].find((c) => c.authorParticipantId === participantId)
          ?.authorDisplayNameSnapshot ?? "Participant";
      authors.set(
        participantId,
        await resolveBlogPublicAuthor({
          authorParticipantId: participantId,
          authorDisplayNameSnapshot: snapshot,
        }),
      );
    }),
  );

  const repliesByParent = new Map<string, PublicBlogComment[]>();
  for (const reply of replies) {
    const parentId = reply.parentCommentId!;
    const list = repliesByParent.get(parentId) ?? [];
    list.push(
      toPublicComment({
        comment: reply,
        author: authors.get(reply.authorParticipantId)!,
      }),
    );
    repliesByParent.set(parentId, list);
  }

  const comments = topLevel.map((comment) =>
    toPublicComment({
      comment,
      author: authors.get(comment.authorParticipantId)!,
      replies: repliesByParent.get(comment.commentId) ?? [],
    }),
  );

  return {
    comments,
    total: listing.total,
    limit,
    offset,
    hasMore: offset + listing.items.length < listing.total,
  };
}

export async function createBlogComment(input: {
  slug: string;
  actorParticipantId: string;
  content: unknown;
  parentCommentId?: string;
}): Promise<{ comment: BlogComment; publicMessage?: string }> {
  const post = await requirePublishedPostBySlug(input.slug);
  const content = normalizeCommentContent(input.content);
  assertCommentRateLimit(input.actorParticipantId);

  let parentCommentId: string | undefined;
  if (input.parentCommentId) {
    const parent = await findBlogCommentById(input.parentCommentId);
    if (!parent || parent.postId !== post.postId) {
      throw new BlogCommentValidationError("Reply parent must belong to this publication.");
    }
    if (parent.parentCommentId) {
      throw new BlogCommentValidationError("Replies cannot be nested more than one level.");
    }
    if (parent.status === "removed") {
      throw new BlogCommentConflictError("Cannot reply to a removed comment.");
    }
    parentCommentId = parent.commentId;
  }

  const safety = await evaluateLifecycleSafety({
    surfaceId: "blog_comment",
    initiativeId: null,
    actorParticipantId: input.actorParticipantId,
    text: content,
    fieldName: "blog_comment",
  });

  if (safety.outcome === "rejected") {
    throw new BlogSafetyRejectedError(
      safety,
      "This comment cannot be posted in its current form.",
    );
  }

  const now = new Date().toISOString();
  const status = safety.outcome === "needs_review" ? "pending_review" : "visible";
  const comment: BlogComment = {
    commentId: `blog-cmt-${randomUUID()}`,
    postId: post.postId,
    authorParticipantId: input.actorParticipantId,
    authorDisplayNameSnapshot: await resolveAuthorSnapshot(input.actorParticipantId),
    content,
    status,
    moderationState: "none",
    safetyOutcome: safety.outcome,
    parentCommentId,
    createdAt: now,
    updatedAt: now,
  };

  await insertBlogComment(comment);
  lastCommentAtByActor.set(input.actorParticipantId, Date.now());

  if (status === "visible") {
    await emitBlogCommentNotifications({
      comment,
      actorParticipantId: input.actorParticipantId,
    });
  }

  return {
    comment,
    publicMessage:
      status === "pending_review" ? "Your comment is awaiting review." : undefined,
  };
}

export async function editBlogComment(input: {
  commentId: string;
  actorParticipantId: string;
  content: unknown;
}): Promise<{ comment: BlogComment; publicMessage?: string }> {
  const existing = await findBlogCommentById(input.commentId);
  if (!existing) {
    throw new BlogCommentNotFoundError();
  }
  if (existing.authorParticipantId !== input.actorParticipantId) {
    throw new BlogCommentAccessDeniedError("You can only edit your own comments.");
  }
  if (existing.status === "removed") {
    throw new BlogCommentConflictError("Removed comments cannot be edited.");
  }

  await requirePublishedPostById(existing.postId);
  const content = normalizeCommentContent(input.content);

  const safety = await evaluateLifecycleSafety({
    surfaceId: "blog_comment",
    initiativeId: null,
    actorParticipantId: input.actorParticipantId,
    text: content,
    fieldName: "blog_comment",
  });

  if (safety.outcome === "rejected") {
    throw new BlogSafetyRejectedError(
      safety,
      "This edit cannot be saved in its current form.",
    );
  }

  const now = new Date().toISOString();
  const status = safety.outcome === "needs_review" ? "pending_review" : "visible";
  const updated: BlogComment = {
    ...existing,
    content,
    status,
    safetyOutcome: safety.outcome,
    updatedAt: now,
    editedAt: now,
  };
  await replaceBlogComment(updated);

  return {
    comment: updated,
    publicMessage:
      status === "pending_review" ? "Your comment is awaiting review." : undefined,
  };
}

export async function deleteOwnBlogComment(input: {
  commentId: string;
  actorParticipantId: string;
}): Promise<BlogComment> {
  const existing = await findBlogCommentById(input.commentId);
  if (!existing) {
    throw new BlogCommentNotFoundError();
  }
  if (existing.authorParticipantId !== input.actorParticipantId) {
    throw new BlogCommentAccessDeniedError("You can only remove your own comments.");
  }
  if (existing.status === "removed") {
    return existing;
  }

  const now = new Date().toISOString();
  const updated: BlogComment = {
    ...existing,
    status: "removed",
    deletedAt: now,
    updatedAt: now,
    removedByParticipantId: input.actorParticipantId,
  };
  await replaceBlogComment(updated);
  return updated;
}

/** Editor/Admin moderation removal — not available to ordinary Authors by post ownership. */
export async function moderateRemoveBlogComment(input: {
  commentId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogComment> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  if (!canEditorialPublish(capabilities)) {
    throw new BlogCommentAccessDeniedError(
      "Editor capability is required to moderate Blog comments.",
    );
  }

  const existing = await findBlogCommentById(input.commentId);
  if (!existing) {
    throw new BlogCommentNotFoundError();
  }
  if (existing.status === "removed") {
    return existing;
  }

  const now = new Date().toISOString();
  const updated: BlogComment = {
    ...existing,
    status: "removed",
    moderationState: "reviewed",
    deletedAt: now,
    updatedAt: now,
    removedByParticipantId: input.actorParticipantId,
  };
  await replaceBlogComment(updated);

  recordAdministrationAuditBestEffort({
    actorParticipantId: input.actorParticipantId,
    action: "blog.comment.moderate",
    targetType: "blog_comment",
    targetId: updated.commentId,
    scope: { scopeType: "blog", scopeId: updated.postId },
    afterSummary: "status=removed",
  });

  return updated;
}

/** Minimal moderation seam — list pending_review comments for a post (Editor/Admin). */
export async function listPendingBlogCommentsForModeration(input: {
  postId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogComment[]> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  if (!canEditorialPublish(capabilities)) {
    throw new BlogCommentAccessDeniedError(
      "Editor capability is required to review pending Blog comments.",
    );
  }

  return listPendingBlogCommentsByPost(input.postId);
}

/** Editor/Admin may accept a pending_review comment into public visibility. */
export async function approvePendingBlogComment(input: {
  commentId: string;
  actorParticipantId: string;
  role?: AuthRole;
}): Promise<BlogComment> {
  const capabilities = await resolveBlogCapabilities({
    participantId: input.actorParticipantId,
    role: input.role,
  });
  if (!canEditorialPublish(capabilities)) {
    throw new BlogCommentAccessDeniedError(
      "Editor capability is required to approve pending Blog comments.",
    );
  }

  const existing = await findBlogCommentById(input.commentId);
  if (!existing) {
    throw new BlogCommentNotFoundError();
  }
  if (existing.status !== "pending_review") {
    throw new BlogCommentConflictError("Only pending comments can be approved.");
  }

  const now = new Date().toISOString();
  const updated: BlogComment = {
    ...existing,
    status: "visible",
    moderationState: "reviewed",
    updatedAt: now,
  };
  await replaceBlogComment(updated);
  await emitBlogCommentNotifications({
    comment: updated,
    actorParticipantId: updated.authorParticipantId,
  });
  return updated;
}

export async function setBlogPostReaction(input: {
  slug: string;
  actorParticipantId: string;
  reaction: BlogReactionKind | "none";
}): Promise<BlogReactionSummary> {
  const post = await requirePublishedPostBySlug(input.slug);
  if (input.reaction !== "none" && input.reaction !== "helpful" && input.reaction !== "not_helpful") {
    throw new BlogCommentValidationError("reaction must be helpful, not_helpful, or none.");
  }
  await setBlogReaction({
    postId: post.postId,
    actorParticipantId: input.actorParticipantId,
    reaction: input.reaction,
  });
  return getBlogReactionSummary({
    postId: post.postId,
    actorParticipantId: input.actorParticipantId,
  });
}

export async function getBlogPostReactionSummary(input: {
  postId: string;
  actorParticipantId?: string | null;
}): Promise<BlogReactionSummary> {
  return getBlogReactionSummary(input);
}

export async function getVisibleBlogCommentCount(postId: string): Promise<number> {
  return countVisibleBlogComments(postId);
}

export function projectOwnCommentCreateResponse(input: {
  comment: BlogComment;
  publicMessage?: string;
}): {
  commentId: string;
  status: BlogComment["status"];
  parentCommentId?: string;
  createdAt: string;
  message?: string;
} {
  return {
    commentId: input.comment.commentId,
    status: input.comment.status,
    parentCommentId: input.comment.parentCommentId,
    createdAt: input.comment.createdAt,
    message: input.publicMessage,
  };
}

// Re-export for tests that exercise needs_review messaging without public leak.
export { BlogSafetyNeedsReviewError };
