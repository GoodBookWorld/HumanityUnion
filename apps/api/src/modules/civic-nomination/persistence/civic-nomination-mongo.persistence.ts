import type { CivicNomination } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyCivicNominationPersistenceSnapshot,
  type CivicNominationPersistenceAdapter,
} from "./civic-nomination-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyCivicNominationPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.civicNominations,
      idField: "nominationId",
      select: (snapshot) => snapshot.nominations as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        nominations: records as unknown as Record<string, CivicNomination>,
      }),
    },
  ],
});

export function createMongoCivicNominationPersistenceAdapter(): CivicNominationPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateCivicNominationMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_NOMINATION_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushCivicNominationMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_NOMINATION_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
