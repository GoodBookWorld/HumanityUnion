import type { CivicAccountability, CivicAccountabilityEvent } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyCivicAccountabilityPersistenceSnapshot,
  type CivicAccountabilityPersistenceAdapter,
} from "./civic-accountability-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyCivicAccountabilityPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.civicAccountabilities,
      idField: "accountabilityId",
      select: (snapshot) => snapshot.accountabilities as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        accountabilities: records as unknown as Record<string, CivicAccountability>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.civicAccountabilityEvents,
      idField: "eventId",
      select: (snapshot) => snapshot.events as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        events: records as unknown as Record<string, CivicAccountabilityEvent>,
      }),
    },
  ],
});

export function createMongoCivicAccountabilityPersistenceAdapter(): CivicAccountabilityPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateCivicAccountabilityMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_ACCOUNTABILITY_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushCivicAccountabilityMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_ACCOUNTABILITY_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
