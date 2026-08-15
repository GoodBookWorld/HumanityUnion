import {
  createEmptyInitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot,
  type InitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter,
  type InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot,
} from "./initiative-collective-decision-lifecycle-draft-persistence.types.js";

export class MemoryInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter
  implements InitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter
{
  readonly mode = "memory" as const;
  private snapshot: InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot =
    createEmptyInitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot();

  load(): InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter(): MemoryInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter {
  return new MemoryInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter();
}
