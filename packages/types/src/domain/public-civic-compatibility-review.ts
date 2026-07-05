import type {
  CivicCompatibilityConfidenceLevel,
  CivicCompatibilityConcern,
  CivicCompatibilityRecommendation,
  CivicCompatibilityReviewId,
  CivicCompatibilityStatus,
  CivicReferenceFrameworkEntry,
  ReviewedDocumentReference,
} from "./civic-compatibility-review.js";
import type { InitiativeId } from "./initiative.js";

export interface PublicCivicCompatibilityReviewSummary {
  reviewId: CivicCompatibilityReviewId;
  initiativeId: InitiativeId;
  initiativeVersion: number;
  reviewVersion: number;
  generatedAt: string;
  compatibilityStatus: CivicCompatibilityStatus;
  compatibilitySummary: string;
  humanRightsAssessment: string;
  humanityUnionAssessment: string;
  detectedConcerns: CivicCompatibilityConcern[];
  recommendations: CivicCompatibilityRecommendation[];
  reviewedDocuments: ReviewedDocumentReference[];
  referencedPrinciples: CivicReferenceFrameworkEntry[];
  referencedHumanRightsArticles: CivicReferenceFrameworkEntry[];
  positiveAlignment: string[];
  confidenceLevel: CivicCompatibilityConfidenceLevel;
  reviewAvailableNotice: string | null;
}

export interface PublicCivicCompatibilityReviewListItem {
  reviewId: CivicCompatibilityReviewId;
  initiativeVersion: number;
  reviewVersion: number;
  generatedAt: string;
  compatibilityStatus: CivicCompatibilityStatus;
  compatibilitySummary: string;
}

export interface CivicCompatibilityReviewMetrics {
  reviewCount: number;
  averageCompatibilityScore: number;
  recommendationAcceptanceRate: number | null;
  potentialConflictRate: number;
  manualReviewRecommendationRate: number;
}
