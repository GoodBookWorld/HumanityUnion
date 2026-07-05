import type { InitiativeId } from "./initiative.js";

export type CivicCompatibilityReviewId = string;

/** Advisory compatibility outcome — never blocks publication. */
export type CivicCompatibilityStatus =
  | "compatible"
  | "compatible_with_recommendations"
  | "potential_conflict"
  | "manual_review_recommended";

export type CivicCompatibilityConfidenceLevel = "high" | "medium" | "low";

export type CivicReferenceFrameworkType = "constitution" | "principles" | "human_rights" | "legal";

export interface CivicReferenceFrameworkEntry {
  frameworkId: string;
  frameworkType: CivicReferenceFrameworkType;
  title: string;
  referenceCode: string;
  excerpt: string;
  sourceLabel: string;
}

export interface CivicCompatibilityConcern {
  concernId: string;
  category: string;
  summary: string;
  explanation: string;
  severity: "low" | "medium" | "high";
  referencedFrameworkIds: string[];
}

export interface CivicCompatibilityRecommendation {
  recommendationId: string;
  summary: string;
  explanation: string;
  suggestedImprovement: string;
  referencedFrameworkIds: string[];
}

export interface ReviewedDocumentReference {
  documentType: "initiative" | "revision" | "analysis" | "proposal";
  documentId: string;
  documentLabel: string;
  version?: number;
}

export interface CivicCompatibilityReview {
  reviewId: CivicCompatibilityReviewId;
  initiativeId: InitiativeId;
  initiativeVersion: number;
  /** Sequential review number for this initiative version (re-runs increment). */
  reviewVersion: number;
  generatedAt: string;
  requestedByStewardId: string;
  providerId: string;
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
}

export interface CivicCompatibilityReviewComparison {
  baselineReviewId: CivicCompatibilityReviewId;
  comparisonReviewId: CivicCompatibilityReviewId;
  initiativeVersionChanged: boolean;
  compatibilityStatusChanged: boolean;
  addedConcerns: CivicCompatibilityConcern[];
  resolvedConcerns: CivicCompatibilityConcern[];
  addedRecommendations: CivicCompatibilityRecommendation[];
  resolvedRecommendations: CivicCompatibilityRecommendation[];
}
