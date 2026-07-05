import {
  createEmptyInitiativeCollaborativeAnalysisPersistenceSnapshot,
  type InitiativeCollaborativeAnalysisPersistenceAdapter,
  type InitiativeCollaborativeAnalysisPersistenceSnapshot,
} from "./initiative-collaborative-analysis-persistence.types.js";

export class MemoryInitiativeCollaborativeAnalysisPersistenceAdapter implements InitiativeCollaborativeAnalysisPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: InitiativeCollaborativeAnalysisPersistenceSnapshot =
    createEmptyInitiativeCollaborativeAnalysisPersistenceSnapshot();

  load(): InitiativeCollaborativeAnalysisPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeCollaborativeAnalysisPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeCollaborativeAnalysisPersistenceAdapter(): MemoryInitiativeCollaborativeAnalysisPersistenceAdapter {
  return new MemoryInitiativeCollaborativeAnalysisPersistenceAdapter();
}
