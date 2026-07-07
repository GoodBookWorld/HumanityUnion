import {
  createEmptyCivicActionPackagePersistenceSnapshot,
  type CivicActionPackagePersistenceAdapter,
} from "./civic-action-package-persistence.types.js";

export class MemoryCivicActionPackagePersistenceAdapter implements CivicActionPackagePersistenceAdapter {
  readonly mode = "memory" as const;

  private snapshot = createEmptyCivicActionPackagePersistenceSnapshot();

  load() {
    return structuredClone(this.snapshot);
  }

  save(snapshot: ReturnType<MemoryCivicActionPackagePersistenceAdapter["load"]>): void {
    this.snapshot = structuredClone(snapshot);
  }
}
