import type { InitiativeCivicArchiveLifecycleDraft } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeCivicArchiveLifecycleDraftPersistenceSnapshot,
  type InitiativeCivicArchiveLifecycleDraftPersistenceAdapter,
} from "./initiative-civic-archive-lifecycle-draft-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeCivicArchiveLifecycleDraftPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeCivicArchiveLifecycleDrafts,
      idField: "initiativeId",
      select: (snapshot) => snapshot.drafts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        drafts: records as unknown as Record<string, InitiativeCivicArchiveLifecycleDraft>,
      }),
    },
  ],
});

export function createMongoInitiativeCivicArchiveLifecycleDraftPersistenceAdapter(): InitiativeCivicArchiveLifecycleDraftPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeCivicArchiveLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_CIVIC_ARCHIVE_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeCivicArchiveLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_CIVIC_ARCHIVE_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
