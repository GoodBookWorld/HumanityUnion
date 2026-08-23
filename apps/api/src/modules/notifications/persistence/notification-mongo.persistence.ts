import type { MemberNotification } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import type {
  NotificationListFilter,
  NotificationPersistenceAdapter,
} from "../notification.types.js";

interface MemberNotificationDocument extends MemberNotification {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is required for notification persistence.");
  }

  await connectMongoClient();
}

function stripDocument(document: MemberNotificationDocument): MemberNotification {
  const { _id: _ignored, ...record } = document;
  return record;
}

export class MongoNotificationPersistenceAdapter implements NotificationPersistenceAdapter {
  readonly mode = "mongodb" as const;

  async insert(notification: MemberNotification): Promise<void> {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberNotificationDocument>(
      MONGO_COLLECTIONS.memberNotifications,
    );
    await collection.insertOne(notification);
  }

  async list(filter: NotificationListFilter): Promise<MemberNotification[]> {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberNotificationDocument>(
      MONGO_COLLECTIONS.memberNotifications,
    );

    const query: Record<string, unknown> = {
      recipientUserId: filter.userId,
    };

    if (filter.status && filter.status !== "all") {
      query.status = filter.status;
    }

    const documents = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(filter.offset ?? 0)
      .limit(filter.limit ?? 50)
      .toArray();

    return documents.map(stripDocument);
  }

  async countByUserId(userId: string, status?: MemberNotification["status"]): Promise<number> {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberNotificationDocument>(
      MONGO_COLLECTIONS.memberNotifications,
    );

    const query: Record<string, unknown> = {
      recipientUserId: userId,
    };

    if (status) {
      query.status = status;
    }

    return collection.countDocuments(query);
  }

  async findById(notificationId: string): Promise<MemberNotification | null> {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberNotificationDocument>(
      MONGO_COLLECTIONS.memberNotifications,
    );
    const document = await collection.findOne({ notificationId });

    return document ? stripDocument(document) : null;
  }

  async update(notification: MemberNotification): Promise<void> {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberNotificationDocument>(
      MONGO_COLLECTIONS.memberNotifications,
    );

    await collection.updateOne(
      { notificationId: notification.notificationId },
      { $set: notification },
    );
  }

  async delete(notificationId: string): Promise<void> {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberNotificationDocument>(
      MONGO_COLLECTIONS.memberNotifications,
    );
    await collection.deleteOne({ notificationId });
  }

  async deleteArchivedByUserId(userId: string): Promise<number> {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberNotificationDocument>(
      MONGO_COLLECTIONS.memberNotifications,
    );
    const result = await collection.deleteMany({
      recipientUserId: userId,
      status: "archived",
    });
    return result.deletedCount ?? 0;
  }

  async deleteByRelatedEntity(
    relatedEntityType: MemberNotification["relatedEntityType"],
    relatedEntityId: string,
  ): Promise<number> {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberNotificationDocument>(
      MONGO_COLLECTIONS.memberNotifications,
    );

    const result = await collection.deleteMany({ relatedEntityType, relatedEntityId });

    return result.deletedCount ?? 0;
  }

  async existsForRecipientEventAndRelatedEntity(input: {
    recipientUserId: string;
    eventType: MemberNotification["eventType"];
    relatedEntityType: MemberNotification["relatedEntityType"];
    relatedEntityId: string;
  }): Promise<boolean> {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberNotificationDocument>(
      MONGO_COLLECTIONS.memberNotifications,
    );
    const found = await collection.findOne(
      {
        recipientUserId: input.recipientUserId,
        eventType: input.eventType,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
      },
      { projection: { notificationId: 1 } },
    );
    return Boolean(found);
  }
}

export function createMongoNotificationPersistenceAdapter(): MongoNotificationPersistenceAdapter {
  return new MongoNotificationPersistenceAdapter();
}

export async function ensureNotificationMongoIndexes(): Promise<void> {
  if (!isMongoConfigured() || !isMongoPersistenceMode("NOTIFICATION_PERSISTENCE")) {
    return;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<MemberNotificationDocument>(
    MONGO_COLLECTIONS.memberNotifications,
  );

  await collection.createIndex({ recipientUserId: 1, createdAt: -1 });
  await collection.createIndex({ recipientProfileId: 1, createdAt: -1 });
  await collection.createIndex({ recipientUserId: 1, status: 1 });
  await collection.createIndex({ priority: 1 });
  await collection.createIndex({ relatedEntityType: 1, relatedEntityId: 1 });
}
