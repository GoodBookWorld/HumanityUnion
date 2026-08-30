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
  PlatformSupportLinkNotFoundError,
  PlatformSupportLinkPersistenceError,
  PlatformSupportLinkValidationError,
} from "./platform-support-links.errors.js";
import {
  listAdminPlatformSupportLinks,
  upsertAdminPlatformSupportLink,
} from "./platform-support-links.service.js";

const adminPlatformSupportLinksRouter = Router();

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
  if (error instanceof PlatformSupportLinkNotFoundError) {
    return 404;
  }
  if (
    error instanceof PlatformSupportLinkValidationError ||
    error instanceof AdministrationValidationError
  ) {
    return 400;
  }
  if (error instanceof PlatformSupportLinkPersistenceError) {
    return 503;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Platform support links request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminPlatformSupportLinksRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminPlatformSupportLinks({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(result, "Platform support links loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPlatformSupportLinksRouter.put(
  "/:linkId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const linkId = Array.isArray(req.params.linkId)
        ? req.params.linkId[0]
        : req.params.linkId;
      const link = await upsertAdminPlatformSupportLink({
        actorUserId: req.auth!.id,
        linkId: linkId ?? "",
        body: req.body,
      });
      res.json(createSuccessResponse(link, "Platform support link saved."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminPlatformSupportLinksRouter;
