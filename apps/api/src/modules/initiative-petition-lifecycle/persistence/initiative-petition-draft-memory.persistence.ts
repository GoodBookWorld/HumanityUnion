import {
  createEmptyInitiativePetitionDraftPersistenceSnapshot,
  type InitiativePetitionDraftPersistenceAdapter,
  type InitiativePetitionDraftPersistenceSnapshot,
} from "./initiative-petition-draft-persistence.types.js";

export class MemoryInitiativePetitionDraftPersistenceAdapter
  implements InitiativePetitionDraftPersistenceAdapter
{
  readonly mode = "memory" as const;
  private snapshot: InitiativePetitionDraftPersistenceSnapshot =
    createEmptyInitiativePetitionDraftPersistenceSnapshot();

  load(): InitiativePetitionDraftPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativePetitionDraftPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativePetitionDraftPersistenceAdapter(): MemoryInitiativePetitionDraftPersistenceAdapter {
  return new MemoryInitiativePetitionDraftPersistenceAdapter();
}
