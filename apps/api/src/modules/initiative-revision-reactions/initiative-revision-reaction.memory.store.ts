import { randomUUID } from "node:crypto";

import type { InitiativeRevisionReaction, InitiativeRevisionReactionKind, InitiativeRevisionReactionSummary } from "@hu/types";

/**
 * Initiative Lifecycle — Part E, Section 9 (Community Reactions). Mirrors
 * `initiative-proposal-reaction.memory.store.ts` (Part D) exactly (same
 * upsert + rate-limit semantics), keyed by `revisionId` instead of
 * `proposalId`.
 */
const reactions = new Map<string, InitiativeRevisionReaction>();
const lastReactionAtByUser = new Map<string, number>();

const MIN_REACTION_INTERVAL_MS = 500;

function reactionKey(revisionId: string, actorUserId: string): string {
  return `${revisionId}::${actorUserId}`;
}

export function resetInitiativeRevisionReactionStoreForTests(): void {
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

export function setInitiativeRevisionReactionMemory(input: {
  revisionId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeRevisionReactionKind | "none";
}): InitiativeRevisionReactionKind | "none" {
  const key = reactionKey(input.revisionId, input.actorUserId);
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

  const record: InitiativeRevisionReaction = {
    reactionId: existing?.reactionId ?? randomUUID(),
    revisionId: input.revisionId,
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

export function getInitiativeRevisionReactionSummaryMemory(input: {
  revisionId: string;
  actorUserId?: string | null;
}): InitiativeRevisionReactionSummary {
  let support = 0;
  let doNotSupport = 0;
  let currentUserReaction: InitiativeRevisionReactionKind | "none" = "none";

  for (const reaction of reactions.values()) {
    if (reaction.revisionId !== input.revisionId) {
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

export function resetInitiativeRevisionReactionRateLimitsMemoryForTests(): void {
  lastReactionAtByUser.clear();
}
