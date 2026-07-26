import type { CivicNomination } from "@hu/types";

export interface CivicNominationPersistenceSnapshot {
  version: 1;
  nominations: Record<string, CivicNomination>;
}

export interface CivicNominationPersistenceAdapter {
  readonly mode: "memory" | "mongodb";
  load(): CivicNominationPersistenceSnapshot;
  save(snapshot: CivicNominationPersistenceSnapshot): void;
}

export function createEmptyCivicNominationPersistenceSnapshot(): CivicNominationPersistenceSnapshot {
  return {
    version: 1,
    nominations: {},
  };
}

export function snapshotFromCivicNominations(
  nominations: Map<string, CivicNomination>,
): CivicNominationPersistenceSnapshot {
  return {
    version: 1,
    nominations: Object.fromEntries(nominations.entries()),
  };
}
