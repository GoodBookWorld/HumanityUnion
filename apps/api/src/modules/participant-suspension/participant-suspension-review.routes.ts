import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  ParticipantSuspensionRateLimitError,
  ParticipantSuspensionReviewInvalidError,
  ParticipantSuspensionValidationError,
} from "./participant-suspension.errors.js";
import { isParticipantSuspensionRateLimitError } from "./participant-suspension.rate-limit.js";
import {
  getSuspensionReviewPublic,
  submitSuspensionReview,
} from "./participant-suspension.service.js";

const participantSuspensionReviewRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveClientKey(req: {
  ip?: string;
  headers: Record<string, unknown>;
}): string {
  if (typeof req.ip === "string" && req.ip.trim()) {
    return req.ip.trim();
  }
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]!.trim();
  }
  return "unknown";
}

function resolveErrorStatus(error: unknown): number {
  if (
    error instanceof ParticipantSuspensionRateLimitError ||
    isParticipantSuspensionRateLimitError(error)
  ) {
    return 429;
  }
  if (error instanceof ParticipantSuspensionReviewInvalidError) {
    return 404;
  }
  if (error instanceof ParticipantSuspensionValidationError) {
    return 400;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Suspension review request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

/** TOKEN-ONLY public review path — no login required. */
participantSuspensionReviewRouter.get("/", async (req, res) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const result = await getSuspensionReviewPublic({ token });
    res.json(createSuccessResponse(result, "Suspension review loaded."));
  } catch (error) {
    handleError(res, error);
  }
});

participantSuspensionReviewRouter.post("/", async (req, res) => {
  try {
    const body = req.body as { token?: unknown; explanation?: unknown };
    const result = await submitSuspensionReview({
      token: String(body.token ?? ""),
      explanation: String(body.explanation ?? ""),
      clientKey: resolveClientKey(req),
    });
    res.json(createSuccessResponse(result, "Review request submitted."));
  } catch (error) {
    handleError(res, error);
  }
});

export default participantSuspensionReviewRouter;
