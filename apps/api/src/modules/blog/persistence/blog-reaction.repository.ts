import { randomUUID } from "node:crypto";

import type { BlogReaction, BlogReactionKind, BlogReactionSummary } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { BlogReactionRateLimitError } from "../blog-interaction.errors.js";

interface BlogReactionMongoDocument extends BlogReaction {
  _id?: string;
}

const memoryReactions: BlogReaction[] = [];
const lastReactionAtByActor = new Map<string, number>();
const MIN_REACTION_INTERVAL_MS = 500;

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }
  await connectMongoClient();
}

function reactionsCollection() {
  return getMongoCollection<BlogReactionMongoDocument>(MONGO_COLLECTIONS.blogReactions);
}

function assertRateLimit(actorParticipantId: string): void {
  const last = lastReactionAtByActor.get(actorParticipantId) ?? 0;
  if (Date.now() - last < MIN_REACTION_INTERVAL_MS) {
    throw new BlogReactionRateLimitError();
  }
}

export async function setBlogReaction(input: {
  postId: string;
  actorParticipantId: string;
  reaction: BlogReactionKind | "none";
}): Promise<BlogReactionKind | "none"> {
  await ensureReady();
  const now = new Date().toISOString();

  if (!isMongoConfigured()) {
    const existingIndex = memoryReactions.findIndex(
      (entry) =>
        entry.postId === input.postId && entry.actorParticipantId === input.actorParticipantId,
    );
    const existing = existingIndex >= 0 ? memoryReactions[existingIndex] : null;

    if (input.reaction === "none") {
      if (!existing) {
        return "none";
      }
      assertRateLimit(input.actorParticipantId);
      memoryReactions.splice(existingIndex, 1);
      lastReactionAtByActor.set(input.actorParticipantId, Date.now());
      return "none";
    }

    if (existing?.reaction === input.reaction) {
      // Toggle off when selecting the active reaction again.
      assertRateLimit(input.actorParticipantId);
      memoryReactions.splice(existingIndex, 1);
      lastReactionAtByActor.set(input.actorParticipantId, Date.now());
      return "none";
    }

    assertRateLimit(input.actorParticipantId);
    const record: BlogReaction = {
      reactionId: existing?.reactionId ?? `blog-rxn-${randomUUID()}`,
      postId: input.postId,
      actorParticipantId: input.actorParticipantId,
      reaction: input.reaction,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existingIndex >= 0) {
      memoryReactions[existingIndex] = record;
    } else {
      memoryReactions.push(record);
    }
    lastReactionAtByActor.set(input.actorParticipantId, Date.now());
    return input.reaction;
  }

  const collection = reactionsCollection();
  const existing = await collection.findOne({
    postId: input.postId,
    actorParticipantId: input.actorParticipantId,
  });

  if (input.reaction === "none") {
    if (!existing) {
      return "none";
    }
    assertRateLimit(input.actorParticipantId);
    await collection.deleteOne({
      postId: input.postId,
      actorParticipantId: input.actorParticipantId,
    });
    lastReactionAtByActor.set(input.actorParticipantId, Date.now());
    return "none";
  }

  if (existing?.reaction === input.reaction) {
    assertRateLimit(input.actorParticipantId);
    await collection.deleteOne({
      postId: input.postId,
      actorParticipantId: input.actorParticipantId,
    });
    lastReactionAtByActor.set(input.actorParticipantId, Date.now());
    return "none";
  }

  assertRateLimit(input.actorParticipantId);
  const record: BlogReaction = {
    reactionId: existing?.reactionId ?? `blog-rxn-${randomUUID()}`,
    postId: input.postId,
    actorParticipantId: input.actorParticipantId,
    reaction: input.reaction,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await collection.updateOne(
    { postId: input.postId, actorParticipantId: input.actorParticipantId },
    { $set: record },
    { upsert: true },
  );
  lastReactionAtByActor.set(input.actorParticipantId, Date.now());
  return input.reaction;
}

export async function getBlogReactionSummary(input: {
  postId: string;
  actorParticipantId?: string | null;
}): Promise<BlogReactionSummary> {
  await ensureReady();

  if (!isMongoConfigured()) {
    let helpful = 0;
    let notHelpful = 0;
    let currentUserReaction: BlogReactionKind | "none" = "none";
    for (const entry of memoryReactions) {
      if (entry.postId !== input.postId) {
        continue;
      }
      if (entry.reaction === "helpful") {
        helpful += 1;
      } else {
        notHelpful += 1;
      }
      if (
        input.actorParticipantId &&
        entry.actorParticipantId === input.actorParticipantId
      ) {
        currentUserReaction = entry.reaction;
      }
    }
    return { helpful, notHelpful, currentUserReaction };
  }

  const records = await reactionsCollection().find({ postId: input.postId }).toArray();
  let helpful = 0;
  let notHelpful = 0;
  let currentUserReaction: BlogReactionKind | "none" = "none";
  for (const entry of records) {
    if (entry.reaction === "helpful") {
      helpful += 1;
    } else {
      notHelpful += 1;
    }
    if (
      input.actorParticipantId &&
      entry.actorParticipantId === input.actorParticipantId
    ) {
      currentUserReaction = entry.reaction;
    }
  }
  return { helpful, notHelpful, currentUserReaction };
}

export async function deleteBlogReactionsByPostIdsForTests(
  postIds: readonly string[],
): Promise<void> {
  if (postIds.length === 0) {
    return;
  }
  for (let index = memoryReactions.length - 1; index >= 0; index -= 1) {
    if (postIds.includes(memoryReactions[index]!.postId)) {
      memoryReactions.splice(index, 1);
    }
  }
  if (!isMongoConfigured()) {
    return;
  }
  await ensureReady();
  await reactionsCollection().deleteMany({ postId: { $in: [...postIds] } });
}

export function resetBlogReactionsMemoryForTests(): void {
  memoryReactions.length = 0;
  lastReactionAtByActor.clear();
}

export function resetBlogReactionRateLimitsForTests(): void {
  lastReactionAtByActor.clear();
}
