import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import {
  MediaResourceConflictError,
  MediaResourceForbiddenDeleteError,
  MediaResourceNotFoundError,
  MediaResourceValidationError,
} from "./media-resource.errors.js";
import {
  activateAdminMediaResource,
  createAdminMediaResource,
  deactivateAdminMediaResource,
  deleteAdminMediaResource,
  getAdminMediaResource,
  listAdminMediaResources,
  updateAdminMediaResource,
} from "./media-resource.service.js";
import type { MediaResourceScopeType, MediaResourceType } from "@hu/types";

const adminMediaResourcesRouter = Router();

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
  if (error instanceof MediaResourceNotFoundError) {
    return 404;
  }
  if (
    error instanceof MediaResourceValidationError ||
    error instanceof MediaResourceConflictError ||
    error instanceof MediaResourceForbiddenDeleteError
  ) {
    return 400;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin media resources request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function parseResourceType(value: unknown): MediaResourceType | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  return value.trim() as MediaResourceType;
}

function parseScopeType(value: unknown): MediaResourceScopeType | undefined {
  if (value === "WORLD" || value === "COUNTRY") {
    return value;
  }
  return undefined;
}

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return undefined;
}

adminMediaResourcesRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminMediaResources({
        actorUserId: req.auth!.id,
        resourceType: parseResourceType(req.query.resourceType),
        scopeType: parseScopeType(req.query.scopeType),
        countryCode:
          typeof req.query.countryCode === "string" ? req.query.countryCode : undefined,
        active: parseBooleanQuery(req.query.active),
      });
      res.json(createSuccessResponse(result, "Admin media resources loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminMediaResourcesRouter.get(
  "/:id",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await getAdminMediaResource({
        actorUserId: req.auth!.id,
        id: String(req.params.id ?? "").trim(),
      });
      res.json(createSuccessResponse(result, "Admin media resource loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminMediaResourcesRouter.post(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await createAdminMediaResource({
        actorUserId: req.auth!.id,
        resourceType: body.resourceType as MediaResourceType,
        scopeType: body.scopeType as MediaResourceScopeType,
        countryCode: (body.countryCode as string | null | undefined) ?? null,
        name: String(body.name ?? ""),
        logoLabel: String(body.logoLabel ?? ""),
        logoUrl: (body.logoUrl as string | null | undefined) ?? null,
        websiteUrl: String(body.websiteUrl ?? ""),
        rssUrl: (body.rssUrl as string | null | undefined) ?? null,
        categoryId: (body.categoryId as string | null | undefined) ?? null,
        description: (body.description as string | null | undefined) ?? null,
        secondaryText: (body.secondaryText as string | null | undefined) ?? null,
        language: (body.language as string | null | undefined) ?? null,
        providerId: (body.providerId as string | null | undefined) ?? null,
        active: typeof body.active === "boolean" ? body.active : undefined,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
        id: typeof body.id === "string" ? body.id : undefined,
      });
      res.status(201).json(createSuccessResponse(result, "Media resource created."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminMediaResourcesRouter.patch(
  "/:id",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await updateAdminMediaResource({
        actorUserId: req.auth!.id,
        id: String(req.params.id ?? "").trim(),
        scopeType: parseScopeType(body.scopeType),
        countryCode:
          body.countryCode === undefined
            ? undefined
            : ((body.countryCode as string | null) ?? null),
        name: typeof body.name === "string" ? body.name : undefined,
        logoLabel: typeof body.logoLabel === "string" ? body.logoLabel : undefined,
        logoUrl:
          body.logoUrl === undefined ? undefined : ((body.logoUrl as string | null) ?? null),
        websiteUrl: typeof body.websiteUrl === "string" ? body.websiteUrl : undefined,
        rssUrl:
          body.rssUrl === undefined ? undefined : ((body.rssUrl as string | null) ?? null),
        categoryId:
          body.categoryId === undefined
            ? undefined
            : ((body.categoryId as string | null) ?? null),
        description:
          body.description === undefined
            ? undefined
            : ((body.description as string | null) ?? null),
        secondaryText:
          body.secondaryText === undefined
            ? undefined
            : ((body.secondaryText as string | null) ?? null),
        language:
          body.language === undefined
            ? undefined
            : ((body.language as string | null) ?? null),
        providerId:
          body.providerId === undefined
            ? undefined
            : ((body.providerId as string | null) ?? null),
        active: typeof body.active === "boolean" ? body.active : undefined,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      });
      res.json(createSuccessResponse(result, "Media resource updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminMediaResourcesRouter.post(
  "/:id/activate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await activateAdminMediaResource({
        actorUserId: req.auth!.id,
        id: String(req.params.id ?? "").trim(),
      });
      res.json(createSuccessResponse(result, "Media resource activated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminMediaResourcesRouter.post(
  "/:id/deactivate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await deactivateAdminMediaResource({
        actorUserId: req.auth!.id,
        id: String(req.params.id ?? "").trim(),
      });
      res.json(createSuccessResponse(result, "Media resource deactivated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminMediaResourcesRouter.delete(
  "/:id",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const hard =
        req.query.hard === "true" ||
        req.query.hard === "1" ||
        (req.body && typeof req.body === "object" && (req.body as { hard?: boolean }).hard === true);
      const result = await deleteAdminMediaResource({
        actorUserId: req.auth!.id,
        id: String(req.params.id ?? "").trim(),
        hard,
      });
      res.json(
        createSuccessResponse(
          result.resource,
          result.softDeactivated
            ? "Media resource deactivated."
            : "Media resource deleted.",
        ),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminMediaResourcesRouter;
