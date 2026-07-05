import {
  createEmptyInitiativePersistenceSnapshot,
  type InitiativePersistenceAdapter,
  type InitiativePersistenceSnapshot,
} from "./initiative-persistence.types.js";

/** Non-persistent adapter for tests or explicit opt-out via INITIATIVE_PERSISTENCE=memory. */
export class MemoryInitiativePersistenceAdapter implements InitiativePersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: InitiativePersistenceSnapshot = createEmptyInitiativePersistenceSnapshot();

  load(): InitiativePersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativePersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativePersistenceAdapter(): MemoryInitiativePersistenceAdapter {
  return new MemoryInitiativePersistenceAdapter();
}
