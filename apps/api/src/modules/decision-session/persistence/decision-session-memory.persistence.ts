import {
  createEmptyDecisionSessionPersistenceSnapshot,
  type DecisionSessionPersistenceAdapter,
  type DecisionSessionPersistenceSnapshot,
} from "./decision-session-persistence.types.js";

export class MemoryDecisionSessionPersistenceAdapter implements DecisionSessionPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: DecisionSessionPersistenceSnapshot =
    createEmptyDecisionSessionPersistenceSnapshot();

  load(): DecisionSessionPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: DecisionSessionPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryDecisionSessionPersistenceAdapter(): MemoryDecisionSessionPersistenceAdapter {
  return new MemoryDecisionSessionPersistenceAdapter();
}
