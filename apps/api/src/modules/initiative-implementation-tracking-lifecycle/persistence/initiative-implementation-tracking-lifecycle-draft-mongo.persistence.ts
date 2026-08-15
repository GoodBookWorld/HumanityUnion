import type { InitiativeImplementationTrackingLifecycleDraft } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot,
  type InitiativeImplementationTrackingLifecycleDraftPersistenceAdapter,
} from "./initiative-implementation-tracking-lifecycle-draft-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeImplementationTrackingLifecycleDrafts,
      idField: "initiativeId",
      select: (snapshot) => snapshot.drafts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        drafts: records as unknown as Record<string, InitiativeImplementationTrackingLifecycleDraft>,
      }),
    },
  ],
});

export function createMongoInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter(): InitiativeImplementationTrackingLifecycleDraftPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeImplementationTrackingLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_IMPLEMENTATION_TRACKING_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeImplementationTrackingLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_IMPLEMENTATION_TRACKING_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
