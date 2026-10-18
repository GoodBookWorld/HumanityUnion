import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import { WEB_SYSTEM_HEALTH_TOKEN_HEADER } from "./system-health-token.js";
import {
  acceptWebSystemHealthEvent,
  readAdminWebMemorySnapshot,
  readAdminWebSystemHealthEvents,
} from "./web-system-health.service.js";

const adminWebSystemHealthRouter = Router();
const internalWebSystemHealthRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveAdminHttpStatus(error: unknown): number {
  if (error instanceof AdministrationUnauthorizedError) {
    return 401;
  }
  if (error instanceof AdministrationForbiddenError) {
    return 403;
  }
  return 500;
}

function handleAdminError(res: Response, error: unknown): void {
  const status = resolveAdminHttpStatus(error);
  const message =
    status === 401
      ? "Authentication is required."
      : status === 403
        ? "Administrator access is required."
        : "System health request failed.";
  res.status(status).json(createFailureResponse(message));
}

adminWebSystemHealthRouter.get(
  "/snapshot",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const snapshot = await readAdminWebMemorySnapshot({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(snapshot, "Web process memory loaded."));
    } catch (error) {
      handleAdminError(res, error);
    }
  },
);

adminWebSystemHealthRouter.get(
  "/events",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const events = await readAdminWebSystemHealthEvents({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(events, "Web system health events loaded."));
    } catch (error) {
      handleAdminError(res, error);
    }
  },
);

internalWebSystemHealthRouter.post("/events", async (req, res) => {
  const presented = req.get(WEB_SYSTEM_HEALTH_TOKEN_HEADER) ?? null;
  const decision = await acceptWebSystemHealthEvent({
    presentedToken: presented,
    body: req.body,
  });

  if (decision === "closed") {
    res.status(404).json(createFailureResponse("Not found."));
    return;
  }
  if (decision === "unauthorized") {
    res.status(401).json(createFailureResponse("Not found."));
    return;
  }
  if (decision === "invalid" || decision === "unavailable") {
    res.status(decision === "unavailable" ? 503 : 400).json(
      createFailureResponse(decision === "unavailable" ? "Event was not stored." : "Invalid event."),
    );
    return;
  }
  res.status(202).json(createSuccessResponse({ accepted: true }, "Event accepted."));
});

export { adminWebSystemHealthRouter, internalWebSystemHealthRouter };
