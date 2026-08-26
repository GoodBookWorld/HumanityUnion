/**
 * Pack 22E.1 — Admin Notification Center API.
 */
import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import {
  countAdminNotificationsForActor,
  deleteAdminNotificationForActor,
  listAdminNotificationsForActor,
} from "./admin-notification.service.js";

export const adminNotificationsRouter = Router();

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
  if (error instanceof AdministrationValidationError) {
    return 400;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin notification request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function routeParam(value: string | string[] | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return "";
}

adminNotificationsRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const limit =
        typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
      const offset =
        typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : undefined;
      const result = await listAdminNotificationsForActor({
        actorUserId: req.auth!.id,
        limit,
        offset,
      });
      res.json(createSuccessResponse(result, "Admin notifications loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminNotificationsRouter.get(
  "/count",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await countAdminNotificationsForActor({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(result, "Admin notification count loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminNotificationsRouter.delete(
  "/:adminNotificationId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await deleteAdminNotificationForActor({
        actorUserId: req.auth!.id,
        adminNotificationId: routeParam(req.params.adminNotificationId),
      });
      res.json(createSuccessResponse(result, "Admin notification cleared."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * Pack 22E.3 — evaluate operational health transitions into Admin inbox.
 * Idempotent; intended for Diagnostics refresh (not public /health).
 */
adminNotificationsRouter.post(
  "/evaluate-operational-alerts",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      await assertAdminForEvaluate(req.auth!.id);
      const { evaluateAdminOperationalAlerts } = await import(
        "./operational/evaluate-admin-operational-alerts.js"
      );
      const result = await evaluateAdminOperationalAlerts();
      res.json(createSuccessResponse(result, "Operational alerts evaluated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

async function assertAdminForEvaluate(userId: string): Promise<void> {
  const { findAuthUserById } = await import("../auth/auth-user.repository.js");
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new AdministrationUnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
}
