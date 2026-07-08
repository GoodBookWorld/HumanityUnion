import type { InitiativePublicImpact, PublicImpactEvidence } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativePublicImpactPersistenceSnapshot,
  type InitiativePublicImpactPersistenceAdapter,
} from "./initiative-public-impact-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativePublicImpactPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativePublicImpacts,
      idField: "impactId",
      select: (snapshot) => snapshot.impacts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        impacts: records as unknown as Record<string, InitiativePublicImpact>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.publicImpactEvidence,
      idField: "evidenceId",
      select: (snapshot) => snapshot.evidence as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        evidence: records as unknown as Record<string, PublicImpactEvidence>,
      }),
    },
  ],
});

export function createMongoInitiativePublicImpactPersistenceAdapter(): InitiativePublicImpactPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativePublicImpactMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_PUBLIC_IMPACT_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativePublicImpactMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_PUBLIC_IMPACT_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
