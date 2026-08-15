import {
  createEmptyInitiativeOfficialResponseLifecycleDraftPersistenceSnapshot,
  type InitiativeOfficialResponseLifecycleDraftPersistenceAdapter,
  type InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot,
} from "./initiative-official-response-lifecycle-draft-persistence.types.js";

export class MemoryInitiativeOfficialResponseLifecycleDraftPersistenceAdapter
  implements InitiativeOfficialResponseLifecycleDraftPersistenceAdapter
{
  readonly mode = "memory" as const;
  private snapshot: InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot =
    createEmptyInitiativeOfficialResponseLifecycleDraftPersistenceSnapshot();

  load(): InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeOfficialResponseLifecycleDraftPersistenceAdapter(): MemoryInitiativeOfficialResponseLifecycleDraftPersistenceAdapter {
  return new MemoryInitiativeOfficialResponseLifecycleDraftPersistenceAdapter();
}
