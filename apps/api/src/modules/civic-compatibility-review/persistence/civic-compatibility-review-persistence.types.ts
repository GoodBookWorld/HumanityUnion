import type { CivicCompatibilityReview } from "@hu/types";

export interface CivicCompatibilityReviewPersistenceSnapshot {
  version: 1;
  reviews: Record<string, CivicCompatibilityReview>;
}

export interface CivicCompatibilityReviewPersistenceAdapter {
  readonly mode: "file" | "memory" | "mongodb";
  load(): CivicCompatibilityReviewPersistenceSnapshot;
  save(snapshot: CivicCompatibilityReviewPersistenceSnapshot): void;
}

export function createEmptyCivicCompatibilityReviewPersistenceSnapshot(): CivicCompatibilityReviewPersistenceSnapshot {
  return {
    version: 1,
    reviews: {},
  };
}

export function snapshotFromReviews(
  reviews: Map<string, CivicCompatibilityReview>,
): CivicCompatibilityReviewPersistenceSnapshot {
  const record: Record<string, CivicCompatibilityReview> = {};

  for (const [reviewId, review] of reviews) {
    record[reviewId] = structuredClone(review);
  }

  return {
    version: 1,
    reviews: record,
  };
}
