import type {
  CivicNominationVote,
  CivicNominationVoteHistoryEntry,
  CivicNominationVotingSession,
} from "@hu/types";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyCivicNominationVotePersistenceSnapshot,
  type CivicNominationVotePersistenceAdapter,
} from "./civic-nomination-vote-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyCivicNominationVotePersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.civicNominationVotes,
      idField: "voteId",
      select: (snapshot) => snapshot.votes as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        votes: records as unknown as Record<string, CivicNominationVote>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.civicNominationVoteHistory,
      idField: "historyId",
      select: (snapshot) => snapshot.history as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        history: records as unknown as Record<string, CivicNominationVoteHistoryEntry>,
      }),
    },
    {
      collectionName: MONGO_COLLECTIONS.civicNominationVotingSessions,
      idField: "votingSessionId",
      select: (snapshot) => snapshot.sessions as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        sessions: records as unknown as Record<string, CivicNominationVotingSession>,
      }),
    },
  ],
});

export function createMongoCivicNominationVotePersistenceAdapter(): CivicNominationVotePersistenceAdapter {
  return handles.adapter;
}

export async function hydrateCivicNominationVoteMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_NOMINATION_VOTE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.hydrate();
}

export async function flushCivicNominationVoteMongoPersistence(): Promise<void> {
  if (process.env.CIVIC_NOMINATION_VOTE_PERSISTENCE !== "mongodb") {
    return;
  }

  await handles.flush();
}
