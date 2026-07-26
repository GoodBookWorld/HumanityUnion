import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import type { ActivityRecord } from "../domain/activity.types.js";
import { ActivityPersistenceError } from "../domain/activity.errors.js";
import {
  fromActivityMongoDocument,
  toActivityMongoDocument,
  type ActivityMongoDocument,
} from "./activity.persistence.js";

async function ensureActivityMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new ActivityPersistenceError();
  }

  await connectMongoClient();
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export async function insertActivity(
  record: ActivityRecord,
  options: { session?: ClientSession } = {},
): Promise<void> {
  await ensureActivityMongoReady();

  const collection = getMongoCollection<ActivityMongoDocument>(MONGO_COLLECTIONS.activities);

  try {
    await collection.insertOne(toActivityMongoDocument(record), { session: options.session });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ActivityPersistenceError("Activity identifier already exists.", error);
    }

    throw new ActivityPersistenceError("Activity insert failed.", error);
  }
}

export async function countActivities(filter: Record<string, unknown> = {}): Promise<number> {
  await ensureActivityMongoReady();

  const collection = getMongoCollection<ActivityMongoDocument>(MONGO_COLLECTIONS.activities);
  return collection.countDocuments(filter);
}

export async function findActivityById(activityId: string): Promise<ActivityRecord | null> {
  await ensureActivityMongoReady();

  const collection = getMongoCollection<ActivityMongoDocument>(MONGO_COLLECTIONS.activities);
  const document = await collection.findOne({ activityId });

  return document ? fromActivityMongoDocument(document) : null;
}

export async function countActivitiesByCreatorMemberId(memberId: string): Promise<number> {
  await ensureActivityMongoReady();

  const collection = getMongoCollection<ActivityMongoDocument>(MONGO_COLLECTIONS.activities);
  return collection.countDocuments({ creatorMemberId: memberId });
}

export async function deleteActivitiesByCreatorMemberIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<ActivityMongoDocument>(MONGO_COLLECTIONS.activities);
  const result = await collection.deleteMany({ creatorMemberId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}

export async function deleteActivitiesByActivityIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await connectMongoClient();
  const collection = getMongoCollection<ActivityMongoDocument>(MONGO_COLLECTIONS.activities);
  const result = await collection.deleteMany({ activityId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}
