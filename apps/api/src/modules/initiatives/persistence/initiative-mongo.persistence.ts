import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import type { Initiative } from "@hu/types";

import {
  createEmptyInitiativePersistenceSnapshot,
  type InitiativePersistenceAdapter,
} from "./initiative-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativePersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiatives,
      idField: "initiativeId",
      select: (snapshot) => snapshot.initiatives as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        initiatives: records as unknown as Record<string, Initiative>,
      }),
    },
  ],
});

export function createMongoInitiativePersistenceAdapter(): InitiativePersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
