import type { InitiativePetitionDraft } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativePetitionDraftPersistenceSnapshot,
  type InitiativePetitionDraftPersistenceAdapter,
} from "./initiative-petition-draft-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativePetitionDraftPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativePetitionDrafts,
      idField: "initiativeId",
      select: (snapshot) => snapshot.drafts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        drafts: records as unknown as Record<string, InitiativePetitionDraft>,
      }),
    },
  ],
});

export function createMongoInitiativePetitionDraftPersistenceAdapter(): InitiativePetitionDraftPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativePetitionDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_PETITION_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativePetitionDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_PETITION_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
