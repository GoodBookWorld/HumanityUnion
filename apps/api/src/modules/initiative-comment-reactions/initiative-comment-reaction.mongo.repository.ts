import { randomUUID } from "node:crypto";

import type {
  InitiativeCommentReaction,
  InitiativeCommentReactionKind,
  InitiativeCommentReactionSummary,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

const MIN_REACTION_INTERVAL_MS = 500;
const lastReactionAtByUser = new Map<string, number>();

interface InitiativeCommentReactionDocument extends InitiativeCommentReaction {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for initiative comment reactions.");
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

export function resetInitiativeCommentReactionRateLimitsForTests(): void {
  lastReactionAtByUser.clear();
}

export async function setInitiativeCommentReactionMongo(input: {
  commentId: string;
  initiativeId: string;
  actorUserId: string;
  reaction: InitiativeCommentReactionKind | "none";
}): Promise<InitiativeCommentReactionKind | "none"> {
  await ensureMongoReady();

  const collection = getMongoCollection<InitiativeCommentReactionDocument>(
    MONGO_COLLECTIONS.initiativeCommentReactions,
  );
  const existing = await collection.findOne({
    commentId: input.commentId,
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
    await collection.deleteOne({ commentId: input.commentId, actorUserId: input.actorUserId });
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

  await collection.updateOne(
    { commentId: input.commentId, actorUserId: input.actorUserId },
    { $set: record },
    { upsert: true },
  );

  lastReactionAtByUser.set(input.actorUserId, Date.now());

  return input.reaction;
}

export async function getInitiativeCommentReactionSummaryMongo(input: {
  commentId: string;
  actorUserId?: string | null;
}): Promise<InitiativeCommentReactionSummary> {
  await ensureMongoReady();
  const collection = getMongoCollection<InitiativeCommentReactionDocument>(
    MONGO_COLLECTIONS.initiativeCommentReactions,
  );
  const records = await collection.find({ commentId: input.commentId }).toArray();

  let likes = 0;
  let dislikes = 0;
  let currentUserReaction: InitiativeCommentReactionKind | "none" = "none";

  for (const document of records) {
    if (document.reaction === "like") {
      likes += 1;
    } else {
      dislikes += 1;
    }

    if (input.actorUserId && document.actorUserId === input.actorUserId) {
      currentUserReaction = document.reaction;
    }
  }

  return { likes, dislikes, currentUserReaction };
}

export async function getInitiativeCommentReactionSummariesMongo(input: {
  commentIds: string[];
  actorUserId?: string | null;
}): Promise<Map<string, InitiativeCommentReactionSummary>> {
  await ensureMongoReady();
  const collection = getMongoCollection<InitiativeCommentReactionDocument>(
    MONGO_COLLECTIONS.initiativeCommentReactions,
  );
  const records = input.commentIds.length
    ? await collection.find({ commentId: { $in: input.commentIds } }).toArray()
    : [];

  const summaries = new Map<string, InitiativeCommentReactionSummary>();

  for (const commentId of input.commentIds) {
    summaries.set(commentId, { likes: 0, dislikes: 0, currentUserReaction: "none" });
  }

  for (const document of records) {
    const summary = summaries.get(document.commentId);

    if (!summary) {
      continue;
    }

    if (document.reaction === "like") {
      summary.likes += 1;
    } else {
      summary.dislikes += 1;
    }

    if (input.actorUserId && document.actorUserId === input.actorUserId) {
      summary.currentUserReaction = document.reaction;
    }
  }

  return summaries;
}

export async function deleteInitiativeCommentReactionsByCommentPrefix(
  prefix: string,
): Promise<void> {
  await ensureMongoReady();
  await getMongoCollection(MONGO_COLLECTIONS.initiativeCommentReactions).deleteMany({
    commentId: { $regex: `^${prefix}` },
  });
}
