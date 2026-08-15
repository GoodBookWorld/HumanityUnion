import { randomUUID } from "node:crypto";

import type {
  InitiativeAnalysisReaction,
  InitiativeAnalysisReactionKind,
  InitiativeAnalysisReactionSummary,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part B, Section 9 (Reaction Model). Mirrors
 * `initiative-comment-reaction.memory.store.ts` exactly (same upsert +
 * rate-limit semantics), keyed by `analysisId` instead of `commentId`.
 */
const reactions = new Map<string, InitiativeAnalysisReaction>();
const lastReactionAtByUser = new Map<string, number>();

const MIN_REACTION_INTERVAL_MS = 500;

function reactionKey(analysisId: string, actorUserId: string): string {
  return `${analysisId}::${actorUserId}`;
}

export function resetInitiativeAnalysisReactionStoreForTests(): void {
  reactions.clear();
  lastReactionAtByUser.clear();
}

function assertRateLimit(actorUserId: string): void {
  const lastReactionAt = lastReactionAtByUser.get(actorUserId) ?? 0;
  const elapsed = Date.now() - lastReactionAt;

  if (elapsed < MIN_REACTION_INTERVAL_MS) {
    throw new Error("Please wait before reacting again.");
  }
}

export function setInitiativeAnalysisReactionMemory(input: {
  analysisId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeAnalysisReactionKind | "none";
}): InitiativeAnalysisReactionKind | "none" {
  const key = reactionKey(input.analysisId, input.actorUserId);
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

  const record: InitiativeAnalysisReaction = {
    reactionId: existing?.reactionId ?? randomUUID(),
    analysisId: input.analysisId,
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

export function getInitiativeAnalysisReactionSummaryMemory(input: {
  analysisId: string;
  actorUserId?: string | null;
}): InitiativeAnalysisReactionSummary {
  let support = 0;
  let doNotSupport = 0;
  let currentUserReaction: InitiativeAnalysisReactionKind | "none" = "none";

  for (const reaction of reactions.values()) {
    if (reaction.analysisId !== input.analysisId) {
      continue;
    }

    if (reaction.reaction === "support") {
      support += 1;
    } else {
      doNotSupport += 1;
    }

    if (input.actorUserId && reaction.actorUserId === input.actorUserId) {
      currentUserReaction = reaction.reaction;
    }
  }

  return { support, doNotSupport, currentUserReaction };
}

export function resetInitiativeAnalysisReactionRateLimitsMemoryForTests(): void {
  lastReactionAtByUser.clear();
}

export function deleteInitiativeAnalysisReactionsByAnalysisPrefix(prefix: string): void {
  for (const [key, reaction] of reactions.entries()) {
    if (reaction.analysisId.startsWith(prefix)) {
      reactions.delete(key);
    }
  }
}
