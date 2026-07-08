import type { Document, Filter, IndexDescription } from "mongodb";

import { getMongoCollection } from "./mongo-database.js";

export function entityIdToMongoId(id: string): string {
  return id;
}

export function mongoIdToEntityId(id: unknown): string {
  return String(id);
}

export async function loadRecordMap<T extends object>(
  collectionName: string,
  idField: string,
): Promise<Record<string, T>> {
  const collection = getMongoCollection(collectionName);
  const documents = await collection.find({}).toArray();
  const records: Record<string, T> = {};

  for (const document of documents) {
    const entityId = mongoIdToEntityId(document._id);
    const { _id: _ignored, ...rest } = document;
    records[entityId] = {
      ...rest,
      [idField]: entityId,
    } as T;
  }

  return records;
}

export async function replaceRecordMap<T extends object>(
  collectionName: string,
  records: Record<string, T>,
  idField: string,
): Promise<void> {
  const collection = getMongoCollection(collectionName);
  const ids = Object.keys(records);

  if (ids.length === 0) {
    await collection.deleteMany({});
    return;
  }

  await collection.deleteMany({
    _id: { $nin: ids },
  } as unknown as Filter<Document>);

  const operations = ids.map((id) => {
    const entity = records[id];
    const record = entity as Record<string, unknown>;
    const { [idField]: _ignored, ...rest } = record;

    return {
      replaceOne: {
        filter: { _id: id } as unknown as Filter<Document>,
        replacement: {
          _id: id,
          ...rest,
        } as Document,
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await collection.bulkWrite(operations, { ordered: false });
  }
}

export async function ensureCollectionIndexes(
  collectionName: string,
  indexes: IndexDescription[],
): Promise<void> {
  if (indexes.length === 0) {
    return;
  }

  const collection = getMongoCollection(collectionName);
  await collection.createIndexes(indexes);
}

export async function deleteRecordsByIdPrefix(
  collectionName: string,
  idPrefix: string,
): Promise<void> {
  const collection = getMongoCollection(collectionName);
  await collection.deleteMany({
    _id: { $regex: `^${escapeRegex(idPrefix)}` },
  } as unknown as Filter<Document>);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function countCollectionDocuments(collectionName: string): Promise<number> {
  const collection = getMongoCollection(collectionName);
  return collection.countDocuments();
}

export async function findOneById<T extends Document>(
  collectionName: string,
  id: string,
): Promise<T | null> {
  const collection = getMongoCollection<T>(collectionName);
  return collection.findOne({ _id: id } as unknown as Filter<T>) as Promise<T | null>;
}

export const MONGO_SINGLETON_DOCUMENT_ID = "singleton";

export async function loadSingletonDocument<T extends object>(
  collectionName: string,
  defaults: T,
): Promise<T> {
  const document = await findOneById<T & { _id: string }>(
    collectionName,
    MONGO_SINGLETON_DOCUMENT_ID,
  );

  if (!document) {
    return defaults;
  }

  const record = document as Record<string, unknown>;
  const { _id: _ignored, ...rest } = record;

  return {
    ...defaults,
    ...rest,
  } as T;
}

export async function replaceSingletonDocument<T extends object>(
  collectionName: string,
  document: T,
): Promise<void> {
  const collection = getMongoCollection(collectionName);

  await collection.replaceOne(
    { _id: MONGO_SINGLETON_DOCUMENT_ID } as unknown as Filter<Document>,
    {
      _id: MONGO_SINGLETON_DOCUMENT_ID,
      ...document,
    } as Document,
    { upsert: true },
  );
}
