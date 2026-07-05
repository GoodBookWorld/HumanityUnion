import type {
  CivicCompatibilityReview,
  CivicCompatibilityReviewMetrics,
  CivicCompatibilityStatus,
  PublicCivicCompatibilityReviewListItem,
  PublicCivicCompatibilityReviewSummary,
} from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { getReviewById, listReviewsByInitiative } from "./civic-compatibility-review.store.js";

const ADVISORY_NOTICE = "⚠ Civic Compatibility Review Available";

function buildReviewAvailableNotice(status: CivicCompatibilityStatus): string | null {
  if (status === "compatible") {
    return null;
  }

  return ADVISORY_NOTICE;
}

function toPublicListItem(
  review: CivicCompatibilityReview,
): PublicCivicCompatibilityReviewListItem {
  return {
    reviewId: review.reviewId,
    initiativeVersion: review.initiativeVersion,
    reviewVersion: review.reviewVersion,
    generatedAt: review.generatedAt,
    compatibilityStatus: review.compatibilityStatus,
    compatibilitySummary: review.compatibilitySummary,
  };
}

export function toPublicCivicCompatibilityReviewSummary(
  review: CivicCompatibilityReview,
): PublicCivicCompatibilityReviewSummary {
  return {
    reviewId: review.reviewId,
    initiativeId: review.initiativeId,
    initiativeVersion: review.initiativeVersion,
    reviewVersion: review.reviewVersion,
    generatedAt: review.generatedAt,
    compatibilityStatus: review.compatibilityStatus,
    compatibilitySummary: review.compatibilitySummary,
    humanRightsAssessment: review.humanRightsAssessment,
    humanityUnionAssessment: review.humanityUnionAssessment,
    detectedConcerns: review.detectedConcerns,
    recommendations: review.recommendations,
    reviewedDocuments: review.reviewedDocuments,
    referencedPrinciples: review.referencedPrinciples,
    referencedHumanRightsArticles: review.referencedHumanRightsArticles,
    positiveAlignment: review.positiveAlignment,
    confidenceLevel: review.confidenceLevel,
    reviewAvailableNotice: buildReviewAvailableNotice(review.compatibilityStatus),
  };
}

function compatibilityScore(status: CivicCompatibilityStatus): number {
  switch (status) {
    case "compatible":
      return 100;
    case "compatible_with_recommendations":
      return 85;
    case "potential_conflict":
      return 55;
    case "manual_review_recommended":
      return 35;
  }
}

export function computeCivicCompatibilityReviewMetrics(
  initiativeId: string,
): CivicCompatibilityReviewMetrics {
  const reviews = listReviewsByInitiative(initiativeId);

  if (reviews.length === 0) {
    return {
      reviewCount: 0,
      averageCompatibilityScore: 0,
      recommendationAcceptanceRate: null,
      potentialConflictRate: 0,
      manualReviewRecommendationRate: 0,
    };
  }

  const scores = reviews.map((review) => compatibilityScore(review.compatibilityStatus));
  const potentialConflictCount = reviews.filter(
    (review) => review.compatibilityStatus === "potential_conflict",
  ).length;
  const manualReviewCount = reviews.filter(
    (review) => review.compatibilityStatus === "manual_review_recommended",
  ).length;

  return {
    reviewCount: reviews.length,
    averageCompatibilityScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    recommendationAcceptanceRate: null,
    potentialConflictRate: potentialConflictCount / reviews.length,
    manualReviewRecommendationRate: manualReviewCount / reviews.length,
  };
}

export function listPublicCivicCompatibilityReviews(
  initiativeId: string,
): PublicCivicCompatibilityReviewListItem[] {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
    return [];
  }

  return listReviewsByInitiative(initiativeId).map((review) => toPublicListItem(review));
}

export function getLatestPublicCivicCompatibilityReview(
  initiativeId: string,
): PublicCivicCompatibilityReviewSummary | null {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
    return null;
  }

  const latest = listReviewsByInitiative(initiativeId)[0];

  return latest ? toPublicCivicCompatibilityReviewSummary(latest) : null;
}

export function getPublicCivicCompatibilityReviewById(
  reviewId: string,
): PublicCivicCompatibilityReviewSummary | null {
  const review = getReviewById(reviewId);

  if (!review) {
    return null;
  }

  const initiative = getInitiativeById(review.initiativeId);

  if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
    return null;
  }

  return toPublicCivicCompatibilityReviewSummary(review);
}
