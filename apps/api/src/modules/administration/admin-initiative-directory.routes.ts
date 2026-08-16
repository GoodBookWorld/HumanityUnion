import { Router, type Response } from "express";
import type {
  InitiativeLifecyclePhase,
  InitiativeStatus,
  InitiativeVisibilityPolicy,
} from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "./administration.errors.js";
import {
  AdminInitiativeDirectoryValidationError,
  getAdminInitiativeDetail,
  listAdminInitiatives,
} from "./admin-initiative-directory.service.js";
import {
  AdminInitiativeCommandValidationError,
  hideAdminInitiativeFromPublic,
  restoreAdminInitiativePublicVisibility,
} from "./admin-initiative-visibility.service.js";

const adminInitiativeDirectoryRouter = Router();

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

  if (
    error instanceof AdministrationValidationError ||
    error instanceof AdminInitiativeDirectoryValidationError ||
    error instanceof AdminInitiativeCommandValidationError
  ) {
    return 400;
  }

  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin Initiative request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

const LIFECYCLE_PHASES: readonly InitiativeLifecyclePhase[] = [
  "draft",
  "published",
  "projected",
  "archived",
];

const INITIATIVE_STATUSES: readonly InitiativeStatus[] = [
  "draft",
  "proposal",
  "discussion",
  "revision",
  "ready_for_poll",
  "poll",
  "petition",
  "implementation",
  "completed",
  "archived",
  "revived",
  "superseded",
  "merged",
];

adminInitiativeDirectoryRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const lifecycleRaw =
        typeof req.query.lifecyclePhase === "string" ? req.query.lifecyclePhase : undefined;
      const lifecyclePhase =
        lifecycleRaw && LIFECYCLE_PHASES.includes(lifecycleRaw as InitiativeLifecyclePhase)
          ? (lifecycleRaw as InitiativeLifecyclePhase)
          : undefined;
      const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
      const status =
        statusRaw && INITIATIVE_STATUSES.includes(statusRaw as InitiativeStatus)
          ? (statusRaw as InitiativeStatus)
          : undefined;
      const visibilityRaw =
        typeof req.query.visibility === "string" ? req.query.visibility : undefined;
      const visibility =
        visibilityRaw === "public" || visibilityRaw === "steward_only"
          ? (visibilityRaw as InitiativeVisibilityPolicy)
          : undefined;
      const geography = typeof req.query.geography === "string" ? req.query.geography : undefined;
      const steward = typeof req.query.steward === "string" ? req.query.steward : undefined;
      const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "updatedAt";
      const sort =
        sortRaw === "updatedAt" || sortRaw === "createdAt" || sortRaw === "title"
          ? sortRaw
          : "updatedAt";
      const order = req.query.order === "asc" ? "asc" : "desc";
      const limit =
        typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 25;
      const offset =
        typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : 0;

      const result = await listAdminInitiatives({
        actorUserId: req.auth!.id,
        search,
        lifecyclePhase,
        status,
        visibility,
        geography,
        steward,
        sort,
        order,
        limit,
        offset,
      });

      res.json(createSuccessResponse(result, "Admin Initiative directory loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminInitiativeDirectoryRouter.get(
  "/:initiativeId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = String(req.params.initiativeId ?? "").trim();
      if (!initiativeId) {
        throw new AdminInitiativeDirectoryValidationError("initiativeId is required.");
      }

      const result = await getAdminInitiativeDetail({
        actorUserId: req.auth!.id,
        initiativeId,
      });

      res.json(createSuccessResponse(result, "Admin Initiative detail loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminInitiativeDirectoryRouter.post(
  "/:initiativeId/visibility/hide",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = String(req.params.initiativeId ?? "").trim();
      const reason = typeof req.body?.reason === "string" ? req.body.reason : "";

      const result = await hideAdminInitiativeFromPublic({
        actorUserId: req.auth!.id,
        initiativeId,
        reason,
      });

      res.json(createSuccessResponse(result, "Initiative hidden from public visibility."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminInitiativeDirectoryRouter.post(
  "/:initiativeId/visibility/restore",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = String(req.params.initiativeId ?? "").trim();
      const reason = typeof req.body?.reason === "string" ? req.body.reason : "";

      const result = await restoreAdminInitiativePublicVisibility({
        actorUserId: req.auth!.id,
        initiativeId,
        reason,
      });

      res.json(createSuccessResponse(result, "Initiative public visibility restored."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminInitiativeDirectoryRouter;
