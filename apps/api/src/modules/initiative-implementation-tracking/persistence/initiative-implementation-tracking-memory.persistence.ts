import {
  createEmptyInitiativeImplementationTrackingPersistenceSnapshot,
  type InitiativeImplementationTrackingPersistenceAdapter,
  type InitiativeImplementationTrackingPersistenceSnapshot,
} from "./initiative-implementation-tracking-persistence.types.js";

export class MemoryInitiativeImplementationTrackingPersistenceAdapter implements InitiativeImplementationTrackingPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: InitiativeImplementationTrackingPersistenceSnapshot =
    createEmptyInitiativeImplementationTrackingPersistenceSnapshot();

  load(): InitiativeImplementationTrackingPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeImplementationTrackingPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeImplementationTrackingPersistenceAdapter(): MemoryInitiativeImplementationTrackingPersistenceAdapter {
  return new MemoryInitiativeImplementationTrackingPersistenceAdapter();
}
