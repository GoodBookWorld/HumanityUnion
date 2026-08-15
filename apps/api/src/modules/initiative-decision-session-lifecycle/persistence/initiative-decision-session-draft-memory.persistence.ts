import {
  createEmptyInitiativeDecisionSessionDraftPersistenceSnapshot,
  type InitiativeDecisionSessionDraftPersistenceAdapter,
  type InitiativeDecisionSessionDraftPersistenceSnapshot,
} from "./initiative-decision-session-draft-persistence.types.js";

export class MemoryInitiativeDecisionSessionDraftPersistenceAdapter
  implements InitiativeDecisionSessionDraftPersistenceAdapter
{
  readonly mode = "memory" as const;
  private snapshot: InitiativeDecisionSessionDraftPersistenceSnapshot =
    createEmptyInitiativeDecisionSessionDraftPersistenceSnapshot();

  load(): InitiativeDecisionSessionDraftPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeDecisionSessionDraftPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeDecisionSessionDraftPersistenceAdapter(): MemoryInitiativeDecisionSessionDraftPersistenceAdapter {
  return new MemoryInitiativeDecisionSessionDraftPersistenceAdapter();
}
