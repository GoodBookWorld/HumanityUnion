import type { CivicActionPackage } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyCivicActionPackagePersistenceSnapshot,
  type CivicActionPackagePersistenceAdapter,
} from "./civic-action-package-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyCivicActionPackagePersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.civicActionPackages,
      idField: "capId",
      select: (snapshot) => snapshot.packages as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        packages: records as unknown as Record<string, CivicActionPackage>,
      }),
    },
  ],
});

export function createMongoCivicActionPackagePersistenceAdapter(): CivicActionPackagePersistenceAdapter {
  return handles.adapter;
}

export async function hydrateCivicActionPackageMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_ACTION_PACKAGE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushCivicActionPackageMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_ACTION_PACKAGE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
