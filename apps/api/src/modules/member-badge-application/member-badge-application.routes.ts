import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  optionalAuthenticationMiddleware,
  requireJwtAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  MemberBadgeApplicationAccessDeniedError,
  MemberBadgeApplicationConflictError,
  MemberBadgeApplicationNotFoundError,
  MemberBadgeApplicationUnavailableError,
  MemberBadgeApplicationValidationError,
} from "./member-badge-application.errors.js";
import {
  continueMemberBadgeApplicationPaymentForUser,
  getCurrentMemberBadgeApplicationForUser,
  getMemberBadgeApplicationAvailability,
  saveMemberBadgeApplicationForUser,
} from "./member-badge-application.service.js";

const memberBadgeApplicationRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveErrorStatus(error: unknown): number {
  if (error instanceof MemberBadgeApplicationValidationError) {
    return 400;
  }

  if (error instanceof MemberBadgeApplicationAccessDeniedError) {
    return 403;
  }

  if (error instanceof MemberBadgeApplicationNotFoundError) {
    return 404;
  }

  if (error instanceof MemberBadgeApplicationConflictError) {
    return 409;
  }

  if (error instanceof MemberBadgeApplicationUnavailableError) {
    return 503;
  }

  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Member Badge Application request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function resolveAuthUserId(req: Request): string | null {
  return req.auth?.id ?? null;
}

memberBadgeApplicationRouter.get(
  "/availability",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    try {
      const payload = await getMemberBadgeApplicationAvailability({
        userId: resolveAuthUserId(req),
      });
      res.json(createSuccessResponse(payload, "Member Badge Application availability loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

memberBadgeApplicationRouter.get("/me", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await getCurrentMemberBadgeApplicationForUser(userId);
    res.json(createSuccessResponse(payload, "Member Badge Application loaded."));
  } catch (error) {
    handleError(res, error);
  }
});

memberBadgeApplicationRouter.put("/me", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await saveMemberBadgeApplicationForUser(userId, req.body);
    res.json(createSuccessResponse(payload, "Member Badge Application saved."));
  } catch (error) {
    handleError(res, error);
  }
});

memberBadgeApplicationRouter.post(
  "/me/continue-to-payment",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const payload = await continueMemberBadgeApplicationPaymentForUser(userId, req.body);
      res.json(createSuccessResponse(payload, payload.message));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export { memberBadgeApplicationRouter };
