import type { InitiativeCommentReactionKind, InitiativeCommentReactionSummary } from "@hu/types";

import { getInitiativeCommentById } from "../initiative-comments/initiative-comment.memory.store.js";
import { getApprovedInitiativeCommentByIdMongo } from "../initiative-comments/initiative-comment.mongo.repository.js";
import {
  deleteInitiativeCommentReactionsByCommentPrefix,
  getInitiativeCommentReactionSummariesMemory,
  getInitiativeCommentReactionSummaryMemory,
  resetInitiativeCommentReactionStoreForTests,
  resetInitiativeCommentReactionRateLimitsMemoryForTests,
  setInitiativeCommentReactionMemory,
} from "./initiative-comment-reaction.memory.store.js";
import {
  deleteInitiativeCommentReactionsByCommentPrefix as deleteInitiativeCommentReactionsByCommentPrefixMongo,
  getInitiativeCommentReactionSummariesMongo,
  getInitiativeCommentReactionSummaryMongo,
  resetInitiativeCommentReactionRateLimitsForTests as resetInitiativeCommentReactionRateLimitsMongoForTests,
  setInitiativeCommentReactionMongo,
} from "./initiative-comment-reaction.mongo.repository.js";
import {
  INITIATIVE_COMMENT_REACTION_PERSISTENCE_KEY,
  isEngagementMongoMode,
} from "../../infrastructure/mongodb/resolve-engagement-persistence.js";
import { isInitiativeCommentMongoMode } from "../initiative-comments/initiative-comment.service.js";

function isMongoMode(): boolean {
  return isEngagementMongoMode(INITIATIVE_COMMENT_REACTION_PERSISTENCE_KEY);
}

export function resetInitiativeCommentReactionsForTests(): void {
  resetInitiativeCommentReactionStoreForTests();
}

export function resetInitiativeCommentReactionRateLimitsForTests(): void {
  resetInitiativeCommentReactionRateLimitsMemoryForTests();
  resetInitiativeCommentReactionRateLimitsMongoForTests();
}

export async function resetInitiativeCommentReactionsMongoForTests(prefix: string): Promise<void> {
  if (!isMongoMode()) {
    resetInitiativeCommentReactionsForTests();
    deleteInitiativeCommentReactionsByCommentPrefix(prefix);
    return;
  }

  await deleteInitiativeCommentReactionsByCommentPrefixMongo(prefix);
  resetInitiativeCommentReactionRateLimitsMongoForTests();
}

async function getApprovedComment(input: { initiativeId: string; commentId: string }) {
  if (isInitiativeCommentMongoMode()) {
    const comment = await getApprovedInitiativeCommentByIdMongo(input.commentId);

    if (!comment || comment.initiativeId !== input.initiativeId) {
      return null;
    }

    return comment;
  }

  const comment = getInitiativeCommentById(input.commentId);

  if (
    !comment ||
    comment.initiativeId !== input.initiativeId ||
    comment.status !== "approved" ||
    comment.deletedAt
  ) {
    return null;
  }

  return comment;
}

async function assertReactionTarget(input: {
  initiativeId: string;
  commentId: string;
}): Promise<void> {
  const comment = await getApprovedComment(input);

  if (!comment) {
    throw new Error("Comment not available for reactions.");
  }
}

export async function setInitiativeCommentReaction(input: {
  initiativeId: string;
  commentId: string;
  actorUserId: string;
  reaction: InitiativeCommentReactionKind | "none";
}): Promise<InitiativeCommentReactionKind | "none"> {
  await assertReactionTarget(input);

  if (isMongoMode()) {
    return setInitiativeCommentReactionMongo(input);
  }

  return setInitiativeCommentReactionMemory(input);
}

export async function getInitiativeCommentReactionSummary(input: {
  commentId: string;
  actorUserId?: string | null;
}): Promise<InitiativeCommentReactionSummary> {
  if (isMongoMode()) {
    return getInitiativeCommentReactionSummaryMongo(input);
  }

  return getInitiativeCommentReactionSummaryMemory(input);
}

export async function getInitiativeCommentReactionSummaries(input: {
  commentIds: string[];
  actorUserId?: string | null;
}): Promise<Map<string, InitiativeCommentReactionSummary>> {
  if (isMongoMode()) {
    return getInitiativeCommentReactionSummariesMongo(input);
  }

  return getInitiativeCommentReactionSummariesMemory(input);
}
