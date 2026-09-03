import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  LegalLocalizationConflictError,
  LegalLocalizationNotFoundError,
  LegalLocalizationPersistenceError,
  LegalLocalizationValidationError,
} from "./legal-localization.errors.js";
import {
  getAdminLegalLocalization,
  listAdminLegalLocalizations,
  publishAdminLegalLocalization,
  updateAdminLegalLocalization,
  upsertAdminLegalLocalization,
} from "./legal-localization.service.js";

const adminLegalLocalizationRouter = Router();

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
  if (error instanceof LegalLocalizationNotFoundError) {
    return 404;
  }
  if (error instanceof LegalLocalizationConflictError) {
    return 409;
  }
  if (
    error instanceof LegalLocalizationValidationError ||
    error instanceof AdministrationValidationError
  ) {
    return 400;
  }
  if (error instanceof LegalLocalizationPersistenceError) {
    return 503;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin legal localization request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function paramString(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

adminLegalLocalizationRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminLegalLocalizations({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(result, "Admin legal localization loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminLegalLocalizationRouter.put(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const record = await upsertAdminLegalLocalization({
        actorUserId: req.auth!.id,
        body: req.body,
      });
      res.json(createSuccessResponse(record, "Legal localization saved."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminLegalLocalizationRouter.get(
  "/:documentType/:locale",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const record = await getAdminLegalLocalization({
        actorUserId: req.auth!.id,
        documentType: paramString(req.params.documentType),
        locale: paramString(req.params.locale),
      });
      res.json(createSuccessResponse(record, "Legal localization loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminLegalLocalizationRouter.patch(
  "/:documentType/:locale",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const record = await updateAdminLegalLocalization({
        actorUserId: req.auth!.id,
        documentType: paramString(req.params.documentType),
        locale: paramString(req.params.locale),
        body: req.body,
      });
      res.json(createSuccessResponse(record, "Legal localization updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminLegalLocalizationRouter.post(
  "/:documentType/:locale/publish",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const record = await publishAdminLegalLocalization({
        actorUserId: req.auth!.id,
        documentType: paramString(req.params.documentType),
        locale: paramString(req.params.locale),
      });
      res.json(createSuccessResponse(record, "Legal localization published."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminLegalLocalizationRouter;
