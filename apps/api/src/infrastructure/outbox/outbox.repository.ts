import { randomUUID } from "node:crypto";

import type { Document } from "mongodb";

import type { DomainEvent } from "../events/domain-event.js";
import { toCanonicalEnvelope } from "../events/event-envelope.js";
import { serializeDomainEventEnvelope } from "../events/event-serialization.js";
import { logDomainEvent } from "../../shared/observability/logger.js";
import { MONGO_COLLECTIONS } from "../mongodb/mongo-collections.js";
import { getMongoCollection } from "../mongodb/mongo-database.js";
import { isMongoConfigured } from "../mongodb/mongo-config.js";
import type { EnqueueOutboxOptions, OutboxDispatchStats, OutboxRecord } from "./outbox.types.js";

interface OutboxMongoDocument extends Document {
  _id: string;
  eventId: string;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  envelope: string;
  status: OutboxRecord["status"];
  attempts: number;
  lastError: string | null;
  correlationId: string;
  causationId: string | null;
  createdAt: string;
  publishedAt: string | null;
}

function assertMongoAvailable(): void {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured. Set MONGODB_URI before using the outbox.");
  }
}

function mapDocument(document: OutboxMongoDocument): OutboxRecord {
  return {
    outboxId: String(document._id),
    eventId: document.eventId,
    eventName: document.eventName,
    aggregateType: document.aggregateType,
    aggregateId: document.aggregateId,
    envelope: document.envelope,
    status: document.status,
    attempts: document.attempts,
    lastError: document.lastError,
    correlationId: document.correlationId,
    causationId: document.causationId,
    createdAt: document.createdAt,
    publishedAt: document.publishedAt,
  };
}

let forceEnqueueFailureForTests = false;

/** Test-only hook to simulate outbox persistence failure inside a transaction. */
export function setForceEnqueueFailureForTests(enabled: boolean): void {
  forceEnqueueFailureForTests = enabled;
}

export async function enqueueDomainEvent(
  event: DomainEvent,
  options: EnqueueOutboxOptions = {},
): Promise<OutboxRecord> {
  assertMongoAvailable();

  if (forceEnqueueFailureForTests) {
    throw new Error("Forced outbox enqueue failure for tests.");
  }

  const outboxId = randomUUID();
  const envelope = toCanonicalEnvelope(event);
  const serializedEnvelope = serializeDomainEventEnvelope(envelope);
  const createdAt = event.metadata.occurredAt;

  const document: OutboxMongoDocument = {
    _id: outboxId,
    eventId: event.eventId,
    eventName: event.eventName,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    envelope: serializedEnvelope,
    status: "pending",
    attempts: 0,
    lastError: null,
    correlationId: event.metadata.correlationId,
    causationId: event.metadata.causationId,
    createdAt,
    publishedAt: null,
  };

  const collection = getMongoCollection<OutboxMongoDocument>(MONGO_COLLECTIONS.outbox);
  await collection.insertOne(document, { session: options.session });

  const record = mapDocument(document);

  logDomainEvent("enqueued", {
    outboxId: record.outboxId,
    eventId: record.eventId,
    eventName: record.eventName,
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    correlationId: record.correlationId,
    causationId: record.causationId,
  });

  return record;
}

export async function fetchPendingOutboxRecords(limit: number): Promise<OutboxRecord[]> {
  assertMongoAvailable();

  const collection = getMongoCollection<OutboxMongoDocument>(MONGO_COLLECTIONS.outbox);
  const documents = await collection
    .find({ status: "pending" })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();

  return documents.map(mapDocument);
}

export async function markOutboxRecordPublished(outboxId: string): Promise<void> {
  assertMongoAvailable();

  const collection = getMongoCollection<OutboxMongoDocument>(MONGO_COLLECTIONS.outbox);
  await collection.updateOne(
    { _id: outboxId, status: "pending" },
    {
      $set: {
        status: "published",
        publishedAt: new Date().toISOString(),
        lastError: null,
      },
    },
  );
}

export async function markOutboxRecordFailed(
  outboxId: string,
  error: unknown,
  maxAttempts: number,
): Promise<OutboxRecord | null> {
  assertMongoAvailable();

  const collection = getMongoCollection<OutboxMongoDocument>(MONGO_COLLECTIONS.outbox);
  const message = error instanceof Error ? error.message : String(error);
  const existing = await collection.findOne({ _id: outboxId });

  if (!existing) {
    return null;
  }

  const attempts = existing.attempts + 1;
  const status: OutboxRecord["status"] = attempts >= maxAttempts ? "failed" : "pending";

  await collection.updateOne(
    { _id: outboxId },
    {
      $set: {
        attempts,
        lastError: message,
        status,
      },
    },
  );

  const updated = await collection.findOne({ _id: outboxId });

  return updated ? mapDocument(updated as OutboxMongoDocument) : null;
}

export async function getOutboxDispatchStats(): Promise<OutboxDispatchStats> {
  if (!isMongoConfigured()) {
    return {
      pending: 0,
      published: 0,
      failed: 0,
      oldestPendingCreatedAt: null,
    };
  }

  const collection = getMongoCollection<OutboxMongoDocument>(MONGO_COLLECTIONS.outbox);
  const [pending, published, failed, oldestPending] = await Promise.all([
    collection.countDocuments({ status: "pending" }),
    collection.countDocuments({ status: "published" }),
    collection.countDocuments({ status: "failed" }),
    collection.find({ status: "pending" }).sort({ createdAt: 1 }).limit(1).next(),
  ]);

  return {
    pending,
    published,
    failed,
    oldestPendingCreatedAt: oldestPending ? oldestPending.createdAt : null,
  };
}

export async function findOutboxRecordById(outboxId: string): Promise<OutboxRecord | null> {
  assertMongoAvailable();
  const collection = getMongoCollection<OutboxMongoDocument>(MONGO_COLLECTIONS.outbox);
  const document = await collection.findOne({ _id: outboxId });

  return document ? mapDocument(document as OutboxMongoDocument) : null;
}

export async function deleteOutboxRecordsByEventIdPrefix(prefix: string): Promise<number> {
  assertMongoAvailable();
  const collection = getMongoCollection<OutboxMongoDocument>(MONGO_COLLECTIONS.outbox);
  const result = await collection.deleteMany({ eventId: { $regex: `^${prefix}` } });

  return result.deletedCount;
}
