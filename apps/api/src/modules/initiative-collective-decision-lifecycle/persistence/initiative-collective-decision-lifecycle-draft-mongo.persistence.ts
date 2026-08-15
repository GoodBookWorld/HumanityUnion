import type { InitiativeCollectiveDecisionLifecycleDraft } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot,
  type InitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter,
} from "./initiative-collective-decision-lifecycle-draft-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeCollectiveDecisionLifecycleDrafts,
      idField: "initiativeId",
      select: (snapshot) => snapshot.drafts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        drafts: records as unknown as Record<string, InitiativeCollectiveDecisionLifecycleDraft>,
      }),
    },
  ],
});

export function createMongoInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter(): InitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeCollectiveDecisionLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_COLLECTIVE_DECISION_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeCollectiveDecisionLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_COLLECTIVE_DECISION_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
