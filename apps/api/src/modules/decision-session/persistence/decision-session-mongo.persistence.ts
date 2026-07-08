import type { DecisionSession } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyDecisionSessionPersistenceSnapshot,
  type DecisionSessionPersistenceAdapter,
} from "./decision-session-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyDecisionSessionPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.decisionSessions,
      idField: "sessionId",
      select: (snapshot) => snapshot.sessions as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        sessions: records as unknown as Record<string, DecisionSession>,
      }),
    },
  ],
});

export function createMongoDecisionSessionPersistenceAdapter(): DecisionSessionPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateDecisionSessionMongoPersistence(): Promise<void> {
  if (process.env.DECISION_SESSION_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushDecisionSessionMongoPersistence(): Promise<void> {
  if (process.env.DECISION_SESSION_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
