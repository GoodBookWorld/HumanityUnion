import type { InitiativeOfficialResponseLifecycleDraft } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeOfficialResponseLifecycleDraftPersistenceSnapshot,
  type InitiativeOfficialResponseLifecycleDraftPersistenceAdapter,
} from "./initiative-official-response-lifecycle-draft-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeOfficialResponseLifecycleDraftPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeOfficialResponseLifecycleDrafts,
      idField: "initiativeId",
      select: (snapshot) => snapshot.drafts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        drafts: records as unknown as Record<string, InitiativeOfficialResponseLifecycleDraft>,
      }),
    },
  ],
});

export function createMongoInitiativeOfficialResponseLifecycleDraftPersistenceAdapter(): InitiativeOfficialResponseLifecycleDraftPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeOfficialResponseLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_OFFICIAL_RESPONSE_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeOfficialResponseLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_OFFICIAL_RESPONSE_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
