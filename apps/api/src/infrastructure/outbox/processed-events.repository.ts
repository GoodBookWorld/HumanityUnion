import type { Document } from "mongodb";

import { MONGO_COLLECTIONS } from "../mongodb/mongo-collections.js";
import { getMongoCollection } from "../mongodb/mongo-database.js";
import { isMongoConfigured } from "../mongodb/mongo-config.js";

export type ProcessedEventStatus = "processing" | "completed" | "failed";

interface ProcessedEventDocument extends Document {
  consumerId: string;
  eventId: string;
  status: ProcessedEventStatus;
  claimedAt: string;
  completedAt: string | null;
  correlationId: string | null;
  lastError: string | null;
}

const PROCESSING_CLAIM_STALE_MS = 5 * 60 * 1000;

export interface ClaimEventProcessingResult {
  claimed: boolean;
  alreadyCompleted: boolean;
  inProgress: boolean;
}

function assertMongoAvailable(): void {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured. Set MONGODB_URI before recording processed events.");
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

function isClaimStale(claimedAt: string): boolean {
  return Date.now() - Date.parse(claimedAt) >= PROCESSING_CLAIM_STALE_MS;
}

export async function claimEventForProcessing(input: {
  consumerId: string;
  eventId: string;
  correlationId: string | null;
}): Promise<ClaimEventProcessingResult> {
  assertMongoAvailable();

  const collection = getMongoCollection<ProcessedEventDocument>(
    MONGO_COLLECTIONS.processedEvents,
  );
  const now = new Date().toISOString();

  try {
    await collection.insertOne({
      consumerId: input.consumerId,
      eventId: input.eventId,
      status: "processing",
      claimedAt: now,
      completedAt: null,
      correlationId: input.correlationId,
      lastError: null,
    });

    return { claimed: true, alreadyCompleted: false, inProgress: false };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  const existing = await collection.findOne({
    consumerId: input.consumerId,
    eventId: input.eventId,
  });

  if (!existing) {
    return claimEventForProcessing(input);
  }

  if (existing.status === "completed") {
    return { claimed: false, alreadyCompleted: true, inProgress: false };
  }

  if (existing.status === "processing" && !isClaimStale(existing.claimedAt)) {
    return { claimed: false, alreadyCompleted: false, inProgress: true };
  }

  const reclaimed = await collection.findOneAndUpdate(
    {
      consumerId: input.consumerId,
      eventId: input.eventId,
      status: { $in: ["processing", "failed"] },
    },
    {
      $set: {
        status: "processing",
        claimedAt: now,
        completedAt: null,
        lastError: null,
        correlationId: input.correlationId,
      },
    },
    { returnDocument: "after" },
  );

  if (reclaimed) {
    return { claimed: true, alreadyCompleted: false, inProgress: false };
  }

  const latest = await collection.findOne({
    consumerId: input.consumerId,
    eventId: input.eventId,
  });

  if (latest?.status === "completed") {
    return { claimed: false, alreadyCompleted: true, inProgress: false };
  }

  return { claimed: false, alreadyCompleted: false, inProgress: true };
}

export async function markEventProcessingCompleted(input: {
  consumerId: string;
  eventId: string;
}): Promise<void> {
  assertMongoAvailable();

  const collection = getMongoCollection<ProcessedEventDocument>(
    MONGO_COLLECTIONS.processedEvents,
  );

  await collection.updateOne(
    {
      consumerId: input.consumerId,
      eventId: input.eventId,
      status: "processing",
    },
    {
      $set: {
        status: "completed",
        completedAt: new Date().toISOString(),
        lastError: null,
      },
    },
  );
}

export async function releaseEventProcessingClaim(input: {
  consumerId: string;
  eventId: string;
  error: unknown;
}): Promise<void> {
  assertMongoAvailable();

  const collection = getMongoCollection<ProcessedEventDocument>(
    MONGO_COLLECTIONS.processedEvents,
  );

  await collection.deleteOne({
    consumerId: input.consumerId,
    eventId: input.eventId,
    status: "processing",
  });
}

export async function isEventProcessed(consumerId: string, eventId: string): Promise<boolean> {
  if (!isMongoConfigured()) {
    return false;
  }

  const collection = getMongoCollection<ProcessedEventDocument>(
    MONGO_COLLECTIONS.processedEvents,
  );
  const existing = await collection.findOne({ consumerId, eventId, status: "completed" });

  return existing !== null;
}

/** @deprecated Use claimEventForProcessing — retained for transitional callers. */
export async function tryMarkEventProcessed(input: {
  consumerId: string;
  eventId: string;
  correlationId: string | null;
}): Promise<boolean> {
  const claim = await claimEventForProcessing(input);
  return claim.claimed;
}

export async function deleteProcessedEventsByEventIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  const collection = getMongoCollection<ProcessedEventDocument>(
    MONGO_COLLECTIONS.processedEvents,
  );
  const result = await collection.deleteMany({ eventId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}

export async function deleteProcessedEventsByConsumerIdPrefix(prefix: string): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  const collection = getMongoCollection<ProcessedEventDocument>(
    MONGO_COLLECTIONS.processedEvents,
  );
  const result = await collection.deleteMany({ consumerId: { $regex: `^${prefix}` } });

  return result.deletedCount ?? 0;
}
