import type {
  CivicNominationVote,
  CivicNominationVoteHistoryEntry,
  CivicNominationVotingSession,
} from "@hu/types";

export interface CivicNominationVotePersistenceSnapshot {
  version: 1;
  votes: Record<string, CivicNominationVote>;
  history: Record<string, CivicNominationVoteHistoryEntry>;
  sessions: Record<string, CivicNominationVotingSession>;
}

export interface CivicNominationVotePersistenceAdapter {
  readonly mode: "memory" | "mongodb";
  load(): CivicNominationVotePersistenceSnapshot;
  save(snapshot: CivicNominationVotePersistenceSnapshot): void;
}

export function createEmptyCivicNominationVotePersistenceSnapshot(): CivicNominationVotePersistenceSnapshot {
  return {
    version: 1,
    votes: {},
    history: {},
    sessions: {},
  };
}

export function snapshotFromCivicNominationVoteStores(
  votes: Map<string, CivicNominationVote>,
  history: Map<string, CivicNominationVoteHistoryEntry>,
  sessions: Map<string, CivicNominationVotingSession>,
): CivicNominationVotePersistenceSnapshot {
  const voteRecord: Record<string, CivicNominationVote> = {};
  const historyRecord: Record<string, CivicNominationVoteHistoryEntry> = {};
  const sessionRecord: Record<string, CivicNominationVotingSession> = {};

  for (const [voteId, vote] of votes) {
    voteRecord[voteId] = structuredClone(vote);
  }

  for (const [historyId, entry] of history) {
    historyRecord[historyId] = structuredClone(entry);
  }

  for (const [sessionId, session] of sessions) {
    sessionRecord[sessionId] = structuredClone(session);
  }

  return {
    version: 1,
    votes: voteRecord,
    history: historyRecord,
    sessions: sessionRecord,
  };
}
