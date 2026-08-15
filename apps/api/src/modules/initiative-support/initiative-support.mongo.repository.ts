import { randomUUID } from "node:crypto";

import type { InitiativeSupportSignalKind } from "@hu/types";
import type {
  InitiativeSupportBookmarkRecord,
  InitiativeSupportRegisteredSignalRecord,
  InitiativeSupportStoredSignal,
  InitiativeSupportViewRecord,
  InitiativeSupportVisitorSignalRecord,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

type DocumentWithId<T> = T & { _id?: string };

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for initiative support.");
  }

  await connectMongoClient();
}

export async function deleteInitiativeSupportRecordsByInitiativePrefix(
  prefix: string,
): Promise<void> {
  await ensureMongoReady();

  const filter = { initiativeId: { $regex: `^${prefix}` } };
  await Promise.all([
    getMongoCollection(MONGO_COLLECTIONS.initiativeSupportRegisteredSignals).deleteMany(filter),
    getMongoCollection(MONGO_COLLECTIONS.initiativeSupportVisitorSignals).deleteMany(filter),
    getMongoCollection(MONGO_COLLECTIONS.initiativeSupportBookmarks).deleteMany(filter),
    getMongoCollection(MONGO_COLLECTIONS.initiativeSupportViews).deleteMany(filter),
  ]);
}

export async function getRegisteredSupportRecordMongo(
  initiativeId: string,
  actorUserId: string,
): Promise<InitiativeSupportRegisteredSignalRecord | null> {
  await ensureMongoReady();
  const collection = getMongoCollection<DocumentWithId<InitiativeSupportRegisteredSignalRecord>>(
    MONGO_COLLECTIONS.initiativeSupportRegisteredSignals,
  );
  const document = await collection.findOne({ initiativeId, actorUserId });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...record } = document;
  return record;
}

