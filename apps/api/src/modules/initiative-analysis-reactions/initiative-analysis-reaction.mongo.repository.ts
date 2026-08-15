import { randomUUID } from "node:crypto";

import type {
  InitiativeAnalysisReaction,
  InitiativeAnalysisReactionKind,
  InitiativeAnalysisReactionSummary,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

const MIN_REACTION_INTERVAL_MS = 500;
const lastReactionAtByUser = new Map<string, number>();

interface InitiativeAnalysisReactionDocument extends InitiativeAnalysisReaction {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for initiative analysis reactions.");
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

export function resetInitiativeAnalysisReactionRateLimitsForTests(): void {
  lastReactionAtByUser.clear();
}

export async function setInitiativeAnalysisReactionMongo(input: {
  analysisId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeAnalysisReactionKind | "none";
}): Promise<InitiativeAnalysisReactionKind | "none"> {
  await ensureMongoReady();

  const collection = getMongoCollection<InitiativeAnalysisReactionDocument>(
    MONGO_COLLECTIONS.initiativeAnalysisReactions,
  );
  const existing = await collection.findOne({
    analysisId: input.analysisId,
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
    await collection.deleteOne({ analysisId: input.analysisId, actorUserId: input.actorUserId });
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

  await collection.updateOne(
    { analysisId: input.analysisId, actorUserId: input.actorUserId },
    { $set: record },
    { upsert: true },
  );

  lastReactionAtByUser.set(input.actorUserId, Date.now());

  return input.reaction;
}

export async function getInitiativeAnalysisReactionSummaryMongo(input: {
  analysisId: string;
  actorUserId?: string | null;
}): Promise<InitiativeAnalysisReactionSummary> {
  await ensureMongoReady();
  const collection = getMongoCollection<InitiativeAnalysisReactionDocument>(
    MONGO_COLLECTIONS.initiativeAnalysisReactions,
  );
  const records = await collection.find({ analysisId: input.analysisId }).toArray();

  let support = 0;
  let doNotSupport = 0;
  let currentUserReaction: InitiativeAnalysisReactionKind | "none" = "none";

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

export async function deleteInitiativeAnalysisReactionsByAnalysisPrefix(prefix: string): Promise<void> {
  await ensureMongoReady();
  await getMongoCollection(MONGO_COLLECTIONS.initiativeAnalysisReactions).deleteMany({
    analysisId: { $regex: `^${prefix}` },
  });
}
