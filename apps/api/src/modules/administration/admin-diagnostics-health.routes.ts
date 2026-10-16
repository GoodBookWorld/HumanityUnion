import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import { resolveAdminDiagnosticsHttpStatus } from "./admin-diagnostics-root-cause.js";
import {
  getAdminDiagnosticsHealth,
  getAdminOutboxFailureSummary,
} from "./admin-diagnostics-health.service.js";

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

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin diagnostics health request failed.";
  res.status(resolveAdminDiagnosticsHttpStatus(error)).json(createFailureResponse(message));
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
  "/outbox-failures",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const summary = await getAdminOutboxFailureSummary({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(summary, "Admin outbox failure summary loaded."));
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
      const { getAdminDiagnosticsPlpAutoBuild } =
        await import("./admin-diagnostics-plp-auto-build.service.js");
      const snapshot = await getAdminDiagnosticsPlpAutoBuild({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(snapshot, "PLP auto-build diagnostics loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminDiagnosticsHealthRouter;
