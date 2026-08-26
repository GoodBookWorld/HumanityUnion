/**
 * Pack 21E — Admin selected-subscriber message persistence.
 */
import type { BlogAdminSubscriberMessageRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { BlogPersistenceError } from "../blog.errors.js";

interface BlogAdminSubscriberMessageDocument extends BlogAdminSubscriberMessageRecord {
  _id?: string;
}

const memoryMessages: BlogAdminSubscriberMessageRecord[] = [];

function isMemoryStore(): boolean {
  return process.env.BLOG_SUBSCRIBER_FORCE_MEMORY === "true" || !isMongoConfigured();
}

async function ensureReady(): Promise<void> {
  if (isMemoryStore()) {
    return;
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<BlogAdminSubscriberMessageDocument>(
    MONGO_COLLECTIONS.blogAdminSubscriberMessages,
  );
}

function stripId(doc: BlogAdminSubscriberMessageDocument): BlogAdminSubscriberMessageRecord {
  const { _id: _ignored, ...record } = doc;
  return record;
}

export function resetBlogAdminSubscriberMessagesForTests(): void {
  memoryMessages.length = 0;
}

export async function insertBlogAdminSubscriberMessage(
  record: BlogAdminSubscriberMessageRecord,
): Promise<BlogAdminSubscriberMessageRecord> {
  await ensureReady();
  if (isMemoryStore()) {
    memoryMessages.push(record);
    return record;
  }
  try {
    await collection().insertOne(record);
    return record;
  } catch (error) {
    throw new BlogPersistenceError("Failed to save Admin subscriber message.", error);
  }
}

export async function findBlogAdminSubscriberMessageById(
  adminMessageId: string,
): Promise<BlogAdminSubscriberMessageRecord | null> {
  await ensureReady();
  if (isMemoryStore()) {
    return memoryMessages.find((row) => row.adminMessageId === adminMessageId) ?? null;
  }
  try {
    const doc = await collection().findOne({ adminMessageId });
    return doc ? stripId(doc) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Admin subscriber message.", error);
  }
}
