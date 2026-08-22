import { Router, type Response } from "express";

import type { CountryAffiliationEntryType } from "@hu/types";

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
  CountryAffiliationConflictError,
  CountryAffiliationForbiddenDeleteError,
  CountryAffiliationNotFoundError,
  CountryAffiliationValidationError,
} from "./country-affiliation.errors.js";
import {
  activateAdminCountryAffiliation,
  createAdminCountryAffiliation,
  deactivateAdminCountryAffiliation,
  deleteAdminCountryAffiliation,
  getAdminCountryAffiliation,
  listAdminCountryAffiliations,
  updateAdminCountryAffiliation,
} from "./country-affiliation.service.js";

const adminCountryAffiliationRouter = Router();

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
  if (error instanceof CountryAffiliationNotFoundError) {
    return 404;
  }
  if (
    error instanceof CountryAffiliationValidationError ||
    error instanceof CountryAffiliationConflictError ||
    error instanceof CountryAffiliationForbiddenDeleteError
  ) {
    return 400;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : "Admin country affiliation request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function parseEntryType(value: unknown): CountryAffiliationEntryType | undefined {
  if (value === "TEAM_MEMBER" || value === "PARTNER") {
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

adminCountryAffiliationRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminCountryAffiliations({
        actorUserId: req.auth!.id,
        countryCode:
          typeof req.query.countryCode === "string" ? req.query.countryCode : undefined,
        entryType: parseEntryType(req.query.entryType),
        active: parseBooleanQuery(req.query.active),
      });
      res.json(createSuccessResponse(result, "Admin country affiliations loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminCountryAffiliationRouter.get(
  "/:entryId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await getAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        entryId: String(req.params.entryId ?? "").trim(),
      });
      res.json(createSuccessResponse(result, "Admin country affiliation loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminCountryAffiliationRouter.post(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await createAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        countryCode: String(body.countryCode ?? ""),
        entryType: body.entryType as CountryAffiliationEntryType,
        name: String(body.name ?? ""),
        roleOrPosition: (body.roleOrPosition as string | null | undefined) ?? null,
        imageUrl: (body.imageUrl as string | null | undefined) ?? null,
        email: (body.email as string | null | undefined) ?? null,
        websiteUrl: (body.websiteUrl as string | null | undefined) ?? null,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
        entryId: typeof body.entryId === "string" ? body.entryId : undefined,
      });
      res.status(201).json(createSuccessResponse(result, "Country affiliation created."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminCountryAffiliationRouter.patch(
  "/:entryId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await updateAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        entryId: String(req.params.entryId ?? "").trim(),
        countryCode:
          typeof body.countryCode === "string" ? body.countryCode : undefined,
        entryType: parseEntryType(body.entryType),
        name: typeof body.name === "string" ? body.name : undefined,
        roleOrPosition:
          body.roleOrPosition === undefined
            ? undefined
            : ((body.roleOrPosition as string | null) ?? null),
        imageUrl:
          body.imageUrl === undefined
            ? undefined
            : ((body.imageUrl as string | null) ?? null),
        email:
          body.email === undefined
            ? undefined
            : ((body.email as string | null) ?? null),
        websiteUrl:
          body.websiteUrl === undefined
            ? undefined
            : ((body.websiteUrl as string | null) ?? null),
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
      });
      res.json(createSuccessResponse(result, "Country affiliation updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminCountryAffiliationRouter.post(
  "/:entryId/activate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await activateAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        entryId: String(req.params.entryId ?? "").trim(),
      });
      res.json(createSuccessResponse(result, "Country affiliation activated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminCountryAffiliationRouter.post(
  "/:entryId/deactivate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await deactivateAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        entryId: String(req.params.entryId ?? "").trim(),
      });
      res.json(createSuccessResponse(result, "Country affiliation deactivated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminCountryAffiliationRouter.delete(
  "/:entryId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const hard =
        req.query.hard === "true" ||
        req.query.hard === "1" ||
        (req.body &&
          typeof req.body === "object" &&
          (req.body as { hard?: boolean }).hard === true);
      const result = await deleteAdminCountryAffiliation({
        actorUserId: req.auth!.id,
        entryId: String(req.params.entryId ?? "").trim(),
        hard,
      });
      res.json(
        createSuccessResponse(
          result.entry,
          result.softDeactivated
            ? "Country affiliation deactivated."
            : "Country affiliation deleted.",
        ),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminCountryAffiliationRouter;
