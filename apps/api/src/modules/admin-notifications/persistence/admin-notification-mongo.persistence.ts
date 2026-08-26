import type { AdminNotification } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import type {
  AdminNotificationListFilter,
  AdminNotificationPersistenceAdapter,
} from "../admin-notification.types.js";
import { ADMIN_NOTIFICATION_DEFAULT_LIST_LIMIT } from "../admin-notification.types.js";

interface AdminNotificationDocument extends AdminNotification {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is required for Admin notification persistence.");
  }
  await connectMongoClient();
}

function stripDocument(document: AdminNotificationDocument): AdminNotification {
  const { _id: _ignored, ...record } = document;
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

export class MongoAdminNotificationPersistenceAdapter
  implements AdminNotificationPersistenceAdapter
{
  readonly mode = "mongodb" as const;

  async insertIfAbsent(notification: AdminNotification): Promise<boolean> {
    await ensureMongoReady();
    const collection = getMongoCollection<AdminNotificationDocument>(
      MONGO_COLLECTIONS.adminNotifications,
    );
    try {
      await collection.insertOne(notification);
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error) && notification.sourceEventId) {
        return false;
      }
      throw error;
    }
  }

  async list(filter: AdminNotificationListFilter): Promise<AdminNotification[]> {
    await ensureMongoReady();
    const collection = getMongoCollection<AdminNotificationDocument>(
      MONGO_COLLECTIONS.adminNotifications,
    );
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? ADMIN_NOTIFICATION_DEFAULT_LIST_LIMIT;
    const docs = await collection
      .find({ recipientAdminUserId: filter.recipientAdminUserId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    return docs.map(stripDocument);
  }

  async countByRecipient(recipientAdminUserId: string): Promise<number> {
    await ensureMongoReady();
    const collection = getMongoCollection<AdminNotificationDocument>(
      MONGO_COLLECTIONS.adminNotifications,
    );
    return collection.countDocuments({ recipientAdminUserId });
  }

  async findById(adminNotificationId: string): Promise<AdminNotification | null> {
    await ensureMongoReady();
    const collection = getMongoCollection<AdminNotificationDocument>(
      MONGO_COLLECTIONS.adminNotifications,
    );
    const doc = await collection.findOne({ adminNotificationId });
    return doc ? stripDocument(doc) : null;
  }

  async deleteOwned(input: {
    adminNotificationId: string;
    recipientAdminUserId: string;
  }): Promise<boolean> {
    await ensureMongoReady();
    const collection = getMongoCollection<AdminNotificationDocument>(
      MONGO_COLLECTIONS.adminNotifications,
    );
    const result = await collection.deleteOne({
      adminNotificationId: input.adminNotificationId,
      recipientAdminUserId: input.recipientAdminUserId,
    });
    return (result.deletedCount ?? 0) > 0;
  }

  async updateBySourceEventId(input: {
    sourceEventId: string;
    title?: string;
    targetLabel?: string;
    severity?: AdminNotification["severity"];
  }): Promise<number> {
    await ensureMongoReady();
    const collection = getMongoCollection<AdminNotificationDocument>(
      MONGO_COLLECTIONS.adminNotifications,
    );
    const $set: Record<string, unknown> = {};
    if (input.title) {
      $set.title = input.title;
    }
    if (input.targetLabel) {
      $set.targetLabel = input.targetLabel;
    }
    if (input.severity) {
      $set.severity = input.severity;
    }
    if (Object.keys($set).length === 0) {
      return 0;
    }
    const result = await collection.updateMany({ sourceEventId: input.sourceEventId }, { $set });
    return result.modifiedCount ?? 0;
  }
}

export function createMongoAdminNotificationPersistenceAdapter(): MongoAdminNotificationPersistenceAdapter {
  return new MongoAdminNotificationPersistenceAdapter();
}
