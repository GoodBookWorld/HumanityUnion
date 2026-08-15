import type { InitiativeRevisionReactionKind, InitiativeRevisionReactionSummary } from "@hu/types";

import {
  INITIATIVE_COMMENT_REACTION_PERSISTENCE_KEY,
  isEngagementMongoMode,
} from "../../infrastructure/mongodb/resolve-engagement-persistence.js";
import { getRevisionByInitiativeAndVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import {
  getInitiativeRevisionReactionSummaryMemory,
  resetInitiativeRevisionReactionRateLimitsMemoryForTests,
  resetInitiativeRevisionReactionStoreForTests,
  setInitiativeRevisionReactionMemory,
} from "./initiative-revision-reaction.memory.store.js";
import {
  getInitiativeRevisionReactionSummaryMongo,
  resetInitiativeRevisionReactionRateLimitsForTests as resetInitiativeRevisionReactionRateLimitsMongoForTests,
  setInitiativeRevisionReactionMongo,
} from "./initiative-revision-reaction.mongo.repository.js";

/**
 * Initiative Lifecycle — Part E, Section 9 (Community Reactions). Reuses
 * the same memory/mongo mode switch as comment/analysis/proposal reactions
 * (they are the same "small engagement signal" persistence family) rather
 * than introducing yet another persistence-mode env var.
 */
function isMongoMode(): boolean {
  return isEngagementMongoMode(INITIATIVE_COMMENT_REACTION_PERSISTENCE_KEY);
}

export function resetInitiativeRevisionReactionsForTests(): void {
  resetInitiativeRevisionReactionStoreForTests();
}

export function resetInitiativeRevisionReactionRateLimitsForTests(): void {
  resetInitiativeRevisionReactionRateLimitsMemoryForTests();
  resetInitiativeRevisionReactionRateLimitsMongoForTests();
}

/** Reactions are only ever allowed on a genuinely published revision version. */
function assertReactionTarget(initiativeId: string, version: number): void {
  const revision = getRevisionByInitiativeAndVersion(initiativeId, version);

  if (!revision) {
    throw new Error("Revision not available for reactions.");
  }
}

export async function setInitiativeRevisionReaction(input: {
  initiativeId: string;
  version: number;
  actorUserId: string;
  reaction: InitiativeRevisionReactionKind | "none";
}): Promise<InitiativeRevisionReactionKind | "none"> {
  assertReactionTarget(input.initiativeId, input.version);
  const revision = getRevisionByInitiativeAndVersion(input.initiativeId, input.version)!;

  if (isMongoMode()) {
    return setInitiativeRevisionReactionMongo({
      revisionId: revision.revisionId,
      initiativeId: input.initiativeId,
      actorUserId: input.actorUserId,
      reaction: input.reaction,
    });
  }

  return setInitiativeRevisionReactionMemory({
    revisionId: revision.revisionId,
    initiativeId: input.initiativeId,
    actorUserId: input.actorUserId,
    reaction: input.reaction,
  });
}

export async function getInitiativeRevisionReactionSummary(input: {
  revisionId: string;
  actorUserId?: string | null;
}): Promise<InitiativeRevisionReactionSummary> {
  if (isMongoMode()) {
    return getInitiativeRevisionReactionSummaryMongo(input);
  }

  return getInitiativeRevisionReactionSummaryMemory(input);
}
