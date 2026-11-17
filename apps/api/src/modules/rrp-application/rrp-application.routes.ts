import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import {
  RrpApplicationAccessDeniedError,
  RrpApplicationConflictError,
  RrpApplicationNotFoundError,
  RrpApplicationUnavailableError,
  RrpApplicationValidationError,
} from "./rrp-application.errors.js";
import {
  createRrpApplicationDraftForUser,
  getOwnRrpApplicationForUser,
  listOwnRrpApplicationsForUser,
  submitOwnRrpApplicationForUser,
  updateOwnRrpApplicationDraftForUser,
  withdrawOwnRrpApplicationForUser,
} from "./rrp-application.service.js";

const rrpApplicationRouter = Router();

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
  if (error instanceof RrpApplicationValidationError) {
    return 400;
  }
  if (error instanceof RrpApplicationAccessDeniedError) {
    return 403;
  }
  if (error instanceof RrpApplicationNotFoundError) {
    return 404;
  }
  if (error instanceof RrpApplicationConflictError) {
    return 409;
  }
  if (error instanceof RrpApplicationUnavailableError) {
    return 503;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : "Regional Representative application request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function resolveAuthUserId(req: Request): string | null {
  return req.auth?.id ?? null;
}

rrpApplicationRouter.post("/", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);
  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await createRrpApplicationDraftForUser(userId, req.body);
    res.status(201).json(createSuccessResponse(payload, "RRP application draft created."));
  } catch (error) {
    handleError(res, error);
  }
});

rrpApplicationRouter.get("/me", requireJwtAuthenticationMiddleware, async (req, res) => {
  const userId = resolveAuthUserId(req);
  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await listOwnRrpApplicationsForUser(userId);
    res.json(createSuccessResponse(payload, "RRP applications loaded."));
  } catch (error) {
    handleError(res, error);
  }
});

rrpApplicationRouter.get(
  "/:applicationId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);
    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const payload = await getOwnRrpApplicationForUser({
        userId,
        applicationId: String(req.params.applicationId ?? ""),
      });
      res.json(createSuccessResponse(payload, "RRP application loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

rrpApplicationRouter.patch(
  "/:applicationId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);
    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const payload = await updateOwnRrpApplicationDraftForUser({
        userId,
        applicationId: String(req.params.applicationId ?? ""),
        body: req.body,
      });
      res.json(createSuccessResponse(payload, "RRP application draft updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

rrpApplicationRouter.post(
  "/:applicationId/submit",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);
    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const payload = await submitOwnRrpApplicationForUser({
        userId,
        applicationId: String(req.params.applicationId ?? ""),
        body: req.body,
      });
      res.json(createSuccessResponse(payload, "RRP application submitted."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

rrpApplicationRouter.post(
  "/:applicationId/withdraw",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const userId = resolveAuthUserId(req);
    if (!userId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const payload = await withdrawOwnRrpApplicationForUser({
        userId,
        applicationId: String(req.params.applicationId ?? ""),
        body: req.body,
      });
      res.json(createSuccessResponse(payload, "RRP application withdrawn."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export { rrpApplicationRouter };
