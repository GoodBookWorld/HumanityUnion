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
  WebUiMessagePackNotFoundError,
  WebUiMessagePackPersistenceError,
  WebUiMessagePackValidationError,
} from "./web-ui-message-pack.errors.js";
import {
  getAdminWebUiMessagePack,
  listAdminWebUiMessagePacks,
  prepareAdminWebUiMessagePack,
  upsertAdminWebUiMessagePack,
} from "./web-ui-message-pack.service.js";

const adminWebUiMessagePackRouter = Router();

/** Complete catalogs exceed the default 100kb JSON parser. Scoped to this PUT only. */
export const ADMIN_WEB_UI_MESSAGE_PACK_JSON_LIMIT = "4mb";

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
  if (error instanceof WebUiMessagePackNotFoundError) {
    return 404;
  }
  if (
    error instanceof WebUiMessagePackValidationError ||
    error instanceof AdministrationValidationError
  ) {
    return 400;
  }
  if (error instanceof WebUiMessagePackPersistenceError) {
    return 503;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin WEB_UI message pack request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function paramLocale(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

adminWebUiMessagePackRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminWebUiMessagePacks({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(result, "WEB_UI message packs listed."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminWebUiMessagePackRouter.get(
  "/:locale/preparation",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const scope = req.query.scope;
      if (scope !== undefined && scope !== "public" && scope !== "full") {
        throw new AdministrationValidationError("scope must be public or full.");
      }
      const result = await prepareAdminWebUiMessagePack({
        actorUserId: req.auth!.id,
        locale: paramLocale(req.params.locale),
        scope: scope === "full" ? "full" : "public",
      });
      res.json(createSuccessResponse(result, "WEB_UI catalog preparation loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminWebUiMessagePackRouter.get(
  "/:locale",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await getAdminWebUiMessagePack({
        actorUserId: req.auth!.id,
        locale: paramLocale(req.params.locale),
      });
      res.json(createSuccessResponse(result, "WEB_UI message pack loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminWebUiMessagePackRouter.put(
  "/:locale",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const locale = paramLocale(req.params.locale);
      const body =
        req.body && typeof req.body === "object"
          ? { ...(req.body as Record<string, unknown>), locale }
          : { locale };
      const result = await upsertAdminWebUiMessagePack({
        actorUserId: req.auth!.id,
        body,
      });
      res.json(createSuccessResponse(result, "WEB_UI message pack upserted."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminWebUiMessagePackRouter;
