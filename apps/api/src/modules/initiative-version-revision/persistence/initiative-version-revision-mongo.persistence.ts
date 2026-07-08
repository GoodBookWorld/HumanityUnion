import type { InitiativeRevisionDraft, InitiativeVersionRevision } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeVersionRevisionPersistenceSnapshot,
  type InitiativeVersionRevisionPersistenceAdapter,
} from "./initiative-version-revision-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeVersionRevisionPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeVersionRevisions,
      idField: "revisionId",
      select: (snapshot) => snapshot.revisions as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        revisions: records as unknown as Record<string, InitiativeVersionRevision>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.initiativeRevisionDrafts,
      idField: "initiativeId",
      select: (snapshot) => snapshot.drafts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        drafts: records as unknown as Record<string, InitiativeRevisionDraft>,
      }),
    },
  ],
});

export function createMongoInitiativeVersionRevisionPersistenceAdapter(): InitiativeVersionRevisionPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeVersionRevisionMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeVersionRevisionMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
