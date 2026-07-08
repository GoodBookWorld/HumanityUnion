import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeCollaborativeAnalysisPersistenceSnapshot,
  type InitiativeCollaborativeAnalysisPersistenceAdapter,
} from "./initiative-collaborative-analysis-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeCollaborativeAnalysisPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeAnalyses,
      idField: "analysisId",
      select: (snapshot) => snapshot.analyses as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        analyses: records as unknown as Record<string, InitiativeCollaborativeAnalysis>,
      }),
    },
  ],
});

export function createMongoInitiativeCollaborativeAnalysisPersistenceAdapter(): InitiativeCollaborativeAnalysisPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeCollaborativeAnalysisMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_ANALYSIS_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeCollaborativeAnalysisMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_ANALYSIS_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
