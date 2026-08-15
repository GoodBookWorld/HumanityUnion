import {
  createEmptyInitiativePublicImpactLifecycleDraftPersistenceSnapshot,
  type InitiativePublicImpactLifecycleDraftPersistenceAdapter,
  type InitiativePublicImpactLifecycleDraftPersistenceSnapshot,
} from "./initiative-public-impact-lifecycle-draft-persistence.types.js";

export class MemoryInitiativePublicImpactLifecycleDraftPersistenceAdapter
  implements InitiativePublicImpactLifecycleDraftPersistenceAdapter
{
  readonly mode = "memory" as const;
  private snapshot: InitiativePublicImpactLifecycleDraftPersistenceSnapshot =
    createEmptyInitiativePublicImpactLifecycleDraftPersistenceSnapshot();

  load(): InitiativePublicImpactLifecycleDraftPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativePublicImpactLifecycleDraftPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativePublicImpactLifecycleDraftPersistenceAdapter(): MemoryInitiativePublicImpactLifecycleDraftPersistenceAdapter {
  return new MemoryInitiativePublicImpactLifecycleDraftPersistenceAdapter();
}
