import { randomUUID } from "node:crypto";

import type {
  InitiativeCommentReaction,
  InitiativeCommentReactionKind,
  InitiativeCommentReactionSummary,
} from "@hu/types";

const reactions = new Map<string, InitiativeCommentReaction>();
const lastReactionAtByUser = new Map<string, number>();

const MIN_REACTION_INTERVAL_MS = 500;

function reactionKey(commentId: string, actorUserId: string): string {
  return `${commentId}::${actorUserId}`;
}

export function resetInitiativeCommentReactionStoreForTests(): void {
  reactions.clear();
  lastReactionAtByUser.clear();
}

export function resetInitiativeCommentReactionRateLimitsMemoryForTests(): void {
  lastReactionAtByUser.clear();
}

function assertRateLimit(actorUserId: string): void {
  const lastReactionAt = lastReactionAtByUser.get(actorUserId) ?? 0;
  const elapsed = Date.now() - lastReactionAt;

  if (elapsed < MIN_REACTION_INTERVAL_MS) {
    throw new Error("Please wait before reacting again.");
  }
}

export function setInitiativeCommentReactionMemory(input: {
  commentId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeCommentReactionKind | "none";
}): InitiativeCommentReactionKind | "none" {
  const key = reactionKey(input.commentId, input.actorUserId);
  const existing = reactions.get(key);

  if (input.reaction === "none" && !existing) {
    return "none";
  }

  if (existing && existing.reaction === input.reaction) {
    return input.reaction;
  }

  assertRateLimit(input.actorUserId);
  const now = new Date().toISOString();

  if (input.reaction === "none") {
    reactions.delete(key);
    lastReactionAtByUser.set(input.actorUserId, Date.now());
    return "none";
  }

  const record: InitiativeCommentReaction = {
    reactionId: existing?.reactionId ?? randomUUID(),
    commentId: input.commentId,
    initiativeId: input.initiativeId,
    actorUserId: input.actorUserId,
    reaction: input.reaction,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  reactions.set(key, record);
  lastReactionAtByUser.set(input.actorUserId, Date.now());

  return input.reaction;
}

export function getInitiativeCommentReactionSummaryMemory(input: {
  commentId: string;
  actorUserId?: string | null;
}): InitiativeCommentReactionSummary {
  let likes = 0;
  let dislikes = 0;
  let currentUserReaction: InitiativeCommentReactionKind | "none" = "none";

  for (const reaction of reactions.values()) {
    if (reaction.commentId !== input.commentId) {
      continue;
    }

    if (reaction.reaction === "like") {
      likes += 1;
    } else {
      dislikes += 1;
    }

    if (input.actorUserId && reaction.actorUserId === input.actorUserId) {
      currentUserReaction = reaction.reaction;
    }
  }

  return { likes, dislikes, currentUserReaction };
}

export function getInitiativeCommentReactionSummariesMemory(input: {
  commentIds: string[];
  actorUserId?: string | null;
}): Map<string, InitiativeCommentReactionSummary> {
  const summaries = new Map<string, InitiativeCommentReactionSummary>();

  for (const commentId of input.commentIds) {
    summaries.set(
      commentId,
      getInitiativeCommentReactionSummaryMemory({
        commentId,
        actorUserId: input.actorUserId,
      }),
    );
  }

  return summaries;
}

export function deleteInitiativeCommentReactionsByCommentPrefix(prefix: string): void {
  for (const [key, reaction] of reactions.entries()) {
    if (reaction.commentId.startsWith(prefix)) {
      reactions.delete(key);
    }
  }
}
