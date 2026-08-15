import type { ImplementationTrackingUpdate, InitiativeImplementationTracking } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeImplementationTrackingPersistenceSnapshot,
  type InitiativeImplementationTrackingPersistenceAdapter,
} from "./initiative-implementation-tracking-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeImplementationTrackingPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeImplementationTrackings,
      idField: "trackingId",
      select: (snapshot) => snapshot.trackings as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        trackings: records as unknown as Record<string, InitiativeImplementationTracking>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.implementationTrackingUpdates,
      idField: "updateId",
      select: (snapshot) => snapshot.updates as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        updates: records as unknown as Record<string, ImplementationTrackingUpdate>,
      }),
    },
  ],
});

export function createMongoInitiativeImplementationTrackingPersistenceAdapter(): InitiativeImplementationTrackingPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeImplementationTrackingMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeImplementationTrackingMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
