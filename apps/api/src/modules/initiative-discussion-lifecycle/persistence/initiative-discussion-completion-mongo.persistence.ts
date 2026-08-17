import type { InitiativeDiscussionCompletion } from "./initiative-discussion-completion-persistence.types.js";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeDiscussionCompletionPersistenceSnapshot,
  type InitiativeDiscussionCompletionPersistenceAdapter,
} from "./initiative-discussion-completion-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeDiscussionCompletionPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeDiscussionCompletions,
      idField: "initiativeId",
      select: (snapshot) => snapshot.completions as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        completions: records as unknown as Record<string, InitiativeDiscussionCompletion>,
      }),
    },
  ],
});

export function createMongoInitiativeDiscussionCompletionPersistenceAdapter(): InitiativeDiscussionCompletionPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeDiscussionCompletionMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_DISCUSSION_LIFECYCLE_COMPLETION_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeDiscussionCompletionMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("INITIATIVE_DISCUSSION_LIFECYCLE_COMPLETION_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
