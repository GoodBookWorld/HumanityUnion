import type { InitiativePublicImpactLifecycleDraft } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativePublicImpactLifecycleDraftPersistenceSnapshot,
  type InitiativePublicImpactLifecycleDraftPersistenceAdapter,
} from "./initiative-public-impact-lifecycle-draft-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativePublicImpactLifecycleDraftPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativePublicImpactLifecycleDrafts,
      idField: "initiativeId",
      select: (snapshot) => snapshot.drafts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        drafts: records as unknown as Record<string, InitiativePublicImpactLifecycleDraft>,
      }),
    },
  ],
});

export function createMongoInitiativePublicImpactLifecycleDraftPersistenceAdapter(): InitiativePublicImpactLifecycleDraftPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativePublicImpactLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_PUBLIC_IMPACT_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativePublicImpactLifecycleDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_PUBLIC_IMPACT_LIFECYCLE_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
