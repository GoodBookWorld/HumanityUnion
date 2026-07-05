import type {
  CivicCompatibilityReview,
  CivicCompatibilityReviewComparison,
  CivicCompatibilityReviewMetrics,
  PublicCivicCompatibilityReviewListItem,
  PublicCivicCompatibilityReviewSummary,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface PublicCivicCompatibilityReviewsResponse {
  reviews: PublicCivicCompatibilityReviewListItem[];
  latest: PublicCivicCompatibilityReviewSummary | null;
  metrics: CivicCompatibilityReviewMetrics;
}

const API_BASE_URL = "http://localhost:4000";

export async function listInitiativeCompatibilityReviews(
  initiativeId: string,
): Promise<CivicCompatibilityReview[]> {
  return apiRequest<CivicCompatibilityReview[]>(
    `/api/v1/civic-compatibility-reviews/initiative/${encodeURIComponent(initiativeId)}`,
  );
}

export async function getLatestInitiativeCompatibilityReview(
  initiativeId: string,
): Promise<CivicCompatibilityReview | null> {
  return apiRequest<CivicCompatibilityReview | null>(
    `/api/v1/civic-compatibility-reviews/initiative/${encodeURIComponent(initiativeId)}/latest`,
  );
}

export async function runInitiativeCompatibilityReview(
  initiativeId: string,
): Promise<CivicCompatibilityReview> {
  return apiRequest<CivicCompatibilityReview>(
    `/api/v1/civic-compatibility-reviews/initiative/${encodeURIComponent(initiativeId)}/run`,
    {
      method: "POST",
    },
  );
}

export async function compareInitiativeCompatibilityReviews(
  baselineReviewId: string,
  comparisonReviewId: string,
): Promise<CivicCompatibilityReviewComparison> {
  return apiRequest<CivicCompatibilityReviewComparison>(
    `/api/v1/civic-compatibility-reviews/compare/${encodeURIComponent(baselineReviewId)}/${encodeURIComponent(comparisonReviewId)}`,
  );
}

export async function listPublicCivicCompatibilityReviews(
  initiativeId: string,
): Promise<PublicCivicCompatibilityReviewsResponse> {
  const url = `${API_BASE_URL}/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/compatibility-reviews`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    success: boolean;
    data: PublicCivicCompatibilityReviewListItem[];
    meta: {
      latest?: PublicCivicCompatibilityReviewSummary | null;
      metrics?: CivicCompatibilityReviewMetrics;
    };
    message: string;
  };

  if (!body.success) {
    throw new Error(body.message || "API request failed");
  }

  return {
    reviews: body.data,
    latest: body.meta.latest ?? null,
    metrics: body.meta.metrics ?? {
      reviewCount: 0,
      averageCompatibilityScore: 0,
      recommendationAcceptanceRate: null,
      potentialConflictRate: 0,
      manualReviewRecommendationRate: 0,
    },
  };
}

export async function getPublicCivicCompatibilityReview(
  reviewId: string,
): Promise<PublicCivicCompatibilityReviewSummary> {
  return apiRequest<PublicCivicCompatibilityReviewSummary>(
    `/api/v1/public/compatibility-reviews/${encodeURIComponent(reviewId)}`,
  );
}
