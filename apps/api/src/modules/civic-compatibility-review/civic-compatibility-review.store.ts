import type { CivicCompatibilityReview } from "@hu/types";

import { resolveCivicCompatibilityReviewPersistenceAdapter } from "./persistence/resolve-civic-compatibility-review-persistence.js";
import { snapshotFromReviews } from "./persistence/civic-compatibility-review-persistence.types.js";

const persistence = resolveCivicCompatibilityReviewPersistenceAdapter();

function loadReviewsMap(): Map<string, CivicCompatibilityReview> {
  const snapshot = persistence.load();

  return new Map<string, CivicCompatibilityReview>(
    Object.entries(snapshot.reviews).map(([reviewId, review]) => [
      reviewId,
      structuredClone(review),
    ]),
  );
}

function persistReviewsMap(reviews: Map<string, CivicCompatibilityReview>): void {
  persistence.save(snapshotFromReviews(reviews));
}

const reviews = loadReviewsMap();

export function getReviewById(reviewId: string): CivicCompatibilityReview | null {
  const review = reviews.get(reviewId);

  return review ? structuredClone(review) : null;
}

export function listReviews(): CivicCompatibilityReview[] {
  return Array.from(reviews.values(), (review) => structuredClone(review));
}

export function listReviewsByInitiative(initiativeId: string): CivicCompatibilityReview[] {
  return listReviews()
    .filter((review) => review.initiativeId === initiativeId)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
}

export function getLatestReviewForInitiativeVersion(
  initiativeId: string,
  initiativeVersion: number,
): CivicCompatibilityReview | null {
  const matching = listReviewsByInitiative(initiativeId).filter(
    (review) => review.initiativeVersion === initiativeVersion,
  );

  return matching[0] ?? null;
}

export function getNextReviewVersion(initiativeId: string, initiativeVersion: number): number {
  const matching = listReviewsByInitiative(initiativeId).filter(
    (review) => review.initiativeVersion === initiativeVersion,
  );

  if (matching.length === 0) {
    return 1;
  }

  return Math.max(...matching.map((review) => review.reviewVersion)) + 1;
}

export function createReview(review: CivicCompatibilityReview): CivicCompatibilityReview {
  reviews.set(review.reviewId, structuredClone(review));
  persistReviewsMap(reviews);

  return structuredClone(review);
}
