import {
  createEmptyInitiativePublicImpactPersistenceSnapshot,
  type InitiativePublicImpactPersistenceAdapter,
  type InitiativePublicImpactPersistenceSnapshot,
} from "./initiative-public-impact-persistence.types.js";

export class MemoryInitiativePublicImpactPersistenceAdapter implements InitiativePublicImpactPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: InitiativePublicImpactPersistenceSnapshot =
    createEmptyInitiativePublicImpactPersistenceSnapshot();

  load(): InitiativePublicImpactPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativePublicImpactPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativePublicImpactPersistenceAdapter(): MemoryInitiativePublicImpactPersistenceAdapter {
  return new MemoryInitiativePublicImpactPersistenceAdapter();
}
