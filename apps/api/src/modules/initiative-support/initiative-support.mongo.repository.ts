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

export async function recordViewMongo(input: {
  initiativeId: string;
  viewerKey: string;
}): Promise<number> {
  await ensureMongoReady();
  const collection = getMongoCollection<DocumentWithId<InitiativeSupportViewRecord>>(
    MONGO_COLLECTIONS.initiativeSupportViews,
  );
  const existing = await collection.findOne({
    initiativeId: input.initiativeId,
    viewerKey: input.viewerKey,
  });

  if (!existing) {
    await collection.insertOne({
      initiativeId: input.initiativeId,
      viewerKey: input.viewerKey,
      viewedAt: new Date().toISOString(),
    });
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
