import { randomUUID } from "node:crypto";

import type {
  InitiativeProposalReaction,
  InitiativeProposalReactionKind,
  InitiativeProposalReactionSummary,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

const MIN_REACTION_INTERVAL_MS = 500;
const lastReactionAtByUser = new Map<string, number>();

interface InitiativeProposalReactionDocument extends InitiativeProposalReaction {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for initiative proposal reactions.");
  }

  await connectMongoClient();
}

function assertRateLimit(actorUserId: string): void {
  const lastReactionAt = lastReactionAtByUser.get(actorUserId) ?? 0;
  const elapsed = Date.now() - lastReactionAt;

  if (elapsed < MIN_REACTION_INTERVAL_MS) {
    throw new Error("Please wait before reacting again.");
  }
}

export function resetInitiativeProposalReactionRateLimitsForTests(): void {
  lastReactionAtByUser.clear();
}

export async function setInitiativeProposalReactionMongo(input: {
  proposalId: string;
  collectionId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeProposalReactionKind | "none";
}): Promise<InitiativeProposalReactionKind | "none"> {
  await ensureMongoReady();

  const collection = getMongoCollection<InitiativeProposalReactionDocument>(
    MONGO_COLLECTIONS.initiativeProposalReactions,
  );
  const existing = await collection.findOne({
    proposalId: input.proposalId,
    actorUserId: input.actorUserId,
  });
  const now = new Date().toISOString();

  if (input.reaction === "none" && !existing) {
    return "none";
  }

  if (existing && existing.reaction === input.reaction) {
    return input.reaction;
  }

  assertRateLimit(input.actorUserId);

  if (input.reaction === "none") {
    await collection.deleteOne({ proposalId: input.proposalId, actorUserId: input.actorUserId });
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

  await collection.updateOne(
    { proposalId: input.proposalId, actorUserId: input.actorUserId },
    { $set: record },
    { upsert: true },
  );

  lastReactionAtByUser.set(input.actorUserId, Date.now());

  return input.reaction;
}

export async function getInitiativeProposalReactionSummaryMongo(input: {
  proposalId: string;
  actorUserId?: string | null;
}): Promise<InitiativeProposalReactionSummary> {
  await ensureMongoReady();
  const collection = getMongoCollection<InitiativeProposalReactionDocument>(
    MONGO_COLLECTIONS.initiativeProposalReactions,
  );
  const records = await collection.find({ proposalId: input.proposalId }).toArray();

  let support = 0;
  let doNotSupport = 0;
  let currentUserReaction: InitiativeProposalReactionKind | "none" = "none";

  for (const document of records) {
    if (document.reaction === "support") {
      support += 1;
    } else {
      doNotSupport += 1;
    }

    if (input.actorUserId && document.actorUserId === input.actorUserId) {
      currentUserReaction = document.reaction;
    }
  }

  return { support, doNotSupport, currentUserReaction };
}

export async function deleteInitiativeProposalReactionsByCollectionPrefix(prefix: string): Promise<void> {
  await ensureMongoReady();
  await getMongoCollection(MONGO_COLLECTIONS.initiativeProposalReactions).deleteMany({
    collectionId: { $regex: `^${prefix}` },
  });
}
