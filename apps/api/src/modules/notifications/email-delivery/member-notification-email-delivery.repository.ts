/**
 * HU-NOTIF-02C.1 — Mongo + memory ledger repository.
 * No SMTP. Idempotent insert by (notificationId, channel).
 */

import type {
  MemberNotificationEmailDeliveryGapRecord,
  MemberNotificationEmailDeliveryRecord,
} from "@hu/types";
import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";

interface DeliveryDocument extends MemberNotificationEmailDeliveryRecord {
  _id?: string;
}

interface GapDocument extends MemberNotificationEmailDeliveryGapRecord {
  _id?: string;
}

const memoryDeliveries: MemberNotificationEmailDeliveryRecord[] = [];
const memoryGaps: MemberNotificationEmailDeliveryGapRecord[] = [];
let forceMemoryForTests = false;

export function setMemberNotificationEmailDeliveryForceMemoryForTests(
  enabled: boolean,
): void {
  forceMemoryForTests = enabled;
}

export function resetMemberNotificationEmailDeliveryStoreForTests(): void {
  memoryDeliveries.length = 0;
  memoryGaps.length = 0;
}

function shouldUseMemory(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }
  await connectMongoClient();
}

function stripDelivery(document: DeliveryDocument): MemberNotificationEmailDeliveryRecord {
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

export async function findMemberNotificationEmailDeliveryByNotificationAndChannel(input: {
  notificationId: string;
  channel: MemberNotificationEmailDeliveryRecord["channel"];
}): Promise<MemberNotificationEmailDeliveryRecord | null> {
  if (shouldUseMemory()) {
    return (
      memoryDeliveries.find(
        (row) =>
          row.notificationId === input.notificationId && row.channel === input.channel,
      ) ?? null
    );
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const document = await collection.findOne({
    notificationId: input.notificationId,
    channel: input.channel,
  });
  return document ? stripDelivery(document) : null;
}

export async function findMemberNotificationEmailDeliveryById(
  deliveryId: string,
): Promise<MemberNotificationEmailDeliveryRecord | null> {
  if (shouldUseMemory()) {
    return memoryDeliveries.find((row) => row.deliveryId === deliveryId) ?? null;
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const document = await collection.findOne({ deliveryId });
  return document ? stripDelivery(document) : null;
}

export async function listMemberNotificationEmailDeliveriesForTests(): Promise<
  MemberNotificationEmailDeliveryRecord[]
> {
  if (shouldUseMemory()) {
    return memoryDeliveries.map((row) => structuredClone(row));
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );
  const documents = await collection.find({}).toArray();
  return documents.map(stripDelivery);
}

/**
 * Insert ledger row. On duplicate (notificationId, channel), returns existing.
 */
export async function insertMemberNotificationEmailDelivery(
  record: MemberNotificationEmailDeliveryRecord,
  options: { session?: ClientSession } = {},
): Promise<{ record: MemberNotificationEmailDeliveryRecord; inserted: boolean }> {
  if (shouldUseMemory()) {
    const existing = memoryDeliveries.find(
      (row) =>
        row.notificationId === record.notificationId && row.channel === record.channel,
    );
    if (existing) {
      return { record: structuredClone(existing), inserted: false };
    }
    if (memoryDeliveries.some((row) => row.deliveryId === record.deliveryId)) {
      return { record: structuredClone(record), inserted: false };
    }
    memoryDeliveries.push(structuredClone(record));
    return { record: structuredClone(record), inserted: true };
  }

  await ensureMongoReady();
  const collection = getMongoCollection<DeliveryDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );

  try {
    await collection.insertOne(record, options.session ? { session: options.session } : undefined);
    return { record, inserted: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
    const existing = await findMemberNotificationEmailDeliveryByNotificationAndChannel({
      notificationId: record.notificationId,
      channel: record.channel,
    });
    if (existing) {
      return { record: existing, inserted: false };
    }
    throw error;
  }
}

/**
 * Stable gap identity: gapId === notificationId (one gap row per notification).
 * Re-recording updates reason without creating duplicates.
 */
export async function recordMemberNotificationEmailDeliveryGap(input: {
  notificationId: string;
  recipientUserId: string;
  eventType: MemberNotificationEmailDeliveryRecord["eventType"];
  reason: string;
}): Promise<MemberNotificationEmailDeliveryGapRecord> {
  const now = new Date().toISOString();
  const reason = input.reason.slice(0, 500);

  if (shouldUseMemory()) {
    const existingIndex = memoryGaps.findIndex(
      (gap) => gap.notificationId === input.notificationId,
    );
    if (existingIndex >= 0) {
      const existing = memoryGaps[existingIndex]!;
      const updated: MemberNotificationEmailDeliveryGapRecord = {
        ...existing,
        reason,
        recipientUserId: input.recipientUserId,
        eventType: input.eventType,
      };
      memoryGaps[existingIndex] = updated;
      return structuredClone(updated);
    }
    const gap: MemberNotificationEmailDeliveryGapRecord = {
      gapId: input.notificationId,
      notificationId: input.notificationId,
      recipientUserId: input.recipientUserId,
      eventType: input.eventType,
      reason,
      createdAt: now,
    };
    memoryGaps.push(structuredClone(gap));
    return structuredClone(gap);
  }

  await ensureMongoReady();
  const collection = getMongoCollection<GapDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveryGaps,
  );

  const existing = await collection.findOne({ notificationId: input.notificationId });
  if (existing) {
    await collection.updateOne(
      { notificationId: input.notificationId },
      {
        $set: {
          reason,
          recipientUserId: input.recipientUserId,
          eventType: input.eventType,
        },
      },
    );
    const { _id: _ignored, ...record } = existing;
    return {
      ...record,
      reason,
      recipientUserId: input.recipientUserId,
      eventType: input.eventType,
    };
  }

  const gap: MemberNotificationEmailDeliveryGapRecord = {
    gapId: input.notificationId,
    notificationId: input.notificationId,
    recipientUserId: input.recipientUserId,
    eventType: input.eventType,
    reason,
    createdAt: now,
  };

  try {
    await collection.insertOne(gap);
    return gap;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
    const raced = await collection.findOne({ notificationId: input.notificationId });
    if (!raced) {
      throw error;
    }
    const { _id: _ignored, ...record } = raced;
    return record;
  }
}

export async function listMemberNotificationEmailDeliveryGaps(input?: {
  sinceIso?: string;
}): Promise<MemberNotificationEmailDeliveryGapRecord[]> {
  if (shouldUseMemory()) {
    return memoryGaps
      .filter((gap) => !input?.sinceIso || gap.createdAt >= input.sinceIso)
      .map((gap) => structuredClone(gap));
  }

  await ensureMongoReady();
  const collection = getMongoCollection<GapDocument>(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveryGaps,
  );
  const query = input?.sinceIso ? { createdAt: { $gte: input.sinceIso } } : {};
  const documents = await collection.find(query).sort({ createdAt: 1 }).toArray();
  return documents.map(({ _id: _ignored, ...record }) => record);
}
