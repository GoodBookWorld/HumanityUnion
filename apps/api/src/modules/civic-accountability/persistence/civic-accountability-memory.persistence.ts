import type { CivicAccountabilityPersistenceAdapter } from "./civic-accountability-persistence.types.js";
import { createEmptyCivicAccountabilityPersistenceSnapshot } from "./civic-accountability-persistence.types.js";

export class MemoryCivicAccountabilityPersistenceAdapter implements CivicAccountabilityPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot = createEmptyCivicAccountabilityPersistenceSnapshot();

  load() {
    return structuredClone(this.snapshot);
  }

  save(snapshot: ReturnType<MemoryCivicAccountabilityPersistenceAdapter["load"]>): void {
    this.snapshot = structuredClone(snapshot);
  }
}
