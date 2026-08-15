import type { CommunicationReminder } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import type { ReminderListFilter, ReminderPersistenceAdapter } from "../reminder.types.js";

interface CommunicationReminderDocument extends CommunicationReminder {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is required for reminder persistence.");
  }

  await connectMongoClient();
}

function stripDocument(document: CommunicationReminderDocument): CommunicationReminder {
  const { _id: _ignored, ...record } = document;
  return record;
}

export class MongoReminderPersistenceAdapter implements ReminderPersistenceAdapter {
  readonly mode = "mongodb" as const;

  async insert(reminder: CommunicationReminder): Promise<void> {
    await ensureMongoReady();
    const collection = getMongoCollection<CommunicationReminderDocument>(MONGO_COLLECTIONS.memberReminders);
    await collection.insertOne(reminder);
  }

  async list(filter: ReminderListFilter): Promise<CommunicationReminder[]> {
    await ensureMongoReady();
    const collection = getMongoCollection<CommunicationReminderDocument>(MONGO_COLLECTIONS.memberReminders);

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

  async findActiveByRecipientCategoryAndEntity(
    userId: string,
    category: CommunicationReminder["category"],
    relatedEntityId: string,
  ): Promise<CommunicationReminder | null> {
    await ensureMongoReady();
    const collection = getMongoCollection<CommunicationReminderDocument>(MONGO_COLLECTIONS.memberReminders);
    const document = await collection.findOne({
      recipientUserId: userId,
      category,
      relatedEntityId,
      status: "active",
    });

    return document ? stripDocument(document) : null;
  }

  async findLatestByRecipientCategoryAndEntity(
    userId: string,
    category: CommunicationReminder["category"],
    relatedEntityId: string,
  ): Promise<CommunicationReminder | null> {
    await ensureMongoReady();
    const collection = getMongoCollection<CommunicationReminderDocument>(MONGO_COLLECTIONS.memberReminders);
    const document = await collection.findOne(
      {
        recipientUserId: userId,
        category,
        relatedEntityId,
      },
      { sort: { createdAt: -1 } },
    );

    return document ? stripDocument(document) : null;
  }

  async findById(reminderId: string): Promise<CommunicationReminder | null> {
    await ensureMongoReady();
    const collection = getMongoCollection<CommunicationReminderDocument>(MONGO_COLLECTIONS.memberReminders);
    const document = await collection.findOne({ reminderId });

    return document ? stripDocument(document) : null;
  }

  async update(reminder: CommunicationReminder): Promise<void> {
    await ensureMongoReady();
    const collection = getMongoCollection<CommunicationReminderDocument>(MONGO_COLLECTIONS.memberReminders);

    await collection.updateOne({ reminderId: reminder.reminderId }, { $set: reminder });
  }

  async delete(reminderId: string): Promise<void> {
    await ensureMongoReady();
    const collection = getMongoCollection<CommunicationReminderDocument>(MONGO_COLLECTIONS.memberReminders);
    await collection.deleteOne({ reminderId });
  }

  async deleteByRelatedEntity(relatedEntityType: string, relatedEntityId: string): Promise<number> {
    await ensureMongoReady();
    const collection = getMongoCollection<CommunicationReminderDocument>(MONGO_COLLECTIONS.memberReminders);
    const result = await collection.deleteMany({ relatedEntityType, relatedEntityId });

    return result.deletedCount ?? 0;
  }
}

export function createMongoReminderPersistenceAdapter(): MongoReminderPersistenceAdapter {
  return new MongoReminderPersistenceAdapter();
}

export async function ensureReminderMongoIndexes(): Promise<void> {
  if (!isMongoConfigured() || !isMongoPersistenceMode("REMINDER_PERSISTENCE")) {
    return;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<CommunicationReminderDocument>(MONGO_COLLECTIONS.memberReminders);

  await collection.createIndex({ recipientUserId: 1, createdAt: -1 });
  await collection.createIndex({ recipientUserId: 1, status: 1 });
  await collection.createIndex({ recipientUserId: 1, category: 1, relatedEntityId: 1, status: 1 });
  await collection.createIndex({ relatedEntityType: 1, relatedEntityId: 1 });
}
