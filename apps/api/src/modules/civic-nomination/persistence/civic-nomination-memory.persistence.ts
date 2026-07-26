import {
  createEmptyCivicNominationPersistenceSnapshot,
  type CivicNominationPersistenceAdapter,
} from "./civic-nomination-persistence.types.js";

export class MemoryCivicNominationPersistenceAdapter implements CivicNominationPersistenceAdapter {
  readonly mode = "memory" as const;

  private snapshot = createEmptyCivicNominationPersistenceSnapshot();

  load() {
    return structuredClone(this.snapshot);
  }

  save(snapshot: ReturnType<MemoryCivicNominationPersistenceAdapter["load"]>): void {
    this.snapshot = structuredClone(snapshot);
  }
}
