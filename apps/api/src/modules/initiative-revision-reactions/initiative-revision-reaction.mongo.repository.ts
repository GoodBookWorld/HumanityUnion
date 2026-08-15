import { randomUUID } from "node:crypto";

import type {
  InitiativeRevisionReaction,
  InitiativeRevisionReactionKind,
  InitiativeRevisionReactionSummary,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

const MIN_REACTION_INTERVAL_MS = 500;
const lastReactionAtByUser = new Map<string, number>();

interface InitiativeRevisionReactionDocument extends InitiativeRevisionReaction {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for initiative revision reactions.");
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

export function resetInitiativeRevisionReactionRateLimitsForTests(): void {
  lastReactionAtByUser.clear();
}

export async function setInitiativeRevisionReactionMongo(input: {
  revisionId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeRevisionReactionKind | "none";
}): Promise<InitiativeRevisionReactionKind | "none"> {
  await ensureMongoReady();

  const collection = getMongoCollection<InitiativeRevisionReactionDocument>(
    MONGO_COLLECTIONS.initiativeRevisionReactions,
  );
  const existing = await collection.findOne({
    revisionId: input.revisionId,
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
    await collection.deleteOne({ revisionId: input.revisionId, actorUserId: input.actorUserId });
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

  await collection.updateOne(
    { revisionId: input.revisionId, actorUserId: input.actorUserId },
    { $set: record },
    { upsert: true },
  );

  lastReactionAtByUser.set(input.actorUserId, Date.now());

  return input.reaction;
}

export async function getInitiativeRevisionReactionSummaryMongo(input: {
  revisionId: string;
  actorUserId?: string | null;
}): Promise<InitiativeRevisionReactionSummary> {
  await ensureMongoReady();
  const collection = getMongoCollection<InitiativeRevisionReactionDocument>(
    MONGO_COLLECTIONS.initiativeRevisionReactions,
  );
  const records = await collection.find({ revisionId: input.revisionId }).toArray();

  let support = 0;
  let doNotSupport = 0;
  let currentUserReaction: InitiativeRevisionReactionKind | "none" = "none";

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
