import {
  createEmptyInitiativeCollectiveDecisionPersistenceSnapshot,
  type InitiativeCollectiveDecisionPersistenceAdapter,
  type InitiativeCollectiveDecisionPersistenceSnapshot,
} from "./initiative-collective-decision-persistence.types.js";

export class MemoryInitiativeCollectiveDecisionPersistenceAdapter implements InitiativeCollectiveDecisionPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: InitiativeCollectiveDecisionPersistenceSnapshot =
    createEmptyInitiativeCollectiveDecisionPersistenceSnapshot();

  load(): InitiativeCollectiveDecisionPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeCollectiveDecisionPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeCollectiveDecisionPersistenceAdapter(): MemoryInitiativeCollectiveDecisionPersistenceAdapter {
  return new MemoryInitiativeCollectiveDecisionPersistenceAdapter();
}
