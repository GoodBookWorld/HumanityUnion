import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  compareInitiativeCompatibilityReviews,
  getInitiativeCompatibilityReview,
  getLatestInitiativeCompatibilityReviewForSteward,
  listInitiativeCompatibilityReviews,
  runInitiativeCompatibilityReview,
} from "./civic-compatibility-review.service.js";

const civicCompatibilityReviewRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveErrorStatus(message: string): number {
  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("do not have access")) {
    return 403;
  }

  if (message.includes("can only be requested")) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Civic compatibility review request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

function getReviewId(req: Request): string {
  const reviewId = req.params.reviewId;
  return Array.isArray(reviewId) ? (reviewId[0] ?? "") : (reviewId ?? "");
}

civicCompatibilityReviewRouter.get(
  "/initiative/:initiativeId",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const reviews = listInitiativeCompatibilityReviews(identity, getInitiativeId(req));

      res.json(createSuccessResponse(reviews, "Initiative compatibility reviews loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

civicCompatibilityReviewRouter.get(
  "/initiative/:initiativeId/latest",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const review = getLatestInitiativeCompatibilityReviewForSteward(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(review, "Latest initiative compatibility review loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

civicCompatibilityReviewRouter.get("/:reviewId", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const review = getInitiativeCompatibilityReview(identity, getReviewId(req));

    res.json(createSuccessResponse(review, "Civic compatibility review loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

civicCompatibilityReviewRouter.post(
  "/initiative/:initiativeId/run",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const review = runInitiativeCompatibilityReview(identity, getInitiativeId(req));

      res.status(201).json(createSuccessResponse(review, "Civic compatibility review generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

civicCompatibilityReviewRouter.get(
  "/compare/:baselineReviewId/:comparisonReviewId",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const baselineReviewId = Array.isArray(req.params.baselineReviewId)
        ? (req.params.baselineReviewId[0] ?? "")
        : (req.params.baselineReviewId ?? "");
      const comparisonReviewId = Array.isArray(req.params.comparisonReviewId)
        ? (req.params.comparisonReviewId[0] ?? "")
        : (req.params.comparisonReviewId ?? "");
      const comparison = compareInitiativeCompatibilityReviews(
        identity,
        baselineReviewId,
        comparisonReviewId,
      );

      res.json(createSuccessResponse(comparison, "Compatibility review comparison loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default civicCompatibilityReviewRouter;
