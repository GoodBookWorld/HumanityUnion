import type { DecisionSession } from "@hu/types";

export interface DecisionSessionPersistenceSnapshot {
  version: 1;
  sessions: Record<string, DecisionSession>;
}

export interface DecisionSessionPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): DecisionSessionPersistenceSnapshot;
  save(snapshot: DecisionSessionPersistenceSnapshot): void;
}

export function createEmptyDecisionSessionPersistenceSnapshot(): DecisionSessionPersistenceSnapshot {
  return {
    version: 1,
    sessions: {},
  };
}

export function snapshotFromSessions(
  sessions: Map<string, DecisionSession>,
): DecisionSessionPersistenceSnapshot {
  const record: Record<string, DecisionSession> = {};

  for (const [sessionId, session] of sessions) {
    record[sessionId] = structuredClone(session);
  }

  return {
    version: 1,
    sessions: record,
  };
}
