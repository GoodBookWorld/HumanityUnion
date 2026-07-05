import {
  createEmptyInitiativeVersionRevisionPersistenceSnapshot,
  type InitiativeVersionRevisionPersistenceAdapter,
  type InitiativeVersionRevisionPersistenceSnapshot,
} from "./initiative-version-revision-persistence.types.js";

export class MemoryInitiativeVersionRevisionPersistenceAdapter implements InitiativeVersionRevisionPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: InitiativeVersionRevisionPersistenceSnapshot =
    createEmptyInitiativeVersionRevisionPersistenceSnapshot();

  load(): InitiativeVersionRevisionPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeVersionRevisionPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeVersionRevisionPersistenceAdapter(): MemoryInitiativeVersionRevisionPersistenceAdapter {
  return new MemoryInitiativeVersionRevisionPersistenceAdapter();
}
