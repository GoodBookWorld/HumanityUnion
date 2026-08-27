import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { getAdminPlatformReadiness } from "./admin-platform-readiness.service.js";

const adminPlatformReadinessRouter = Router();

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
  if (error instanceof AdministrationUnauthorizedError) {
    return 401;
  }
  if (error instanceof AdministrationForbiddenError) {
    return 403;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Platform readiness request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminPlatformReadinessRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const readiness = await getAdminPlatformReadiness({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(readiness, "Platform readiness loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminPlatformReadinessRouter;
