import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { DiscussionPersistenceError } from "../domain/discussion.errors.js";
import type { DiscussionRecord } from "../domain/discussion.types.js";
import {
  fromDiscussionMongoDocument,
  toDiscussionMongoDocument,
  type DiscussionMongoDocument,
} from "./discussion.persistence.js";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

async function ensureDiscussionMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new DiscussionPersistenceError("MongoDB is not configured.");
  }

  await connectMongoClient();
}

export async function insertDiscussion(
  record: DiscussionRecord,
  options: { session?: ClientSession } = {},
): Promise<void> {
  await ensureDiscussionMongoReady();

  const collection = getMongoCollection<DiscussionMongoDocument>(MONGO_COLLECTIONS.discussions);

  try {
    await collection.insertOne(toDiscussionMongoDocument(record), { session: options.session });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new DiscussionPersistenceError("Discussion identifier conflict.", error);
    }

    throw new DiscussionPersistenceError("Discussion persistence failed.", error);
  }
}

export async function findDiscussionById(discussionId: string): Promise<DiscussionRecord | null> {
  await ensureDiscussionMongoReady();

  const collection = getMongoCollection<DiscussionMongoDocument>(MONGO_COLLECTIONS.discussions);
  const document = await collection.findOne({ discussionId });

  return document ? fromDiscussionMongoDocument(document) : null;
}

export async function countDiscussions(filter: {
  discussionId?: string;
  activityId?: string;
  creatorMemberId?: string;
} = {}): Promise<number> {
  await ensureDiscussionMongoReady();

  const collection = getMongoCollection<DiscussionMongoDocument>(MONGO_COLLECTIONS.discussions);
  const query: Record<string, string> = {};

  if (filter.discussionId) {
    query.discussionId = filter.discussionId;
  }

  if (filter.activityId) {
    query.activityId = filter.activityId;
  }

  if (filter.creatorMemberId) {
    query.creatorMemberId = filter.creatorMemberId;
  }

  return collection.countDocuments(query);
}

export async function deleteDiscussionsByDiscussionIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<DiscussionMongoDocument>(MONGO_COLLECTIONS.discussions);
  const result = await collection.deleteMany({ discussionId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}

export async function deleteDiscussionsByCreatorMemberIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<DiscussionMongoDocument>(MONGO_COLLECTIONS.discussions);
  const result = await collection.deleteMany({ creatorMemberId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}
