import type { Initiative } from "@hu/types";

export interface InitiativePersistenceSnapshot {
  version: 1;
  initiatives: Record<string, Initiative>;
}

export interface InitiativePersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): InitiativePersistenceSnapshot;
  save(snapshot: InitiativePersistenceSnapshot): void;
}

export function createEmptyInitiativePersistenceSnapshot(): InitiativePersistenceSnapshot {
  return {
    version: 1,
    initiatives: {},
  };
}

export function snapshotFromInitiatives(
  initiatives: Map<string, Initiative>,
): InitiativePersistenceSnapshot {
  const record: Record<string, Initiative> = {};

  for (const [initiativeId, initiative] of initiatives) {
    record[initiativeId] = structuredClone(initiative);
  }

  return {
    version: 1,
    initiatives: record,
  };
}
