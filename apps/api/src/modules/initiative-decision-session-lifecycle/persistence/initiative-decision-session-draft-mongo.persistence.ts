import type { InitiativeDecisionSessionDraft } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeDecisionSessionDraftPersistenceSnapshot,
  type InitiativeDecisionSessionDraftPersistenceAdapter,
} from "./initiative-decision-session-draft-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeDecisionSessionDraftPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeDecisionSessionDrafts,
      idField: "initiativeId",
      select: (snapshot) => snapshot.drafts as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        drafts: records as unknown as Record<string, InitiativeDecisionSessionDraft>,
      }),
    },
  ],
});

export function createMongoInitiativeDecisionSessionDraftPersistenceAdapter(): InitiativeDecisionSessionDraftPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeDecisionSessionDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_DECISION_SESSION_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeDecisionSessionDraftMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_DECISION_SESSION_DRAFT_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
