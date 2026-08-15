import {
  createEmptyInitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot,
  type InitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter,
  type InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot,
} from "./initiative-implementation-commitment-lifecycle-draft-persistence.types.js";

export class MemoryInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter
  implements InitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter
{
  readonly mode = "memory" as const;
  private snapshot: InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot =
    createEmptyInitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot();

  load(): InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter(): MemoryInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter {
  return new MemoryInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter();
}
