import type { BlogEditorialHistoryAction, BlogEditorialHistoryEntry, BlogPost } from "@hu/types";

import { BlogConflictError, BlogValidationError } from "./blog.errors.js";

export function appendEditorialHistory(
  post: BlogPost,
  entry: BlogEditorialHistoryEntry,
): BlogEditorialHistoryEntry[] {
  return [...(post.editorialHistory ?? []), entry];
}

export function buildEditorialHistoryEntry(input: {
  at: string;
  actorParticipantId: string;
  action: BlogEditorialHistoryAction;
  reviewNote?: string;
  safetyOutcome?: BlogPost["safetyOutcome"];
  publishedVersion?: number;
  contentUpdatedAt?: string;
}): BlogEditorialHistoryEntry {
  return {
    at: input.at,
    actorParticipantId: input.actorParticipantId,
    action: input.action,
    reviewNote: input.reviewNote,
    safetyOutcome: input.safetyOutcome,
    publishedVersion: input.publishedVersion,
    contentUpdatedAt: input.contentUpdatedAt,
  };
}

/** Optimistic concurrency — Editor must act on the version they opened. */
export function assertExpectedUpdatedAt(
  post: BlogPost,
  expectedUpdatedAt: string | undefined,
): void {
  if (!expectedUpdatedAt) {
    return;
  }

  if (post.updatedAt !== expectedUpdatedAt) {
    throw new BlogConflictError(
      "This publication changed since you opened it. Please review the latest version.",
    );
  }
}

export function requireReviewNote(reviewNote: string | undefined, actionLabel: string): string {
  const trimmed = reviewNote?.trim() ?? "";
  if (!trimmed) {
    throw new BlogValidationError(`A review note is required to ${actionLabel}.`);
  }
  if (trimmed.length > 4000) {
    throw new BlogValidationError("Review note must be at most 4000 characters.");
  }
  return trimmed;
}
