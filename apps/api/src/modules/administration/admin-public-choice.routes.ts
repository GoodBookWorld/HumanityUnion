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
} from "./administration.errors.js";
import {
  AdminInitiativeModerationValidationError,
  blockAdminInitiative,
  unblockAdminInitiative,
} from "./admin-initiative-moderation.service.js";
import {
  AdminPublicChoiceValidationError,
  blockAdminPublicChoiceCandidate,
  getAdminPublicChoiceDetail,
  listAdminPublicChoiceElections,
  unblockAdminPublicChoiceCandidate,
  updateAdminPublicChoiceCandidate,
} from "./admin-public-choice.service.js";
import { toPublicChoiceCandidatePublicProjection } from "@hu/types";

const adminPublicChoiceRouter = Router();

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
    error instanceof AdminPublicChoiceValidationError ||
    error instanceof AdminInitiativeModerationValidationError
  ) {
    return 400;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin Public Choice request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminPublicChoiceRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const blockedRaw = typeof req.query.blocked === "string" ? req.query.blocked : "";
      const blocked =
        blockedRaw === "blocked" || blockedRaw === "unblocked" ? blockedRaw : "";
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

      const result = await listAdminPublicChoiceElections({
        actorUserId: req.auth!.id,
        search,
        blocked,
        sort,
        order,
        limit,
        offset,
      });
      res.json(createSuccessResponse(result, "Admin Public Choice directory loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublicChoiceRouter.get(
  "/:initiativeId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = String(req.params.initiativeId ?? "").trim();
      const result = await getAdminPublicChoiceDetail({
        actorUserId: req.auth!.id,
        initiativeId,
      });
      res.json(createSuccessResponse(result, "Admin Public Choice detail loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublicChoiceRouter.post(
  "/:initiativeId/block",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = String(req.params.initiativeId ?? "").trim();
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const result = await blockAdminInitiative({
        actorUserId: req.auth!.id,
        initiativeId,
        reason,
      });
      res.json(createSuccessResponse(result, "Election blocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublicChoiceRouter.post(
  "/:initiativeId/unblock",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = String(req.params.initiativeId ?? "").trim();
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const result = await unblockAdminInitiative({
        actorUserId: req.auth!.id,
        initiativeId,
        reason,
      });
      res.json(createSuccessResponse(result, "Election unblocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublicChoiceRouter.post(
  "/:initiativeId/candidates/:candidateId/block",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = String(req.params.initiativeId ?? "").trim();
      const candidateId = String(req.params.candidateId ?? "").trim();
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const candidate = await blockAdminPublicChoiceCandidate({
        actorUserId: req.auth!.id,
        initiativeId,
        candidateId,
        reason,
      });
      res.json(
        createSuccessResponse(
          toPublicChoiceCandidatePublicProjection(candidate),
          "Candidate blocked.",
        ),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublicChoiceRouter.post(
  "/:initiativeId/candidates/:candidateId/unblock",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = String(req.params.initiativeId ?? "").trim();
      const candidateId = String(req.params.candidateId ?? "").trim();
      const candidate = await unblockAdminPublicChoiceCandidate({
        actorUserId: req.auth!.id,
        initiativeId,
        candidateId,
      });
      res.json(
        createSuccessResponse(
          toPublicChoiceCandidatePublicProjection(candidate),
          "Candidate unblocked.",
        ),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublicChoiceRouter.patch(
  "/:initiativeId/candidates/:candidateId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const initiativeId = String(req.params.initiativeId ?? "").trim();
      const candidateId = String(req.params.candidateId ?? "").trim();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const candidate = await updateAdminPublicChoiceCandidate({
        actorUserId: req.auth!.id,
        initiativeId,
        candidateId,
        name: typeof body.name === "string" ? body.name : undefined,
        photoUrl:
          body.photoUrl === null
            ? null
            : typeof body.photoUrl === "string"
              ? body.photoUrl
              : undefined,
        campaignPageUrl:
          body.campaignPageUrl === null
            ? null
            : typeof body.campaignPageUrl === "string"
              ? body.campaignPageUrl
              : undefined,
      });
      res.json(createSuccessResponse(candidate, "Candidate updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminPublicChoiceRouter;
