import type { InitiativeDecisionVote, InitiativeDecisionVoteHistoryEntry } from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyInitiativeDecisionVotePersistenceSnapshot,
  type InitiativeDecisionVotePersistenceAdapter,
} from "./initiative-decision-vote-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyInitiativeDecisionVotePersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.initiativeDecisionVotes,
      idField: "voteId",
      select: (snapshot) => snapshot.votes as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        votes: records as unknown as Record<string, InitiativeDecisionVote>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.initiativeDecisionVoteHistory,
      idField: "historyId",
      select: (snapshot) => snapshot.history as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        history: records as unknown as Record<string, InitiativeDecisionVoteHistoryEntry>,
      }),
    },
  ],
});

export function createMongoInitiativeDecisionVotePersistenceAdapter(): InitiativeDecisionVotePersistenceAdapter {
  return handles.adapter;
}

export async function hydrateInitiativeDecisionVoteMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_DECISION_VOTE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushInitiativeDecisionVoteMongoPersistence(): Promise<void> {
  if (process.env.INITIATIVE_DECISION_VOTE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
