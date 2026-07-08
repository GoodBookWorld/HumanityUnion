import type { InitiativeDecisionVote, InitiativeDecisionVoteHistoryEntry } from "@hu/types";

import { resolveInitiativeDecisionVotePersistenceAdapter } from "./persistence/resolve-initiative-decision-vote-persistence.js";
import { snapshotFromInitiativeDecisionVoteStores } from "./persistence/initiative-decision-vote-persistence.types.js";

function participantDecisionKey(decisionId: string, participantId: string): string {
  return `${decisionId}::${participantId}`;
}

const persistence = resolveInitiativeDecisionVotePersistenceAdapter();

function loadStores(): {
  votes: Map<string, InitiativeDecisionVote>;
  history: Map<string, InitiativeDecisionVoteHistoryEntry>;
  participantDecisionIndex: Map<string, string>;
} {
  const snapshot = persistence.load();
  const votes = new Map<string, InitiativeDecisionVote>(
    Object.entries(snapshot.votes).map(([voteId, vote]) => [voteId, structuredClone(vote)]),
  );
  const history = new Map<string, InitiativeDecisionVoteHistoryEntry>(
    Object.entries(snapshot.history).map(([historyId, entry]) => [
      historyId,
      structuredClone(entry),
    ]),
  );
  const participantDecisionIndex = new Map<string, string>();

  for (const vote of votes.values()) {
    participantDecisionIndex.set(
      participantDecisionKey(vote.decisionId, vote.participantId),
      vote.voteId,
    );
  }

  return { votes, history, participantDecisionIndex };
}

const stores = loadStores();
const votes = stores.votes;
const history = stores.history;
const participantDecisionIndex = stores.participantDecisionIndex;

function persistStores(): void {
  persistence.save(snapshotFromInitiativeDecisionVoteStores(votes, history));
}

export function getVoteById(voteId: string): InitiativeDecisionVote | null {
  const vote = votes.get(voteId);

  return vote ? structuredClone(vote) : null;
}

export function getActiveVoteForParticipant(
  decisionId: string,
  participantId: string,
): InitiativeDecisionVote | null {
  const voteId = participantDecisionIndex.get(participantDecisionKey(decisionId, participantId));
  const vote = voteId ? votes.get(voteId) : undefined;

  return vote ? structuredClone(vote) : null;
}

export function listVotesForDecision(decisionId: string): InitiativeDecisionVote[] {
  return Array.from(votes.values(), (vote) => structuredClone(vote)).filter(
    (vote) => vote.decisionId === decisionId,
  );
}

export function listVoteHistoryForDecision(
  decisionId: string,
): InitiativeDecisionVoteHistoryEntry[] {
  return Array.from(history.values(), (entry) => structuredClone(entry))
    .filter((entry) => entry.decisionId === decisionId)
    .sort((left, right) => left.changedAt.localeCompare(right.changedAt));
}

export function listVoteHistoryForParticipant(
  decisionId: string,
  participantId: string,
): InitiativeDecisionVoteHistoryEntry[] {
  return listVoteHistoryForDecision(decisionId).filter(
    (entry) => entry.participantId === participantId,
  );
}

export function saveVoteRecord(vote: InitiativeDecisionVote): InitiativeDecisionVote {
  votes.set(vote.voteId, structuredClone(vote));
  participantDecisionIndex.set(
    participantDecisionKey(vote.decisionId, vote.participantId),
    vote.voteId,
  );
  persistStores();

  return structuredClone(vote);
}

export function appendVoteHistoryEntry(
  entry: InitiativeDecisionVoteHistoryEntry,
): InitiativeDecisionVoteHistoryEntry {
  history.set(entry.historyId, structuredClone(entry));
  persistStores();

  return structuredClone(entry);
}

export function countActiveVotesForDecision(decisionId: string): number {
  return listVotesForDecision(decisionId).length;
}

export function getPersistenceMode(): "file" | "memory" | "mongodb" {
  return persistence.mode;
}
