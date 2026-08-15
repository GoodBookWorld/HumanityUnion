import {
  createEmptyInitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot,
  type InitiativeImplementationTrackingLifecycleDraftPersistenceAdapter,
  type InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot,
} from "./initiative-implementation-tracking-lifecycle-draft-persistence.types.js";

export class MemoryInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter
  implements InitiativeImplementationTrackingLifecycleDraftPersistenceAdapter
{
  readonly mode = "memory" as const;
  private snapshot: InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot =
    createEmptyInitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot();

  load(): InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter(): MemoryInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter {
  return new MemoryInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter();
}
