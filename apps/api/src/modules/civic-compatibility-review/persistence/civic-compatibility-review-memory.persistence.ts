import type { CivicCompatibilityReviewPersistenceAdapter } from "./civic-compatibility-review-persistence.types.js";
import { createEmptyCivicCompatibilityReviewPersistenceSnapshot } from "./civic-compatibility-review-persistence.types.js";

export class MemoryCivicCompatibilityReviewPersistenceAdapter implements CivicCompatibilityReviewPersistenceAdapter {
  readonly mode = "memory" as const;
  private snapshot = createEmptyCivicCompatibilityReviewPersistenceSnapshot();

  load() {
    return structuredClone(this.snapshot);
  }

  save(snapshot: ReturnType<MemoryCivicCompatibilityReviewPersistenceAdapter["load"]>): void {
    this.snapshot = structuredClone(snapshot);
  }
}

export function createMemoryCivicCompatibilityReviewPersistenceAdapter(): MemoryCivicCompatibilityReviewPersistenceAdapter {
  return new MemoryCivicCompatibilityReviewPersistenceAdapter();
}
