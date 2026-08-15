import {
  createEmptyInitiativeCivicArchiveLifecycleDraftPersistenceSnapshot,
  type InitiativeCivicArchiveLifecycleDraftPersistenceAdapter,
  type InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot,
} from "./initiative-civic-archive-lifecycle-draft-persistence.types.js";

export class MemoryInitiativeCivicArchiveLifecycleDraftPersistenceAdapter
  implements InitiativeCivicArchiveLifecycleDraftPersistenceAdapter
{
  readonly mode = "memory" as const;
  private snapshot: InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot =
    createEmptyInitiativeCivicArchiveLifecycleDraftPersistenceSnapshot();

  load(): InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeCivicArchiveLifecycleDraftPersistenceAdapter(): MemoryInitiativeCivicArchiveLifecycleDraftPersistenceAdapter {
  return new MemoryInitiativeCivicArchiveLifecycleDraftPersistenceAdapter();
}
