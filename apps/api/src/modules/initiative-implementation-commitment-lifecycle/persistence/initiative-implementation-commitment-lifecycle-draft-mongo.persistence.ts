import type { InitiativeImplementationCommitmentLifecycleDraft } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot,
  type InitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter,
} from "./initiative-implementation-commitment-lifecycle-draft-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeImplementationCommitmentLifecycleDrafts,
      idField: "initiativeId",
      select: (snapshot) => snapshot.drafts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        drafts: records as unknown as Record<string, InitiativeImplementationCommitmentLifecycleDraft>,
      }),
    },
  ],
});

export function createMongoInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter(): InitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeImplementationCommitmentLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_IMPLEMENTATION_COMMITMENT_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeImplementationCommitmentLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_IMPLEMENTATION_COMMITMENT_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
