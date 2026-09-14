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
  BrandLocalizationConflictError,
  BrandLocalizationNotFoundError,
  BrandLocalizationPersistenceError,
  BrandLocalizationValidationError,
} from "./brand-localization.errors.js";
import {
  getAdminBrandLocalization,
  listAdminBrandLocalizations,
  publishAdminBrandLocalization,
  updateAdminBrandLocalization,
  upsertAdminBrandLocalization,
} from "./brand-localization.service.js";

const adminBrandLocalizationRouter = Router();

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
  if (error instanceof BrandLocalizationNotFoundError) {
    return 404;
  }
  if (error instanceof BrandLocalizationConflictError) {
    return 409;
  }
  if (
    error instanceof BrandLocalizationValidationError ||
    error instanceof AdministrationValidationError
  ) {
    return 400;
  }
  if (error instanceof BrandLocalizationPersistenceError) {
    return 503;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin brand localization request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function paramLocale(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

adminBrandLocalizationRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminBrandLocalizations({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(result, "Admin brand localization loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminBrandLocalizationRouter.put(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const record = await upsertAdminBrandLocalization({
        actorUserId: req.auth!.id,
        body: req.body,
      });
      res.json(createSuccessResponse(record, "Brand localization saved."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminBrandLocalizationRouter.get(
  "/:locale",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const record = await getAdminBrandLocalization({
        actorUserId: req.auth!.id,
        locale: paramLocale(req.params.locale),
      });
      res.json(createSuccessResponse(record, "Brand localization loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminBrandLocalizationRouter.patch(
  "/:locale",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const record = await updateAdminBrandLocalization({
        actorUserId: req.auth!.id,
        locale: paramLocale(req.params.locale),
        body: req.body,
      });
      res.json(createSuccessResponse(record, "Brand localization updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminBrandLocalizationRouter.post(
  "/:locale/publish",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const record = await publishAdminBrandLocalization({
        actorUserId: req.auth!.id,
        locale: paramLocale(req.params.locale),
      });
      res.json(createSuccessResponse(record, "Brand localization published."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminBrandLocalizationRouter;
