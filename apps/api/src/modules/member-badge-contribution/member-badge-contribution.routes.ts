import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  optionalAuthenticationMiddleware,
  requireJwtAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import { createMemberBadgeCheckoutSession } from "./member-badge-checkout.service.js";
import {
  MemberBadgeContributionAccessDeniedError,
  MemberBadgeContributionConflictError,
  MemberBadgeContributionNotFoundError,
  MemberBadgeContributionUnavailableError,
  MemberBadgeContributionValidationError,
} from "./member-badge-contribution.errors.js";
import {
  getMemberBadgeContributionAvailability,
  getMemberBadgeContributionBySessionForUser,
  getMemberBadgeContributionDetailForUser,
  listMemberBadgeContributionsForUser,
} from "./member-badge-contribution.service.js";

const memberBadgeContributionRouter = Router();

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
  if (error instanceof MemberBadgeContributionValidationError) {
    return 400;
  }

  if (error instanceof MemberBadgeContributionAccessDeniedError) {
    return 403;
  }

  if (error instanceof MemberBadgeContributionNotFoundError) {
    return 404;
  }

  if (error instanceof MemberBadgeContributionConflictError) {
    return 409;
  }

  if (error instanceof MemberBadgeContributionUnavailableError) {
    return 503;
  }

  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Member Badge request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function resolveAuthUserId(req: Request): string | null {
  return req.auth?.id ?? null;
}

function resolveOptionalAuthUserId(req: Request): string | null {
  return req.auth?.id ?? null;
}

memberBadgeContributionRouter.get(
  "/availability",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    try {
      const userId = resolveOptionalAuthUserId(req);
      const payload = await getMemberBadgeContributionAvailability({ userId });
      res.json(createSuccessResponse(payload, "Member Badge availability loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

memberBadgeContributionRouter.get("/me", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await listMemberBadgeContributionsForUser(userId);
    res.json(createSuccessResponse(payload, "Member Badge requests loaded."));
  } catch (error) {
    handleError(res, error);
  }
});

memberBadgeContributionRouter.get(
  "/me/session/:sessionId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);
    const sessionId = String(req.params.sessionId ?? "");

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const payload = await getMemberBadgeContributionBySessionForUser({ userId, sessionId });

      if (!payload) {
        res.status(404).json(createFailureResponse("Badge request not found for this session."));
        return;
      }

      res.json(createSuccessResponse(payload, "Member Badge request loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

memberBadgeContributionRouter.get(
  "/me/:badgeContributionId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);
    const badgeContributionId = String(req.params.badgeContributionId ?? "");

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const payload = await getMemberBadgeContributionDetailForUser({
        userId,
        badgeContributionId,
      });
      res.json(createSuccessResponse(payload, "Member Badge request detail loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

memberBadgeContributionRouter.post(
  "/checkout",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);

    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    void req.body;

    try {
      const payload = await createMemberBadgeCheckoutSession({ userId });
      res.json(createSuccessResponse(payload, "Member Badge Checkout Session created."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export { memberBadgeContributionRouter };
