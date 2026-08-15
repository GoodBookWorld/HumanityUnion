import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { getMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import type { StoredMediaRecord } from "../media-upload.types.js";
import {
  fromMediaUploadMongoDocument,
  toMediaUploadMongoDocument,
  type MediaUploadMongoDocument,
} from "./media-upload.mongo-document.js";

function collection() {
  return getMongoCollection<MediaUploadMongoDocument>(MONGO_COLLECTIONS.mediaUploadRecords);
}

export function canPersistMediaUploadMetadata(): boolean {
  if (!isMongoConfigured()) {
    return false;
  }

  try {
    getMongoClient();
    return true;
  } catch {
    // Mongo URI may be present in local .env while unit tests run without bootstrap.
    return false;
  }
}

export async function upsertMediaUploadRecord(record: StoredMediaRecord): Promise<void> {
  if (!canPersistMediaUploadMetadata()) {
    return;
  }

  await collection().replaceOne(
    { mediaId: record.mediaId },
    toMediaUploadMongoDocument(record),
    { upsert: true },
  );
}

export async function deleteMediaUploadRecord(mediaId: string): Promise<void> {
  if (!canPersistMediaUploadMetadata()) {
    return;
  }

  await collection().deleteOne({ mediaId });
}

export async function listAllMediaUploadRecords(): Promise<StoredMediaRecord[]> {
  if (!canPersistMediaUploadMetadata()) {
    return [];
  }

  const documents = await collection().find({}).toArray();
  return documents.map(fromMediaUploadMongoDocument);
}
