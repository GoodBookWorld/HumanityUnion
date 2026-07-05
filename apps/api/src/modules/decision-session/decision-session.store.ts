import type { DecisionSession } from "@hu/types";

import { resolveDecisionSessionPersistenceAdapter } from "./persistence/resolve-decision-session-persistence.js";
import { snapshotFromSessions } from "./persistence/decision-session-persistence.types.js";

export interface DecisionSessionUpdate {
  title?: string;
  purpose?: string;
  decisionQuestion?: string;
  opensAt?: string;
  closesAt?: string;
  status?: DecisionSession["status"];
  initiativeVersion?: number;
  publishedAt?: string;
  closedAt?: string;
  packageReferences?: DecisionSession["packageReferences"];
}

const PUBLIC_STATUSES = new Set<DecisionSession["status"]>(["published", "closed"]);

const persistence = resolveDecisionSessionPersistenceAdapter();

function loadSessionsMap(): Map<string, DecisionSession> {
  const snapshot = persistence.load();

  return new Map<string, DecisionSession>(
    Object.entries(snapshot.sessions).map(([sessionId, session]) => [
      sessionId,
      structuredClone(session),
    ]),
  );
}

function persistSessionsMap(sessions: Map<string, DecisionSession>): void {
  persistence.save(snapshotFromSessions(sessions));
}

const sessions = loadSessionsMap();

export function getSessionById(sessionId: string): DecisionSession | null {
  const session = sessions.get(sessionId);

  return session ? structuredClone(session) : null;
}

export function listSessions(): DecisionSession[] {
  return Array.from(sessions.values(), (session) => structuredClone(session));
}

export function listSessionsByInitiative(initiativeId: string): DecisionSession[] {
  return listSessions().filter((session) => session.initiativeId === initiativeId);
}

export function listSessionsBySteward(stewardId: string): DecisionSession[] {
  return listSessions().filter((session) => session.stewardId === stewardId);
}

export function listPublicSessionsByInitiative(initiativeId: string): DecisionSession[] {
  return listSessionsByInitiative(initiativeId)
    .filter((session) => PUBLIC_STATUSES.has(session.status))
    .sort((left, right) =>
      (right.publishedAt ?? right.updatedAt).localeCompare(left.publishedAt ?? left.updatedAt),
    );
}

export function createSession(session: DecisionSession): DecisionSession {
  sessions.set(session.sessionId, structuredClone(session));
  persistSessionsMap(sessions);

  return structuredClone(session);
}

export function updateSession(
  sessionId: string,
  update: DecisionSessionUpdate,
): DecisionSession | null {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (update.title !== undefined) {
    session.title = update.title;
  }

  if (update.purpose !== undefined) {
    session.purpose = update.purpose;
  }

  if (update.decisionQuestion !== undefined) {
    session.decisionQuestion = update.decisionQuestion;
  }

  if (update.opensAt !== undefined) {
    session.opensAt = update.opensAt;
  }

  if (update.closesAt !== undefined) {
    session.closesAt = update.closesAt;
  }

  if (update.status !== undefined) {
    session.status = update.status;
  }

  if (update.initiativeVersion !== undefined) {
    session.initiativeVersion = update.initiativeVersion;
  }

  if (update.publishedAt !== undefined) {
    session.publishedAt = update.publishedAt;
  }

  if (update.closedAt !== undefined) {
    session.closedAt = update.closedAt;
  }

  if (update.packageReferences !== undefined) {
    session.packageReferences = structuredClone(update.packageReferences);
  }

  session.updatedAt = new Date().toISOString();

  persistSessionsMap(sessions);

  return structuredClone(session);
}
