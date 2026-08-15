import type { InitiativeAnalysisReactionKind, InitiativeAnalysisReactionSummary } from "@hu/types";

import {
  INITIATIVE_COMMENT_REACTION_PERSISTENCE_KEY,
  isEngagementMongoMode,
} from "../../infrastructure/mongodb/resolve-engagement-persistence.js";
import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  deleteInitiativeAnalysisReactionsByAnalysisPrefix,
  getInitiativeAnalysisReactionSummaryMemory,
  resetInitiativeAnalysisReactionRateLimitsMemoryForTests,
  resetInitiativeAnalysisReactionStoreForTests,
  setInitiativeAnalysisReactionMemory,
} from "./initiative-analysis-reaction.memory.store.js";
import {
  deleteInitiativeAnalysisReactionsByAnalysisPrefix as deleteInitiativeAnalysisReactionsByAnalysisPrefixMongo,
  getInitiativeAnalysisReactionSummaryMongo,
  resetInitiativeAnalysisReactionRateLimitsForTests as resetInitiativeAnalysisReactionRateLimitsMongoForTests,
  setInitiativeAnalysisReactionMongo,
} from "./initiative-analysis-reaction.mongo.repository.js";

/**
 * Initiative Lifecycle — Part B, Section 9 (Reaction Model). Reuses the
 * same memory/mongo mode switch as comment reactions (they are the same
 * "small engagement signal" persistence family) rather than introducing a
 * third persistence-mode env var.
 */
function isMongoMode(): boolean {
  return isEngagementMongoMode(INITIATIVE_COMMENT_REACTION_PERSISTENCE_KEY);
}

export function resetInitiativeAnalysisReactionsForTests(): void {
  resetInitiativeAnalysisReactionStoreForTests();
}

export function resetInitiativeAnalysisReactionRateLimitsForTests(): void {
  resetInitiativeAnalysisReactionRateLimitsMemoryForTests();
  resetInitiativeAnalysisReactionRateLimitsMongoForTests();
}

export async function resetInitiativeAnalysisReactionsMongoForTests(prefix: string): Promise<void> {
  if (!isMongoMode()) {
    resetInitiativeAnalysisReactionsForTests();
    deleteInitiativeAnalysisReactionsByAnalysisPrefix(prefix);
    return;
  }

  await deleteInitiativeAnalysisReactionsByAnalysisPrefixMongo(prefix);
  resetInitiativeAnalysisReactionRateLimitsMongoForTests();
}

/** Reactions are only ever allowed on a genuinely PUBLISHED Analysis — never a draft/archived one. */
function assertReactionTarget(analysisId: string): void {
  const analysis = getAnalysisById(analysisId);

  if (!analysis || analysis.status !== "published") {
    throw new Error("Analysis not available for reactions.");
  }
}

export async function setInitiativeAnalysisReaction(input: {
  initiativeId: string;
  analysisId: string;
  actorUserId: string;
  reaction: InitiativeAnalysisReactionKind | "none";
}): Promise<InitiativeAnalysisReactionKind | "none"> {
  assertReactionTarget(input.analysisId);

  if (isMongoMode()) {
    return setInitiativeAnalysisReactionMongo(input);
  }

  return setInitiativeAnalysisReactionMemory(input);
}

export async function getInitiativeAnalysisReactionSummary(input: {
  analysisId: string;
  actorUserId?: string | null;
}): Promise<InitiativeAnalysisReactionSummary> {
  if (isMongoMode()) {
    return getInitiativeAnalysisReactionSummaryMongo(input);
  }

  return getInitiativeAnalysisReactionSummaryMemory(input);
}
