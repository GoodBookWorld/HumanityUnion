import type { InitiativeCollectiveDecision } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeCollectiveDecisionPersistenceSnapshot,
  type InitiativeCollectiveDecisionPersistenceAdapter,
} from "./initiative-collective-decision-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeCollectiveDecisionPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeCollectiveDecisions,
      idField: "decisionId",
      select: (snapshot) => snapshot.decisions as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        decisions: records as unknown as Record<string, InitiativeCollectiveDecision>,
      }),
    },
  ],
});

export function createMongoInitiativeCollectiveDecisionPersistenceAdapter(): InitiativeCollectiveDecisionPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeCollectiveDecisionMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeCollectiveDecisionMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
