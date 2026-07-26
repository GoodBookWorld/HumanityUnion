import { randomUUID } from "node:crypto";

import type {
  CreateInitiativeCommentInput,
  InitiativeComment,
  InitiativeCommentListResult,
} from "@hu/types";

const comments = new Map<string, InitiativeComment>();

const MAX_COMMENT_LENGTH = 2000;
const MIN_POST_INTERVAL_MS = 5000;

const lastPostAtByUser = new Map<string, number>();

export function resetInitiativeCommentStoreForTests(): void {
  comments.clear();
  lastPostAtByUser.clear();
}

export function resetInitiativeCommentRateLimitsMemoryForTests(): void {
  lastPostAtByUser.clear();
}

function sanitizeCommentBody(body: string): string {
  return body.replace(/<[^>]*>/g, "").trim();
}

function assertValidBody(body: string): string {
  if (/[<>]/.test(body)) {
    throw new Error("Comment contains invalid characters.");
  }

  const sanitized = sanitizeCommentBody(body);

  if (!sanitized) {
    throw new Error("Comment cannot be empty.");
  }

  if (sanitized.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
  }

  if (/[<>]/.test(sanitized)) {
    throw new Error("Comment contains invalid characters.");
  }

  return sanitized;
}

function assertRateLimit(authorUserId: string): void {
  const lastPostAt = lastPostAtByUser.get(authorUserId) ?? 0;
  const elapsed = Date.now() - lastPostAt;

  if (elapsed < MIN_POST_INTERVAL_MS) {
    throw new Error("Please wait before trying again.");
  }
}

export function createInitiativeComment(input: CreateInitiativeCommentInput): InitiativeComment {
  assertRateLimit(input.authorUserId);

  const body = assertValidBody(input.body);
  const now = new Date().toISOString();
  const comment: InitiativeComment = {
    commentId: randomUUID(),
    initiativeId: input.initiativeId,
    authorUserId: input.authorUserId,
    authorDisplayName: input.authorDisplayName?.trim() || "Participant",
    body,
    status: "approved",
    moderationState: "none",
    parentCommentId: input.parentCommentId,
    createdAt: now,
    updatedAt: now,
  };

  comments.set(comment.commentId, comment);
  lastPostAtByUser.set(input.authorUserId, Date.now());

  return comment;
}

export function listApprovedInitiativeComments(input: {
  initiativeId: string;
  limit?: number;
  offset?: number;
}): InitiativeCommentListResult {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 40);
  const offset = Math.max(input.offset ?? 0, 0);

  const approved = Array.from(comments.values())
    .filter(
      (comment) => comment.initiativeId === input.initiativeId && comment.status === "approved",
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const page = approved.slice(offset, offset + limit);

  return {
    comments: page,
    total: approved.length,
    limit,
    offset,
    hasMore: offset + page.length < approved.length,
  };
}

export function getInitiativeCommentById(commentId: string): InitiativeComment | null {
  return comments.get(commentId) ?? null;
}

export function deleteInitiativeComment(input: {
  commentId: string;
  authorUserId: string;
}): InitiativeComment | null {
  const comment = comments.get(input.commentId);

  if (!comment || comment.authorUserId !== input.authorUserId) {
    return null;
  }

  const updated: InitiativeComment = {
    ...comment,
    status: "removed",
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  comments.set(updated.commentId, updated);
  return updated;
}

export function countApprovedInitiativeComments(initiativeId: string): number {
  return Array.from(comments.values()).filter(
    (comment) => comment.initiativeId === initiativeId && comment.status === "approved",
  ).length;
}
