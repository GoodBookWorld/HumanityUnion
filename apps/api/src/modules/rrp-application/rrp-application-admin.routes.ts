import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  RrpApplicationAccessDeniedError,
  RrpApplicationConflictError,
  RrpApplicationNotFoundError,
  RrpApplicationUnavailableError,
  RrpApplicationValidationError,
} from "./rrp-application.errors.js";
import {
  getRrpApplicationDetailForAdminActor,
  listRrpApplicationsForAdminActor,
  reviewRrpApplicationForAdminActor,
} from "./rrp-application.service.js";
import { confirmRrpAppointmentForAdminActor } from "./rrp-appointment.service.js";

const adminRrpApplicationRouter = Router();

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
    return error.statusCode;
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
      : "Admin Regional Representative application request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function resolveAuthUserId(req: Request): string | null {
  return req.auth?.id ?? null;
}

adminRrpApplicationRouter.use(authenticationMiddleware, requireAuthenticationMiddleware);

adminRrpApplicationRouter.get("/", async (req, res) => {
  const actorUserId = resolveAuthUserId(req);
  if (!actorUserId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await listRrpApplicationsForAdminActor({
      actorUserId,
      query: req.query as Record<string, unknown>,
    });
    res.json(
      createSuccessResponse(payload, "RRP applications listed.", {
        total: payload.total,
        limit: payload.limit,
        offset: payload.offset,
      }),
    );
  } catch (error) {
    handleError(res, error);
  }
});

adminRrpApplicationRouter.get("/:applicationId", async (req, res) => {
  const actorUserId = resolveAuthUserId(req);
  if (!actorUserId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await getRrpApplicationDetailForAdminActor({
      actorUserId,
      applicationId: String(req.params.applicationId ?? ""),
    });
    res.json(createSuccessResponse(payload, "RRP application detail loaded."));
  } catch (error) {
    handleError(res, error);
  }
});

adminRrpApplicationRouter.post("/:applicationId/review", async (req, res) => {
  const actorUserId = resolveAuthUserId(req);
  if (!actorUserId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await reviewRrpApplicationForAdminActor({
      actorUserId,
      applicationId: String(req.params.applicationId ?? ""),
      body: req.body,
    });
    res.json(createSuccessResponse(payload, "RRP application review updated."));
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * HU-RRP-03C — approve application and grant Representative platform designation
 * in one confirmed operation. Administrator (active auth.role=admin) only.
 * Designation is internal platform naming — not legal authority.
 * Writes durable message intent; DM delivery is best-effort (intent stays pending on failure).
 */
adminRrpApplicationRouter.post("/:applicationId/confirm-appointment", async (req, res) => {
  const actorUserId = resolveAuthUserId(req);
  if (!actorUserId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const payload = await confirmRrpAppointmentForAdminActor({
      actorUserId,
      applicationId: String(req.params.applicationId ?? ""),
      body: req.body,
    });
    res.json(
      createSuccessResponse(
        payload,
        "RRP application approved and Representative platform designation recorded.",
      ),
    );
  } catch (error) {
    handleError(res, error);
  }
});

export { adminRrpApplicationRouter };
