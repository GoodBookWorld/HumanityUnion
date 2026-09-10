import { Router, type Response } from "express";

import { createSuccessResponse } from "../../../shared/http-response.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../../administration/administration.errors.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../../auth/auth.middleware.js";
import {
  LanguageRegistryConflictError,
  LanguageRegistryNotFoundError,
  LanguageRegistryPersistenceError,
  LanguageRegistryValidationError,
} from "./language-registry.errors.js";
import {
  createAdminLanguage,
  listAdminLanguages,
  updateAdminLanguage,
} from "./language-registry.service.js";

const adminLanguagesRouter = Router();

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
  if (error instanceof LanguageRegistryNotFoundError) {
    return 404;
  }
  if (error instanceof LanguageRegistryConflictError) {
    return 409;
  }
  if (
    error instanceof LanguageRegistryValidationError ||
    error instanceof AdministrationValidationError
  ) {
    return 400;
  }
  if (error instanceof LanguageRegistryPersistenceError) {
    return 503;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Admin languages request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminLanguagesRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminLanguages({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(result, "Admin languages loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminLanguagesRouter.post(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const language = await createAdminLanguage({
        actorUserId: req.auth!.id,
        body: req.body,
      });
      res.status(201).json(createSuccessResponse(language, "Language created."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminLanguagesRouter.patch(
  "/:languageId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const languageId = Array.isArray(req.params.languageId)
        ? req.params.languageId[0]
        : req.params.languageId;
      const language = await updateAdminLanguage({
        actorUserId: req.auth!.id,
        languageId: languageId ?? "",
        body: req.body,
      });
      res.json(createSuccessResponse(language, "Language updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * Closure 07 — localization readiness for one Admin language (provider-free).
 * Does not enqueue backfill and does not mutate seoIndexingEnabled.
 */
adminLanguagesRouter.get(
  "/:languageId/localization-readiness",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      await listAdminLanguages({ actorUserId: req.auth!.id });
      const languageId = Array.isArray(req.params.languageId)
        ? req.params.languageId[0]
        : req.params.languageId;
      const { listLanguageRegistry } = await import("./language-registry.repository.js");
      const { evaluateLanguageLocalizationReadiness } = await import(
        "../language-localization-activation/index.js"
      );
      const records = await listLanguageRegistry();
      const record = records.find((row) => row.languageId === (languageId ?? ""));
      if (!record) {
        throw new LanguageRegistryNotFoundError(
          `Language registry record not found: ${languageId}`,
        );
      }
      const readiness = await evaluateLanguageLocalizationReadiness({
        locale: record.locale,
        registryRecord: record,
      });
      res.json(
        createSuccessResponse(readiness, "Language localization readiness loaded."),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminLanguagesRouter;
