import {
  createEmptyInitiativeDecisionVotePersistenceSnapshot,
  type InitiativeDecisionVotePersistenceAdapter,
  type InitiativeDecisionVotePersistenceSnapshot,
} from "./initiative-decision-vote-persistence.types.js";

export class MemoryInitiativeDecisionVotePersistenceAdapter implements InitiativeDecisionVotePersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: InitiativeDecisionVotePersistenceSnapshot =
    createEmptyInitiativeDecisionVotePersistenceSnapshot();

  load(): InitiativeDecisionVotePersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeDecisionVotePersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeDecisionVotePersistenceAdapter(): MemoryInitiativeDecisionVotePersistenceAdapter {
  return new MemoryInitiativeDecisionVotePersistenceAdapter();
}
