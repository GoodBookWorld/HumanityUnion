import { randomUUID } from "node:crypto";

import type { InitiativeProposalReaction, InitiativeProposalReactionKind, InitiativeProposalReactionSummary } from "@hu/types";

/**
 * Initiative Lifecycle — Part D, Section 8/9 (Community Reactions).
 * Mirrors `initiative-analysis-reaction.memory.store.ts` exactly (same
 * upsert + rate-limit semantics), keyed by `proposalId` instead of
 * `analysisId`.
 */
const reactions = new Map<string, InitiativeProposalReaction>();
const lastReactionAtByUser = new Map<string, number>();

const MIN_REACTION_INTERVAL_MS = 500;

function reactionKey(proposalId: string, actorUserId: string): string {
  return `${proposalId}::${actorUserId}`;
}

export function resetInitiativeProposalReactionStoreForTests(): void {
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

export function setInitiativeProposalReactionMemory(input: {
  proposalId: string;
  collectionId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeProposalReactionKind | "none";
}): InitiativeProposalReactionKind | "none" {
  const key = reactionKey(input.proposalId, input.actorUserId);
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

  const record: InitiativeProposalReaction = {
    reactionId: existing?.reactionId ?? randomUUID(),
    proposalId: input.proposalId,
    collectionId: input.collectionId,
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

export function getInitiativeProposalReactionSummaryMemory(input: {
  proposalId: string;
  actorUserId?: string | null;
}): InitiativeProposalReactionSummary {
  let support = 0;
  let doNotSupport = 0;
  let currentUserReaction: InitiativeProposalReactionKind | "none" = "none";

  for (const reaction of reactions.values()) {
    if (reaction.proposalId !== input.proposalId) {
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

export function resetInitiativeProposalReactionRateLimitsMemoryForTests(): void {
  lastReactionAtByUser.clear();
}

export function deleteInitiativeProposalReactionsByCollectionPrefix(prefix: string): void {
  for (const [key, reaction] of reactions.entries()) {
    if (reaction.collectionId.startsWith(prefix)) {
      reactions.delete(key);
    }
  }
}
