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
  SeoPageOverrideForbiddenTargetError,
  SeoPageOverrideNotFoundError,
  SeoPageOverridePersistenceError,
  SeoPageOverrideValidationError,
} from "./seo-page-overrides.errors.js";
import {
  clearAdminSeoPageOverride,
  getAdminSeoPageOverride,
  listAdminSeoPageOverrideIds,
  upsertAdminSeoPageOverride,
} from "./seo-page-overrides.service.js";

const adminSeoPageOverridesRouter = Router();

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
    error instanceof SeoPageOverrideForbiddenTargetError
  ) {
    return 403;
  }
  if (error instanceof SeoPageOverrideNotFoundError) {
    return 404;
  }
  if (
    error instanceof SeoPageOverrideValidationError ||
    error instanceof AdministrationValidationError
  ) {
    return 400;
  }
  if (error instanceof SeoPageOverridePersistenceError) {
    return 503;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "SEO page override request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminSeoPageOverridesRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminSeoPageOverrideIds({
        actorUserId: req.auth!.id,
        family: typeof req.query.family === "string" ? req.query.family : undefined,
      });
      res.json(createSuccessResponse(result, "SEO page override ids loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminSeoPageOverridesRouter.get(
  "/:family/:entityKey",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await getAdminSeoPageOverride({
        actorUserId: req.auth!.id,
        family: String(req.params.family ?? ""),
        entityKey: String(req.params.entityKey ?? ""),
      });
      res.json(createSuccessResponse(result, "SEO page override loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminSeoPageOverridesRouter.put(
  "/:family/:entityKey",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await upsertAdminSeoPageOverride({
        actorUserId: req.auth!.id,
        family: String(req.params.family ?? ""),
        entityKey: String(req.params.entityKey ?? ""),
        canonicalPath: String(body.canonicalPath ?? ""),
        fields: body.fields ?? body,
      });
      res.json(createSuccessResponse(result, "SEO page override saved."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminSeoPageOverridesRouter.delete(
  "/:family/:entityKey",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await clearAdminSeoPageOverride({
        actorUserId: req.auth!.id,
        family: String(req.params.family ?? ""),
        entityKey: String(req.params.entityKey ?? ""),
      });
      res.json(createSuccessResponse(result, "SEO page override cleared."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export { adminSeoPageOverridesRouter };
