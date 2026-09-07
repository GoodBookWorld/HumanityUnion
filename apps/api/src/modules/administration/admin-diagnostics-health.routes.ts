import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";
import { getAdminDiagnosticsHealth } from "./admin-diagnostics-health.service.js";

const adminDiagnosticsHealthRouter = Router();

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
    error instanceof Error ? error.message : "Admin diagnostics health request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminDiagnosticsHealthRouter.get(
  "/health",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const health = await getAdminDiagnosticsHealth({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(health, "Admin diagnostics health loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminDiagnosticsHealthRouter.get(
  "/plp-auto-build",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { getAdminDiagnosticsPlpAutoBuild } = await import(
        "./admin-diagnostics-plp-auto-build.service.js"
      );
      const snapshot = await getAdminDiagnosticsPlpAutoBuild({
        actorUserId: req.auth!.id,
      });
      res.json(
        createSuccessResponse(snapshot, "PLP auto-build diagnostics loaded."),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminDiagnosticsHealthRouter;
