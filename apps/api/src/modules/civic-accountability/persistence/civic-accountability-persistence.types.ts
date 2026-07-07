import type { CivicAccountability, CivicAccountabilityEvent } from "@hu/types";

export interface CivicAccountabilityPersistenceSnapshot {
  version: 1;
  accountabilities: Record<string, CivicAccountability>;
  events: Record<string, CivicAccountabilityEvent>;
}

export interface CivicAccountabilityPersistenceAdapter {
  readonly mode: "file" | "memory";
  load(): CivicAccountabilityPersistenceSnapshot;
  save(snapshot: CivicAccountabilityPersistenceSnapshot): void;
}

export function createEmptyCivicAccountabilityPersistenceSnapshot(): CivicAccountabilityPersistenceSnapshot {
  return {
    version: 1,
    accountabilities: {},
    events: {},
  };
}

export function snapshotFromCivicAccountabilityData(input: {
  accountabilities: Map<string, CivicAccountability>;
  events: Map<string, CivicAccountabilityEvent>;
}): CivicAccountabilityPersistenceSnapshot {
  const serializedAccountabilities: Record<string, CivicAccountability> = {};
  const serializedEvents: Record<string, CivicAccountabilityEvent> = {};

  for (const [accountabilityId, accountability] of input.accountabilities) {
    serializedAccountabilities[accountabilityId] = structuredClone(accountability);
  }

  for (const [eventId, event] of input.events) {
    serializedEvents[eventId] = structuredClone(event);
  }

  return {
    version: 1,
    accountabilities: serializedAccountabilities,
    events: serializedEvents,
  };
}
