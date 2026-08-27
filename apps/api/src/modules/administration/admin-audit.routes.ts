import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationInsufficientCapabilityError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";
import {
  AdminAuditBrowserValidationError,
  listAdminAuditBrowser,
} from "./admin-audit.service.js";

const adminAuditRouter = Router();

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
  if (
    error instanceof AdministrationForbiddenError ||
    error instanceof AdministrationInsufficientCapabilityError
  ) {
    return 403;
  }
  if (error instanceof AdminAuditBrowserValidationError) {
    return 400;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Admin Audit request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminAuditRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminAuditBrowser({
        actorUserId: req.auth!.id,
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        action: typeof req.query.action === "string" ? req.query.action : undefined,
        category: typeof req.query.category === "string" ? req.query.category : undefined,
        actorId: typeof req.query.actorId === "string" ? req.query.actorId : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
        limit:
          typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 25,
        offset:
          typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : 0,
      });
      res.json(createSuccessResponse(result, "Administration audit loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminAuditRouter;
