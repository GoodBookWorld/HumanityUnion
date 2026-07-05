import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  computeCivicCompatibilityReviewMetrics,
  getLatestPublicCivicCompatibilityReview,
  getPublicCivicCompatibilityReviewById,
  listPublicCivicCompatibilityReviews,
} from "./public-civic-compatibility-review.projection.js";

const publicCivicCompatibilityReviewRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicCivicCompatibilityReviewRouter.get("/:reviewId", (req, res) => {
  const reviewId = Array.isArray(req.params.reviewId)
    ? (req.params.reviewId[0] ?? "")
    : (req.params.reviewId ?? "");
  const review = getPublicCivicCompatibilityReviewById(reviewId);

  if (!review) {
    res
      .status(404)
      .json(createFailureResponse("Public civic compatibility review is not available."));
    return;
  }

  res.json(createSuccessResponse(review, "Public civic compatibility review loaded."));
});

export const publicCivicCompatibilityReviewsByInitiativeRouter = Router();

publicCivicCompatibilityReviewsByInitiativeRouter.get(
  "/:initiativeId/compatibility-reviews",
  (req, res) => {
    const initiativeId = Array.isArray(req.params.initiativeId)
      ? (req.params.initiativeId[0] ?? "")
      : (req.params.initiativeId ?? "");
    const initiative = getInitiativeById(initiativeId);

    if (!initiative) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    if (!canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    const reviews = listPublicCivicCompatibilityReviews(initiativeId);
    const latest = getLatestPublicCivicCompatibilityReview(initiativeId);
    const metrics = computeCivicCompatibilityReviewMetrics(initiativeId);

    res.json(
      createSuccessResponse(reviews, "Public civic compatibility reviews loaded.", {
        latest,
        metrics,
      }),
    );
  },
);

export default publicCivicCompatibilityReviewRouter;