export async function upsertRegisteredSupportRecordMongo(input: {
  initiativeId: string;
  actorUserId: string;
  signal: InitiativeSupportStoredSignal;
  actorCohortSnapshot: "participants" | "members";
}): Promise<InitiativeSupportRegisteredSignalRecord> {
  await ensureMongoReady();
  const collection = getMongoCollection<DocumentWithId<InitiativeSupportRegisteredSignalRecord>>(
    MONGO_COLLECTIONS.initiativeSupportRegisteredSignals,
  );
  const existing = await collection.findOne({
    initiativeId: input.initiativeId,
    actorUserId: input.actorUserId,
  });
  const now = new Date().toISOString();

  const record: InitiativeSupportRegisteredSignalRecord = {
    signalId: existing?.signalId ?? randomUUID(),
    initiativeId: input.initiativeId,
    actorUserId: input.actorUserId,
    actorCohortSnapshot: input.actorCohortSnapshot,
    signal: input.signal,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await collection.updateOne(
    { initiativeId: input.initiativeId, actorUserId: input.actorUserId },
    { $set: record },
    { upsert: true },
  );

  return record;
}

export async function deleteRegisteredSupportRecordMongo(
  initiativeId: string,
  actorUserId: string,
): Promise<void> {
  await ensureMongoReady();
  await getMongoCollection(MONGO_COLLECTIONS.initiativeSupportRegisteredSignals).deleteOne({
    initiativeId,
    actorUserId,
  });
}

export async function listRegisteredSupportRecordsMongo(
  initiativeId: string,
): Promise<InitiativeSupportRegisteredSignalRecord[]> {
  await ensureMongoReady();
  const documents = await getMongoCollection<
    DocumentWithId<InitiativeSupportRegisteredSignalRecord>
  >(MONGO_COLLECTIONS.initiativeSupportRegisteredSignals)
    .find({ initiativeId })
    .toArray();

  return documents.map(({ _id: _ignored, ...record }) => record);
}

export async function getVisitorSupportRecordMongo(
  initiativeId: string,
  visitorKey: string,
): Promise<InitiativeSupportVisitorSignalRecord | null> {
  await ensureMongoReady();
  const document = await getMongoCollection<DocumentWithId<InitiativeSupportVisitorSignalRecord>>(
    MONGO_COLLECTIONS.initiativeSupportVisitorSignals,
  ).findOne({ initiativeId, visitorKey });

  if (!document) {
    return null;
  }

  const { _id: _ignored, ...record } = document;
  return record;
}

export async function upsertVisitorSupportRecordMongo(input: {
  initiativeId: string;
  visitorKey: string;
  signal: InitiativeSupportStoredSignal;
}): Promise<InitiativeSupportVisitorSignalRecord> {
  await ensureMongoReady();
  const collection = getMongoCollection<DocumentWithId<InitiativeSupportVisitorSignalRecord>>(
    MONGO_COLLECTIONS.initiativeSupportVisitorSignals,
  );
  const existing = await collection.findOne({
    initiativeId: input.initiativeId,
    visitorKey: input.visitorKey,
  });
  const now = new Date().toISOString();

  const record: InitiativeSupportVisitorSignalRecord = {
    signalId: existing?.signalId ?? randomUUID(),
    initiativeId: input.initiativeId,
    visitorKey: input.visitorKey,
    signal: input.signal,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await collection.updateOne(
    { initiativeId: input.initiativeId, visitorKey: input.visitorKey },
    { $set: record },
    { upsert: true },
  );

  return record;
}

export async function deleteVisitorSupportRecordMongo(
  initiativeId: string,
  visitorKey: string,
): Promise<void> {
  await ensureMongoReady();
  await getMongoCollection(MONGO_COLLECTIONS.initiativeSupportVisitorSignals).deleteOne({
    initiativeId,
    visitorKey,
  });
}

export async function listVisitorSupportRecordsMongo(
  initiativeId: string,
): Promise<InitiativeSupportVisitorSignalRecord[]> {
  await ensureMongoReady();
  const documents = await getMongoCollection<DocumentWithId<InitiativeSupportVisitorSignalRecord>>(
    MONGO_COLLECTIONS.initiativeSupportVisitorSignals,
  )
    .find({ initiativeId })
    .toArray();

  return documents.map(({ _id: _ignored, ...record }) => record);
}

export async function toggleBookmarkRecordMongo(input: {
  initiativeId: string;
  userId: string;
}): Promise<boolean> {
  await ensureMongoReady();
  const collection = getMongoCollection<DocumentWithId<InitiativeSupportBookmarkRecord>>(
    MONGO_COLLECTIONS.initiativeSupportBookmarks,
  );
  const existing = await collection.findOne({
    initiativeId: input.initiativeId,
    userId: input.userId,
  });

  if (existing) {
    await collection.deleteOne({ initiativeId: input.initiativeId, userId: input.userId });
    return false;
  }

  await collection.insertOne({
    initiativeId: input.initiativeId,
    userId: input.userId,
    createdAt: new Date().toISOString(),
  });

  return true;
}

export async function hasBookmarkRecordMongo(
  initiativeId: string,
  userId: string,
): Promise<boolean> {
  await ensureMongoReady();
  const document = await getMongoCollection(MONGO_COLLECTIONS.initiativeSupportBookmarks).findOne({
    initiativeId,
    userId,
  });

  return Boolean(document);
}

export async function countBookmarkRecordsMongo(initiativeId: string): Promise<number> {
  await ensureMongoReady();
  return getMongoCollection(MONGO_COLLECTIONS.initiativeSupportBookmarks).countDocuments({
    initiativeId,
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

function extractDuplicateKeyPattern(error: unknown): Record<string, unknown> | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { keyPattern?: Record<string, unknown> }).keyPattern;
}

/**
 * Stability Hotfix — narrow duplicate-key classifier for
 * `initiative_support_views`. This collection carries exactly one unique
 * index (`initiative_support_view_unique` on `{ initiativeId, viewerKey }`),
 * so an E11000 raised by the `updateOne(..., { upsert: true })` below —
 * filtered on that same natural key — can only ever be that index. The
 * `keyPattern` check (mirroring `participant-action.repository.ts`) is kept
 * as an extra guard so an unrelated duplicate-key error (e.g. a future
 * second unique index on this collection) is never misclassified as this
 * view's own idempotent replay and rethrows instead.
 */
export function isInitiativeViewUniqueIndexConflict(error: unknown): boolean {
  if (!isDuplicateKeyError(error)) {
    return false;
  }

  const keyPattern = extractDuplicateKeyPattern(error);

  if (!keyPattern) {
    return true;
  }

  return "initiativeId" in keyPattern && "viewerKey" in keyPattern;
}

export async function recordViewMongo(input: {
  initiativeId: string;
  viewerKey: string;
}): Promise<number> {
  await ensureMongoReady();
  const collection = getMongoCollection<DocumentWithId<InitiativeSupportViewRecord>>(
    MONGO_COLLECTIONS.initiativeSupportViews,
  );

  try {
    // Atomic create-or-noop: the unique index on { initiativeId, viewerKey }
    // is what enforces "one unique view per viewer" (Part 1's established
    // meaning), not an application-level check-then-insert race. $setOnInsert
    // means a repeat view never rewrites the original viewedAt and never
    // creates a second row — no findOne read step, so there is no window
    // between "check" and "write" for two concurrent repeat views to race
    // through.
    await collection.updateOne(
      { initiativeId: input.initiativeId, viewerKey: input.viewerKey },
      {
        $setOnInsert: {
          initiativeId: input.initiativeId,
          viewerKey: input.viewerKey,
          viewedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (!isInitiativeViewUniqueIndexConflict(error)) {
      throw error;
    }

    // Two concurrent upserts for the exact same (initiativeId, viewerKey)
    // can still both attempt the insert half of the upsert; MongoDB
    // guarantees exactly one wins and the loser surfaces E11000 rather than
    // silently retrying. That row is this caller's view, already durably
    // recorded by the winner — treat the loss as idempotent success.
  }

  return collection.countDocuments({ initiativeId: input.initiativeId });
}

export async function countViewRecordsMongo(initiativeId: string): Promise<number> {
  await ensureMongoReady();
  return getMongoCollection(MONGO_COLLECTIONS.initiativeSupportViews).countDocuments({
    initiativeId,
  });
}

export async function getCurrentUserSignalMongo(input: {
  initiativeId: string;
  userId?: string | null;
  visitorKeyValue?: string | null;
}): Promise<InitiativeSupportSignalKind> {
  if (input.userId) {
    const record = await getRegisteredSupportRecordMongo(input.initiativeId, input.userId);
    return record?.signal ?? "none";
  }

  if (input.visitorKeyValue) {
    const record = await getVisitorSupportRecordMongo(input.initiativeId, input.visitorKeyValue);
    return record?.signal ?? "none";
  }

  return "none";
}
