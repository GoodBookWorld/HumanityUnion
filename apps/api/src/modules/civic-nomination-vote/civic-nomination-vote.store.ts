import type {
  CivicNomination,
  CivicNominationVote,
  CivicNominationVoteHistoryEntry,
  CivicNominationVotingSession,
} from "@hu/types";

import { resolveCivicNominationVotePersistenceAdapter } from "./persistence/resolve-civic-nomination-vote-persistence.js";
import { snapshotFromCivicNominationVoteStores } from "./persistence/civic-nomination-vote-persistence.types.js";

function participantNominationKey(nominationId: string, participantId: string): string {
  return `${nominationId}::${participantId}`;
}

const persistence = resolveCivicNominationVotePersistenceAdapter();

function loadStores(): {
  votes: Map<string, CivicNominationVote>;
  history: Map<string, CivicNominationVoteHistoryEntry>;
  sessions: Map<string, CivicNominationVotingSession>;
  nominationSessionIndex: Map<string, string>;
  participantNominationIndex: Map<string, string>;
} {
  const snapshot = persistence.load();
  const votes = new Map<string, CivicNominationVote>(
    Object.entries(snapshot.votes).map(([voteId, vote]) => [voteId, structuredClone(vote)]),
  );
  const history = new Map<string, CivicNominationVoteHistoryEntry>(
    Object.entries(snapshot.history).map(([historyId, entry]) => [
      historyId,
      structuredClone(entry),
    ]),
  );
  const sessions = new Map<string, CivicNominationVotingSession>(
    Object.entries(snapshot.sessions).map(([sessionId, session]) => [
      sessionId,
      structuredClone(session),
    ]),
  );
  const nominationSessionIndex = new Map<string, string>();
  const participantNominationIndex = new Map<string, string>();

  for (const session of sessions.values()) {
    nominationSessionIndex.set(session.nominationId, session.votingSessionId);
  }

  for (const vote of votes.values()) {
    participantNominationIndex.set(
      participantNominationKey(vote.nominationId, vote.participantId),
      vote.voteId,
    );
  }

  return { votes, history, sessions, nominationSessionIndex, participantNominationIndex };
}

const stores = loadStores();
const votes = stores.votes;
const history = stores.history;
const sessions = stores.sessions;
const nominationSessionIndex = stores.nominationSessionIndex;
const participantNominationIndex = stores.participantNominationIndex;

function persistStores(): void {
  persistence.save(snapshotFromCivicNominationVoteStores(votes, history, sessions));
}

export function resetCivicNominationVoteStoreForTests(): void {
  votes.clear();
  history.clear();
  sessions.clear();
  nominationSessionIndex.clear();
  participantNominationIndex.clear();
  persistStores();
}

export function getVotingSessionById(votingSessionId: string): CivicNominationVotingSession | null {
  const session = sessions.get(votingSessionId);
  return session ? structuredClone(session) : null;
}

export function getVotingSessionForNomination(
  nominationId: string,
): CivicNominationVotingSession | null {
  const sessionId = nominationSessionIndex.get(nominationId);
  const session = sessionId ? sessions.get(sessionId) : undefined;
  return session ? structuredClone(session) : null;
}

export function saveVotingSession(
  session: CivicNominationVotingSession,
): CivicNominationVotingSession {
  sessions.set(session.votingSessionId, structuredClone(session));
  nominationSessionIndex.set(session.nominationId, session.votingSessionId);
  persistStores();
  return structuredClone(session);
}

export function getActiveVoteForParticipant(
  nominationId: string,
  participantId: string,
): CivicNominationVote | null {
  const voteId = participantNominationIndex.get(
    participantNominationKey(nominationId, participantId),
  );
  const vote = voteId ? votes.get(voteId) : undefined;
  return vote ? structuredClone(vote) : null;
}

export function listVotesForNomination(nominationId: string): CivicNominationVote[] {
  return Array.from(votes.values(), (vote) => structuredClone(vote)).filter(
    (vote) => vote.nominationId === nominationId,
  );
}

export function listAllNominationVotes(): CivicNominationVote[] {
  return Array.from(votes.values(), (vote) => structuredClone(vote));
}

export function listAllNominationVoteHistory(): CivicNominationVoteHistoryEntry[] {
  return Array.from(history.values(), (entry) => structuredClone(entry));
}

export function listVoteHistoryForNomination(
  nominationId: string,
): CivicNominationVoteHistoryEntry[] {
  return Array.from(history.values(), (entry) => structuredClone(entry))
    .filter((entry) => entry.nominationId === nominationId)
    .sort((left, right) => left.changedAt.localeCompare(right.changedAt));
}

export function saveVoteRecord(vote: CivicNominationVote): CivicNominationVote {
  votes.set(vote.voteId, structuredClone(vote));
  participantNominationIndex.set(
    participantNominationKey(vote.nominationId, vote.participantId),
    vote.voteId,
  );
  persistStores();
  return structuredClone(vote);
}

export function appendVoteHistoryEntry(
  entry: CivicNominationVoteHistoryEntry,
): CivicNominationVoteHistoryEntry {
  history.set(entry.historyId, structuredClone(entry));
  persistStores();
  return structuredClone(entry);
}

export function getPersistenceMode(): "memory" | "mongodb" {
  return persistence.mode;
}

export type { CivicNomination };
