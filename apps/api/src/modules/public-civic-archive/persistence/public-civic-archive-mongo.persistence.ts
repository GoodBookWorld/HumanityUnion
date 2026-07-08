import type { PublicCivicArchiveRecord } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyPublicCivicArchivePersistenceSnapshot,
  type PublicCivicArchivePersistenceAdapter,
} from "./public-civic-archive-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyPublicCivicArchivePersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.publicCivicArchiveRecords,
      idField: "archiveRecordId",
      select: (snapshot) => snapshot.records as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        records: records as unknown as Record<string, PublicCivicArchiveRecord>,
      }),
    },
  ],
});

export function createMongoPublicCivicArchivePersistenceAdapter(): PublicCivicArchivePersistenceAdapter {
  return handles.adapter;
}

export async function hydratePublicCivicArchiveMongoPersistence(): Promise<void> {
  if (process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushPublicCivicArchiveMongoPersistence(): Promise<void> {
  if (process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
