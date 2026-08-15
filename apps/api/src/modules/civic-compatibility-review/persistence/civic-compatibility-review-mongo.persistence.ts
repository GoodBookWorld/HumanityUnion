import type { CivicCompatibilityReview } from "@hu/types";
import { isMongoPersistenceMode } from "../../../config/production-persistence-contract.js";

import { createMongoSnapshotPersistence } from "../../../infrastructure/mongodb/create-mongo-snapshot-persistence.js";
import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";

import {
  createEmptyCivicCompatibilityReviewPersistenceSnapshot,
  type CivicCompatibilityReviewPersistenceAdapter,
} from "./civic-compatibility-review-persistence.types.js";

const handles = createMongoSnapshotPersistence({
  createEmpty: createEmptyCivicCompatibilityReviewPersistenceSnapshot,
  bindings: [
    {
      collectionName: MONGO_COLLECTIONS.civicCompatibilityReviews,
      idField: "reviewId",
      select: (snapshot) => snapshot.reviews as Record<string, object>,
      assign: (snapshot, records) => ({
        ...snapshot,
        reviews: records as unknown as Record<string, CivicCompatibilityReview>,
      }),
    },
  ],
});

export function createMongoCivicCompatibilityReviewPersistenceAdapter(): CivicCompatibilityReviewPersistenceAdapter {
  return handles.adapter;
}

export async function hydrateCivicCompatibilityReviewMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE")) {
    return;
  }

  await handles.hydrate();
}

export async function flushCivicCompatibilityReviewMongoPersistence(): Promise<void> {
  if (!isMongoPersistenceMode("CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE")) {
    return;
  }

  await handles.flush();
}
