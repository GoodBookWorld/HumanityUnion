import type { InitiativeDecisionVote, InitiativeDecisionVoteHistoryEntry } from "@hu/types";

export interface InitiativeDecisionVotePersistenceSnapshot {
  version: 1;
  votes: Record<string, InitiativeDecisionVote>;
  history: Record<string, InitiativeDecisionVoteHistoryEntry>;
}

export interface InitiativeDecisionVotePersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativeDecisionVotePersistenceSnapshot;
  save(snapshot: InitiativeDecisionVotePersistenceSnapshot): void;
}

export function createEmptyInitiativeDecisionVotePersistenceSnapshot(): InitiativeDecisionVotePersistenceSnapshot {
  return {
    version: 1,
    votes: {},
    history: {},
  };
}

export function snapshotFromInitiativeDecisionVoteStores(
  votes: Map<string, InitiativeDecisionVote>,
  history: Map<string, InitiativeDecisionVoteHistoryEntry>,
): InitiativeDecisionVotePersistenceSnapshot {
  const voteRecord: Record<string, InitiativeDecisionVote> = {};
  const historyRecord: Record<string, InitiativeDecisionVoteHistoryEntry> = {};

  for (const [voteId, vote] of votes) {
    voteRecord[voteId] = structuredClone(vote);
  }

  for (const [historyId, entry] of history) {
    historyRecord[historyId] = structuredClone(entry);
  }

  return {
    version: 1,
    votes: voteRecord,
    history: historyRecord,
  };
}
