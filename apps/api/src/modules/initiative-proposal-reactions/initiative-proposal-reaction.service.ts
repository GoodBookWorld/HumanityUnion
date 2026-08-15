import type { InitiativeProposalReactionKind, InitiativeProposalReactionSummary } from "@hu/types";

import {
  INITIATIVE_COMMENT_REACTION_PERSISTENCE_KEY,
  isEngagementMongoMode,
} from "../../infrastructure/mongodb/resolve-engagement-persistence.js";
import { getCollectionById } from "../initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js";
import {
  getInitiativeProposalReactionSummaryMemory,
  resetInitiativeProposalReactionRateLimitsMemoryForTests,
  resetInitiativeProposalReactionStoreForTests,
  setInitiativeProposalReactionMemory,
} from "./initiative-proposal-reaction.memory.store.js";
import {
  getInitiativeProposalReactionSummaryMongo,
  resetInitiativeProposalReactionRateLimitsForTests as resetInitiativeProposalReactionRateLimitsMongoForTests,
  setInitiativeProposalReactionMongo,
} from "./initiative-proposal-reaction.mongo.repository.js";

/**
 * Initiative Lifecycle — Part D, Section 8/9 (Community Reactions).
 * Reuses the same memory/mongo mode switch as comment/analysis reactions
 * (they are the same "small engagement signal" persistence family)
 * rather than introducing yet another persistence-mode env var.
 */
function isMongoMode(): boolean {
  return isEngagementMongoMode(INITIATIVE_COMMENT_REACTION_PERSISTENCE_KEY);
}

export function resetInitiativeProposalReactionsForTests(): void {
  resetInitiativeProposalReactionStoreForTests();
}

export function resetInitiativeProposalReactionRateLimitsForTests(): void {
  resetInitiativeProposalReactionRateLimitsMemoryForTests();
  resetInitiativeProposalReactionRateLimitsMongoForTests();
}

/** Reactions are only ever allowed on a proposal that is genuinely `"published"` (or later curated) — never a `"draft"`/`"ready"` one. */
async function assertReactionTarget(collectionId: string, proposalId: string): Promise<void> {
  const collection = await getCollectionById(collectionId);
  const proposal = collection?.proposals.find((entry) => entry.proposalId === proposalId);

  if (!collection || collection.status !== "published" || !proposal || proposal.status === "draft" || proposal.status === "ready") {
    throw new Error("Proposal not available for reactions.");
  }
}

export async function setInitiativeProposalReaction(input: {
  initiativeId: string;
  collectionId: string;
  proposalId: string;
  actorUserId: string;
  reaction: InitiativeProposalReactionKind | "none";
}): Promise<InitiativeProposalReactionKind | "none"> {
  await assertReactionTarget(input.collectionId, input.proposalId);

  if (isMongoMode()) {
    return setInitiativeProposalReactionMongo(input);
  }

  return setInitiativeProposalReactionMemory(input);
}

export async function getInitiativeProposalReactionSummary(input: {
  proposalId: string;
  actorUserId?: string | null;
}): Promise<InitiativeProposalReactionSummary> {
  if (isMongoMode()) {
    return getInitiativeProposalReactionSummaryMongo(input);
  }

  return getInitiativeProposalReactionSummaryMemory(input);
}
