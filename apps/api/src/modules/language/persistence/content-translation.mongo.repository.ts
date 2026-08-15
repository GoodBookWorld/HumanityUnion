import type { ContentTranslationSourceKind, LanguageCode, TranslatedContentRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";

interface ContentTranslationDocument extends TranslatedContentRecord {
  _id?: string;
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MongoDB is not configured for content translations.");
  }
  await connectMongoClient();
}

export async function upsertContentTranslationMongo(
  record: TranslatedContentRecord,
): Promise<TranslatedContentRecord> {
  await ensureMongoReady();
  const collection = getMongoCollection<ContentTranslationDocument>(
    MONGO_COLLECTIONS.contentTranslations,
  );

  await collection.updateOne(
    {
      sourceKind: record.sourceKind,
      sourceRecordId: record.sourceRecordId,
      sourceVersion: record.sourceVersion,
      targetLanguage: record.targetLanguage,
    },
    { $set: { ...record } },
    { upsert: true },
  );

  return record;
}

export async function findContentTranslationMongo(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  sourceVersion: string;
  targetLanguage: LanguageCode;
}): Promise<TranslatedContentRecord | null> {
  await ensureMongoReady();
  const collection = getMongoCollection<ContentTranslationDocument>(
    MONGO_COLLECTIONS.contentTranslations,
  );
  const doc = await collection.findOne({
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    targetLanguage: input.targetLanguage,
  });
  if (!doc) {
    return null;
  }
  const { _id: _ignored, ...record } = doc;
  return record;
}

export async function listContentTranslationsForSourceMongo(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
}): Promise<TranslatedContentRecord[]> {
  await ensureMongoReady();
  const collection = getMongoCollection<ContentTranslationDocument>(
    MONGO_COLLECTIONS.contentTranslations,
  );
  const docs = await collection
    .find({
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
    })
    .toArray();
  return docs.map(({ _id: _ignored, ...record }) => record);
}

export async function markStaleTranslationsForSourceMongo(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  liveSourceVersion: string;
}): Promise<void> {
  await ensureMongoReady();
  const collection = getMongoCollection<ContentTranslationDocument>(
    MONGO_COLLECTIONS.contentTranslations,
  );
  await collection.updateMany(
    {
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      sourceVersion: { $ne: input.liveSourceVersion },
      stale: false,
    },
    {
      $set: {
        stale: true,
        freshness: "stale",
        updatedAt: new Date().toISOString(),
      },
    },
  );
}
