import type { CivicCompatibilityReviewPersistenceAdapter } from "./civic-compatibility-review-persistence.types.js";
import { createFileCivicCompatibilityReviewPersistenceAdapter } from "./civic-compatibility-review-file.persistence.js";
import { createMemoryCivicCompatibilityReviewPersistenceAdapter } from "./civic-compatibility-review-memory.persistence.js";

export function resolveCivicCompatibilityReviewPersistenceAdapter(): CivicCompatibilityReviewPersistenceAdapter {
  const mode = process.env.CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return createMemoryCivicCompatibilityReviewPersistenceAdapter();
    case "file":
    default:
      return createFileCivicCompatibilityReviewPersistenceAdapter();
  }
}
