import {
  createEmptyInitiativeImprovementProposalPersistenceSnapshot,
  type InitiativeImprovementProposalPersistenceAdapter,
  type InitiativeImprovementProposalPersistenceSnapshot,
} from "./initiative-improvement-proposal-persistence.types.js";

export class MemoryInitiativeImprovementProposalPersistenceAdapter implements InitiativeImprovementProposalPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot: InitiativeImprovementProposalPersistenceSnapshot =
    createEmptyInitiativeImprovementProposalPersistenceSnapshot();

  load(): InitiativeImprovementProposalPersistenceSnapshot {
    return structuredClone(this.snapshot);
  }

  save(snapshot: InitiativeImprovementProposalPersistenceSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryInitiativeImprovementProposalPersistenceAdapter(): MemoryInitiativeImprovementProposalPersistenceAdapter {
  return new MemoryInitiativeImprovementProposalPersistenceAdapter();
}
