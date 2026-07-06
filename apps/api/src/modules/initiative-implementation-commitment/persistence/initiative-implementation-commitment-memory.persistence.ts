import {
  createEmptyInitiativeImplementationCommitmentPersistenceSnapshot,
  type InitiativeImplementationCommitmentPersistenceAdapter,
  type InitiativeImplementationCommitmentPersistenceSnapshot,
} from "./initiative-implementation-commitment-persistence.types.js";

export class MemoryInitiativeImplementationCommitmentPersistenceAdapter implements InitiativeImplementationCommitmentPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: InitiativeImplementationCommitmentPersistenceSnapshot =
    createEmptyInitiativeImplementationCommitmentPersistenceSnapshot();

  load(): InitiativeImplementationCommitmentPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeImplementationCommitmentPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeImplementationCommitmentPersistenceAdapter(): MemoryInitiativeImplementationCommitmentPersistenceAdapter {
  return new MemoryInitiativeImplementationCommitmentPersistenceAdapter();
}
