import type {
  CivicCompatibilityConcern,
  CivicCompatibilityRecommendation,
  CivicCompatibilityReview,
  CivicCompatibilityReviewComparison,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getCurrentPublishedVersion } from "../initiative-version-revision/initiative-version-revision.store.js";
import {
  createReview,
  getLatestReviewForInitiativeVersion,
  getReviewById,
  getNextReviewVersion,
  listReviewsByInitiative,
} from "./civic-compatibility-review.store.js";
import { resolveCivicCompatibilityReviewProvider } from "./review-engine/civic-compatibility-review-provider.js";

const REVIEWABLE_PHASES = new Set(["published", "projected", "archived"]);

function assertReviewableInitiative(initiativeId: string) {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  if (!REVIEWABLE_PHASES.has(initiative.lifecyclePhase)) {
    throw new Error("Civic compatibility reviews can only be requested for published initiatives.");
  }

  return initiative;
}

function compareItemsById<T extends { concernId?: string; recommendationId?: string }>(
  baseline: T[],
  comparison: T[],
  idKey: "concernId" | "recommendationId",
): { added: T[]; resolved: T[] } {
  const baselineIds = new Set(baseline.map((item) => item[idKey]));
  const comparisonIds = new Set(comparison.map((item) => item[idKey]));

  return {
    added: comparison.filter((item) => !baselineIds.has(item[idKey]!)),
    resolved: baseline.filter((item) => !comparisonIds.has(item[idKey]!)),
  };
}

export function listInitiativeCompatibilityReviews(
  identity: RequestIdentity,
  initiativeId: string,
): CivicCompatibilityReview[] {
  const initiative = assertReviewableInitiative(initiativeId);
  assertInitiativeOwnership(initiative, identity);

  return listReviewsByInitiative(initiativeId);
}

export function getInitiativeCompatibilityReview(
  identity: RequestIdentity,
  reviewId: string,
): CivicCompatibilityReview {
  const review = getReviewById(reviewId);

  if (!review) {
    throw new Error("Civic compatibility review not found.");
  }

  const initiative = getInitiativeById(review.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return review;
}

export function runInitiativeCompatibilityReview(
  identity: RequestIdentity,
  initiativeId: string,
): CivicCompatibilityReview {
  const initiative = assertReviewableInitiative(initiativeId);
  assertInitiativeOwnership(initiative, identity);

  const initiativeVersion = getCurrentPublishedVersion(initiativeId);
  const provider = resolveCivicCompatibilityReviewProvider();
  const result = provider.generateReview({ initiative, initiativeVersion });
  const generatedAt = new Date().toISOString();

  const review: CivicCompatibilityReview = {
    reviewId: `civic-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    initiativeId,
    initiativeVersion,
    reviewVersion: getNextReviewVersion(initiativeId, initiativeVersion),
    generatedAt,
    requestedByStewardId: identity.participantId,
    providerId: provider.providerId,
    compatibilityStatus: result.compatibilityStatus,
    compatibilitySummary: result.compatibilitySummary,
    humanRightsAssessment: result.humanRightsAssessment,
    humanityUnionAssessment: result.humanityUnionAssessment,
    detectedConcerns: result.detectedConcerns,
    recommendations: result.recommendations,
    reviewedDocuments: result.reviewedDocuments,
    referencedPrinciples: result.referencedPrinciples,
    referencedHumanRightsArticles: result.referencedHumanRightsArticles,
    positiveAlignment: result.positiveAlignment,
    confidenceLevel: result.confidenceLevel,
  };

  return createReview(review);
}

export function compareInitiativeCompatibilityReviews(
  identity: RequestIdentity,
  baselineReviewId: string,
  comparisonReviewId: string,
): CivicCompatibilityReviewComparison {
  const baseline = getInitiativeCompatibilityReview(identity, baselineReviewId);
  const comparison = getInitiativeCompatibilityReview(identity, comparisonReviewId);

  if (baseline.initiativeId !== comparison.initiativeId) {
    throw new Error("Reviews must belong to the same initiative to compare.");
  }

  const concernDiff = compareItemsById(
    baseline.detectedConcerns,
    comparison.detectedConcerns,
    "concernId",
  );
  const recommendationDiff = compareItemsById(
    baseline.recommendations,
    comparison.recommendations,
    "recommendationId",
  );

  return {
    baselineReviewId,
    comparisonReviewId,
    initiativeVersionChanged: baseline.initiativeVersion !== comparison.initiativeVersion,
    compatibilityStatusChanged: baseline.compatibilityStatus !== comparison.compatibilityStatus,
    addedConcerns: concernDiff.added as CivicCompatibilityConcern[],
    resolvedConcerns: concernDiff.resolved as CivicCompatibilityConcern[],
    addedRecommendations: recommendationDiff.added as CivicCompatibilityRecommendation[],
    resolvedRecommendations: recommendationDiff.resolved as CivicCompatibilityRecommendation[],
  };
}

export function getLatestInitiativeCompatibilityReviewForSteward(
  identity: RequestIdentity,
  initiativeId: string,
): CivicCompatibilityReview | null {
  const initiative = assertReviewableInitiative(initiativeId);
  assertInitiativeOwnership(initiative, identity);

  const initiativeVersion = getCurrentPublishedVersion(initiativeId);

  return getLatestReviewForInitiativeVersion(initiativeId, initiativeVersion);
}
