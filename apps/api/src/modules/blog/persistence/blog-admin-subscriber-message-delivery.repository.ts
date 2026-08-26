/**
 * Pack 21E — Admin message delivery ledger (adminMessageId + subscriberId unique).
 */
import { randomUUID } from "node:crypto";

import type {
  BlogAdminSubscriberMessageDeliveryRecord,
  BlogAdminSubscriberMessageDeliveryStatus,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { BlogPersistenceError } from "../blog.errors.js";

interface DeliveryDocument extends BlogAdminSubscriberMessageDeliveryRecord {
  _id?: string;
}

const memoryDeliveries: BlogAdminSubscriberMessageDeliveryRecord[] = [];

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
  return getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.blogAdminSubscriberMessageDeliveries,
  );
}

function stripId(doc: DeliveryDocument): BlogAdminSubscriberMessageDeliveryRecord {
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

export function resetBlogAdminSubscriberMessageDeliveriesForTests(): void {
  memoryDeliveries.length = 0;
}

export async function findBlogAdminSubscriberMessageDelivery(
  adminMessageId: string,
  subscriberId: string,
): Promise<BlogAdminSubscriberMessageDeliveryRecord | null> {
  await ensureReady();
  if (isMemoryStore()) {
    return (
      memoryDeliveries.find(
        (row) => row.adminMessageId === adminMessageId && row.subscriberId === subscriberId,
      ) ?? null
    );
  }
  try {
    const doc = await collection().findOne({ adminMessageId, subscriberId });
    return doc ? stripId(doc) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Admin message delivery.", error);
  }
}

export async function claimBlogAdminSubscriberMessageDelivery(input: {
  adminMessageId: string;
  subscriberId: string;
  maxAttempts: number;
}): Promise<{
  record: BlogAdminSubscriberMessageDeliveryRecord;
  shouldSend: boolean;
  reason: "claimed" | "already_sent" | "max_attempts" | "in_progress_skip";
}> {
  await ensureReady();
  const now = new Date().toISOString();
  const existing = await findBlogAdminSubscriberMessageDelivery(
    input.adminMessageId,
    input.subscriberId,
  );

  if (existing?.status === "sent") {
    return { record: existing, shouldSend: false, reason: "already_sent" };
  }
  if (existing && existing.attemptCount >= input.maxAttempts) {
    return { record: existing, shouldSend: false, reason: "max_attempts" };
  }

  if (isMemoryStore()) {
    if (!existing) {
      const created: BlogAdminSubscriberMessageDeliveryRecord = {
        deliveryId: randomUUID(),
        adminMessageId: input.adminMessageId,
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
    const updated: BlogAdminSubscriberMessageDeliveryRecord = {
      ...existing,
      status: "pending",
      attemptedAt: now,
      attemptCount: existing.attemptCount + 1,
      updatedAt: now,
    };
    const index = memoryDeliveries.findIndex(
      (row) =>
        row.adminMessageId === input.adminMessageId && row.subscriberId === input.subscriberId,
    );
    memoryDeliveries[index] = updated;
    return { record: updated, shouldSend: true, reason: "claimed" };
  }

  try {
    if (!existing) {
      const created: BlogAdminSubscriberMessageDeliveryRecord = {
        deliveryId: randomUUID(),
        adminMessageId: input.adminMessageId,
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
        const raced = await findBlogAdminSubscriberMessageDelivery(
          input.adminMessageId,
          input.subscriberId,
        );
        if (raced?.status === "sent") {
          return { record: raced, shouldSend: false, reason: "already_sent" };
        }
        if (!raced) {
          throw error;
        }
      }
    }

    const bumped = await collection().findOneAndUpdate(
      {
        adminMessageId: input.adminMessageId,
        subscriberId: input.subscriberId,
        status: { $ne: "sent" },
      },
      {
        $set: { status: "pending" as BlogAdminSubscriberMessageDeliveryStatus, attemptedAt: now, updatedAt: now },
        $inc: { attemptCount: 1 },
      },
      { returnDocument: "after" },
    );
    if (!bumped) {
      const again = await findBlogAdminSubscriberMessageDelivery(
        input.adminMessageId,
        input.subscriberId,
      );
      if (again?.status === "sent") {
        return { record: again, shouldSend: false, reason: "already_sent" };
      }
      return {
        record: again ?? existing!,
        shouldSend: false,
        reason: "in_progress_skip",
      };
    }
    return { record: stripId(bumped), shouldSend: true, reason: "claimed" };
  } catch (error) {
    throw new BlogPersistenceError("Failed to claim Admin message delivery.", error);
  }
}

export async function markBlogAdminSubscriberMessageDeliverySent(input: {
  adminMessageId: string;
  subscriberId: string;
}): Promise<BlogAdminSubscriberMessageDeliveryRecord | null> {
  await ensureReady();
  const now = new Date().toISOString();
  if (isMemoryStore()) {
    const index = memoryDeliveries.findIndex(
      (row) =>
        row.adminMessageId === input.adminMessageId && row.subscriberId === input.subscriberId,
    );
    if (index < 0) {
      return null;
    }
    const updated: BlogAdminSubscriberMessageDeliveryRecord = {
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
      { adminMessageId: input.adminMessageId, subscriberId: input.subscriberId },
      { $set: { status: "sent", sentAt: now, updatedAt: now } },
      { returnDocument: "after" },
    );
    return updated ? stripId(updated) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to mark Admin message delivery sent.", error);
  }
}

export async function markBlogAdminSubscriberMessageDeliveryFailed(input: {
  adminMessageId: string;
  subscriberId: string;
  failureCode: string;
}): Promise<BlogAdminSubscriberMessageDeliveryRecord | null> {
  await ensureReady();
  const now = new Date().toISOString();
  const failureCode = input.failureCode.slice(0, 120);
  if (isMemoryStore()) {
    const index = memoryDeliveries.findIndex(
      (row) =>
        row.adminMessageId === input.adminMessageId && row.subscriberId === input.subscriberId,
    );
    if (index < 0) {
      return null;
    }
    const current = memoryDeliveries[index]!;
    if (current.status === "sent") {
      return current;
    }
    const updated: BlogAdminSubscriberMessageDeliveryRecord = {
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
        adminMessageId: input.adminMessageId,
        subscriberId: input.subscriberId,
        status: { $ne: "sent" },
      },
      { $set: { status: "failed", failedAt: now, failureCode, updatedAt: now } },
      { returnDocument: "after" },
    );
    return updated ? stripId(updated) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to mark Admin message delivery failed.", error);
  }
}

export async function claimBlogAdminSubscriberMessageEmailsSentIncrement(input: {
  adminMessageId: string;
  subscriberId: string;
}): Promise<boolean> {
  await ensureReady();
  const now = new Date().toISOString();
  if (isMemoryStore()) {
    const index = memoryDeliveries.findIndex(
      (row) =>
        row.adminMessageId === input.adminMessageId && row.subscriberId === input.subscriberId,
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
        adminMessageId: input.adminMessageId,
        subscriberId: input.subscriberId,
        status: "sent",
        emailsSentIncremented: { $ne: true },
      },
      { $set: { emailsSentIncremented: true, updatedAt: now } },
      { returnDocument: "after" },
    );
    return Boolean(updated);
  } catch (error) {
    throw new BlogPersistenceError(
      "Failed to claim Admin message emailsSent increment.",
      error,
    );
  }
}
