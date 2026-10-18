import { randomUUID } from "node:crypto";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  WEB_SYSTEM_HEALTH_MAX_STORED_EVENTS,
  toWebSystemHealthEventView,
  type WebSystemHealthEventRecord,
  type WebSystemHealthEventView,
} from "./web-system-health-event.js";

interface WebSystemHealthEventDocument extends WebSystemHealthEventRecord {
  _id?: string;
}

const memoryEvents: WebSystemHealthEventRecord[] = [];
let forceMemoryForTests = false;

export function setWebSystemHealthEventForceMemoryForTests(enabled: boolean): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("System health memory store is available only when NODE_TEST_ENV=true.");
  }
  forceMemoryForTests = enabled;
  if (!enabled) {
    memoryEvents.length = 0;
  }
}

export function resetWebSystemHealthEventMemoryForTests(): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("System health memory store is available only when NODE_TEST_ENV=true.");
  }
  memoryEvents.length = 0;
}

function useMemoryStore(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

function compareNewestFirst(a: WebSystemHealthEventRecord, b: WebSystemHealthEventRecord): number {
  const byTime = b.occurredAt.localeCompare(a.occurredAt);
  if (byTime !== 0) {
    return byTime;
  }
  return b.eventId.localeCompare(a.eventId);
}

function collection() {
  return getMongoCollection<WebSystemHealthEventDocument>(MONGO_COLLECTIONS.webSystemHealthEvents);
}

export async function insertWebSystemHealthEvent(
  record: WebSystemHealthEventRecord,
): Promise<void> {
  const stored: WebSystemHealthEventRecord = {
    ...record,
    eventId: randomUUID(),
  };

  if (useMemoryStore()) {
    memoryEvents.push(stored);
    memoryEvents.sort(compareNewestFirst);
    if (memoryEvents.length > WEB_SYSTEM_HEALTH_MAX_STORED_EVENTS) {
      memoryEvents.length = WEB_SYSTEM_HEALTH_MAX_STORED_EVENTS;
    }
    return;
  }

  await connectMongoClient();
  const coll = collection();
  await coll.insertOne({ ...stored });
  const overflow = await coll
    .find({}, { projection: { _id: 1 } })
    .sort({ occurredAt: -1, eventId: -1 })
    .skip(WEB_SYSTEM_HEALTH_MAX_STORED_EVENTS)
    .limit(WEB_SYSTEM_HEALTH_MAX_STORED_EVENTS)
    .toArray();
  if (overflow.length > 0) {
    await coll.deleteMany({ _id: { $in: overflow.map((doc) => doc._id) } });
  }
}

export async function listWebSystemHealthEvents(
  now: Date = new Date(),
): Promise<WebSystemHealthEventView[]> {
  const cutoff = now.getTime();

  if (useMemoryStore()) {
    return memoryEvents
      .filter((event) => event.expiresAt.getTime() > cutoff)
      .sort(compareNewestFirst)
      .slice(0, WEB_SYSTEM_HEALTH_MAX_STORED_EVENTS)
      .map(toWebSystemHealthEventView);
  }

  await connectMongoClient();
  const docs = await collection()
    .find({ expiresAt: { $gt: now } })
    .sort({ occurredAt: -1, eventId: -1 })
    .limit(WEB_SYSTEM_HEALTH_MAX_STORED_EVENTS)
    .toArray();

  return docs.map((doc) => {
    const { _id: _ignored, ...record } = doc;
    return toWebSystemHealthEventView(record);
  });
}

export async function countStoredWebSystemHealthEventsForTests(): Promise<number> {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("System health counts are available only when NODE_TEST_ENV=true.");
  }
  if (useMemoryStore()) {
    return memoryEvents.length;
  }
  await connectMongoClient();
  return collection().countDocuments();
}
