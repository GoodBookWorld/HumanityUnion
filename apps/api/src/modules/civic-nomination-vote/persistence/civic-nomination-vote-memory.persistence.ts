import {
  createEmptyCivicNominationVotePersistenceSnapshot,
  type CivicNominationVotePersistenceAdapter,
  type CivicNominationVotePersistenceSnapshot,
} from "./civic-nomination-vote-persistence.types.js";

export class MemoryCivicNominationVotePersistenceAdapter implements CivicNominationVotePersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: CivicNominationVotePersistenceSnapshot =
    createEmptyCivicNominationVotePersistenceSnapshot();

  load(): CivicNominationVotePersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: CivicNominationVotePersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryCivicNominationVotePersistenceAdapter(): MemoryCivicNominationVotePersistenceAdapter {
  return new MemoryCivicNominationVotePersistenceAdapter();
}

export function resetMemoryCivicNominationVotePersistenceForTests(): void {
  createMemoryCivicNominationVotePersistenceAdapter();
}
