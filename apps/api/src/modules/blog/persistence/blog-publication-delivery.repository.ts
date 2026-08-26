/**
 * Pack 21D — Blog publication delivery ledger (postId + subscriberId unique).
 */
import { randomUUID } from "node:crypto";

import type { BlogPublicationDeliveryRecord, BlogPublicationDeliveryStatus } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { BlogPersistenceError } from "../blog.errors.js";

interface BlogPublicationDeliveryDocument extends BlogPublicationDeliveryRecord {
  _id?: string;
}

const memoryDeliveries: BlogPublicationDeliveryRecord[] = [];

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
  return getMongoCollection<BlogPublicationDeliveryDocument>(
    MONGO_COLLECTIONS.blogPublicationDeliveries,
  );
}

function stripId(doc: BlogPublicationDeliveryDocument): BlogPublicationDeliveryRecord {
  const { _id: _ignored, ...record } = doc;
  return record;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export function resetBlogPublicationDeliveriesForTests(): void {
  memoryDeliveries.length = 0;
}

export async function findBlogPublicationDelivery(
  postId: string,
  subscriberId: string,
): Promise<BlogPublicationDeliveryRecord | null> {
  await ensureReady();
  if (isMemoryStore()) {
    return (
      memoryDeliveries.find(
        (row) => row.postId === postId && row.subscriberId === subscriberId,
      ) ?? null
    );
  }
  try {
    const doc = await collection().findOne({ postId, subscriberId });
    return doc ? stripId(doc) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Blog publication delivery.", error);
  }
}

/**
 * Claim a delivery attempt for (postId, subscriberId).
 * - If already `sent`: returns existing (caller must skip send).
 * - If absent: inserts `pending`.
 * - If `pending`/`failed` and attempts remain: bumps attemptCount and returns claimable row.
 */
export async function claimBlogPublicationDelivery(input: {
  postId: string;
  subscriberId: string;
  maxAttempts: number;
}): Promise<{
  record: BlogPublicationDeliveryRecord;
  shouldSend: boolean;
  reason: "claimed" | "already_sent" | "max_attempts" | "in_progress_skip";
}> {
  await ensureReady();
  const now = new Date().toISOString();
  const existing = await findBlogPublicationDelivery(input.postId, input.subscriberId);

  if (existing?.status === "sent") {
    return { record: existing, shouldSend: false, reason: "already_sent" };
  }

  if (existing && existing.attemptCount >= input.maxAttempts) {
    return { record: existing, shouldSend: false, reason: "max_attempts" };
  }

  if (isMemoryStore()) {
    if (!existing) {
      const created: BlogPublicationDeliveryRecord = {
        deliveryId: randomUUID(),
        postId: input.postId,
        subscriberId: input.subscriberId,
        status: "pending",
        attemptedAt: now,
        attemptCount: 1,
        createdAt: now,
        updatedAt: now,
      };
      memoryDeliveries.push(created);
      return { record: created, shouldSend: true, reason: "claimed" };
    }
    const updated: BlogPublicationDeliveryRecord = {
      ...existing,
      status: "pending",
      attemptedAt: now,
      attemptCount: existing.attemptCount + 1,
      updatedAt: now,
    };
    const index = memoryDeliveries.findIndex(
      (row) => row.postId === input.postId && row.subscriberId === input.subscriberId,
    );
    memoryDeliveries[index] = updated;
    return { record: updated, shouldSend: true, reason: "claimed" };
  }

  try {
    if (!existing) {
      const created: BlogPublicationDeliveryRecord = {
        deliveryId: randomUUID(),
        postId: input.postId,
        subscriberId: input.subscriberId,
        status: "pending",
        attemptedAt: now,
        attemptCount: 1,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await collection().insertOne(created);
        return { record: created, shouldSend: true, reason: "claimed" };
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
        const raced = await findBlogPublicationDelivery(input.postId, input.subscriberId);
        if (raced?.status === "sent") {
          return { record: raced, shouldSend: false, reason: "already_sent" };
        }
        if (!raced) {
          throw error;
        }
        // Fall through to update path with raced row.
        const bumped = await collection().findOneAndUpdate(
          {
            postId: input.postId,
            subscriberId: input.subscriberId,
            status: { $in: ["pending", "failed"] as BlogPublicationDeliveryStatus[] },
          },
          {
            $set: { status: "pending", attemptedAt: now, updatedAt: now },
            $inc: { attemptCount: 1 },
          },
          { returnDocument: "after" },
        );
        if (!bumped) {
          const again = await findBlogPublicationDelivery(input.postId, input.subscriberId);
          if (again?.status === "sent") {
            return { record: again, shouldSend: false, reason: "already_sent" };
          }
          return {
            record: again ?? raced,
            shouldSend: false,
            reason: "in_progress_skip",
          };
        }
        return { record: stripId(bumped), shouldSend: true, reason: "claimed" };
      }
    }

    const bumped = await collection().findOneAndUpdate(
      {
        postId: input.postId,
        subscriberId: input.subscriberId,
        status: { $ne: "sent" },
      },
      {
        $set: { status: "pending", attemptedAt: now, updatedAt: now },
        $inc: { attemptCount: 1 },
      },
      { returnDocument: "after" },
    );
    if (!bumped) {
      const again = await findBlogPublicationDelivery(input.postId, input.subscriberId);
      if (again?.status === "sent") {
        return { record: again, shouldSend: false, reason: "already_sent" };
      }
      return {
        record: again ?? existing,
        shouldSend: false,
        reason: "in_progress_skip",
      };
    }
    return { record: stripId(bumped), shouldSend: true, reason: "claimed" };
  } catch (error) {
    throw new BlogPersistenceError("Failed to claim Blog publication delivery.", error);
  }
}

export async function markBlogPublicationDeliverySent(input: {
  postId: string;
  subscriberId: string;
}): Promise<BlogPublicationDeliveryRecord | null> {
  await ensureReady();
  const now = new Date().toISOString();

  if (isMemoryStore()) {
    const index = memoryDeliveries.findIndex(
      (row) => row.postId === input.postId && row.subscriberId === input.subscriberId,
    );
    if (index < 0) {
      return null;
    }
    const updated: BlogPublicationDeliveryRecord = {
      ...memoryDeliveries[index]!,
      status: "sent",
      sentAt: now,
      updatedAt: now,
    };
    memoryDeliveries[index] = updated;
    return updated;
  }

  try {
    const updated = await collection().findOneAndUpdate(
      { postId: input.postId, subscriberId: input.subscriberId },
      {
        $set: {
          status: "sent",
          sentAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    return updated ? stripId(updated) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to mark Blog publication delivery sent.", error);
  }
}

export async function markBlogPublicationDeliveryFailed(input: {
  postId: string;
  subscriberId: string;
  failureCode: string;
}): Promise<BlogPublicationDeliveryRecord | null> {
  await ensureReady();
  const now = new Date().toISOString();
  const failureCode = input.failureCode.slice(0, 120);

  if (isMemoryStore()) {
    const index = memoryDeliveries.findIndex(
      (row) => row.postId === input.postId && row.subscriberId === input.subscriberId,
    );
    if (index < 0) {
      return null;
    }
    const current = memoryDeliveries[index]!;
    if (current.status === "sent") {
      return current;
    }
    const updated: BlogPublicationDeliveryRecord = {
      ...current,
      status: "failed",
      failedAt: now,
      failureCode,
      updatedAt: now,
    };
    memoryDeliveries[index] = updated;
    return updated;
  }

  try {
    const updated = await collection().findOneAndUpdate(
      {
        postId: input.postId,
        subscriberId: input.subscriberId,
        status: { $ne: "sent" },
      },
      {
        $set: {
          status: "failed",
          failedAt: now,
          failureCode,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    return updated ? stripId(updated) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to mark Blog publication delivery failed.", error);
  }
}

/** Mark emailsSent increment as applied (idempotent). Returns true if this call claimed the increment. */
export async function claimBlogPublicationEmailsSentIncrement(input: {
  postId: string;
  subscriberId: string;
}): Promise<boolean> {
  await ensureReady();
  const now = new Date().toISOString();

  if (isMemoryStore()) {
    const index = memoryDeliveries.findIndex(
      (row) => row.postId === input.postId && row.subscriberId === input.subscriberId,
    );
    if (index < 0) {
      return false;
    }
    const current = memoryDeliveries[index]!;
    if (current.status !== "sent" || current.emailsSentIncremented) {
      return false;
    }
    memoryDeliveries[index] = {
      ...current,
      emailsSentIncremented: true,
      updatedAt: now,
    };
    return true;
  }

  try {
    const updated = await collection().findOneAndUpdate(
      {
        postId: input.postId,
        subscriberId: input.subscriberId,
        status: "sent",
        emailsSentIncremented: { $ne: true },
      },
      {
        $set: {
          emailsSentIncremented: true,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    return Boolean(updated);
  } catch (error) {
    throw new BlogPersistenceError(
      "Failed to claim Blog publication emailsSent increment.",
      error,
    );
  }
}
