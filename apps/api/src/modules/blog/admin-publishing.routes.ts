import { Router, type Response } from "express";

import type {
  AdminAuthorDirectoryStatusFilter,
  AdminPublicationDirectoryStatusFilter,
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
} from "../administration/administration.errors.js";
import {
  BlogConflictError,
  BlogNotFoundError,
} from "./blog.errors.js";
import {
  blockAdminAuthor,
  blockAdminPublication,
  listAdminAuthors,
  listAdminPublications,
  unblockAdminAuthor,
  unblockAdminPublication,
} from "./admin-publishing.service.js";

export const adminPublishingRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function routeParam(value: string | string[] | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return "";
}

function resolveErrorStatus(error: unknown): number {
  if (error instanceof AdministrationUnauthorizedError) {
    return 401;
  }
  if (error instanceof AdministrationForbiddenError) {
    return 403;
  }
  if (error instanceof AdministrationValidationError) {
    return 400;
  }
  if (error instanceof BlogNotFoundError) {
    return 404;
  }
  if (error instanceof BlogConflictError) {
    return 409;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin Publishing request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function parseAuthorStatus(value: unknown): AdminAuthorDirectoryStatusFilter | undefined {
  if (value === "active" || value === "blocked" || value === "all") {
    return value;
  }
  return undefined;
}

function parsePublicationStatus(
  value: unknown,
): AdminPublicationDirectoryStatusFilter | undefined {
  if (
    value === "all" ||
    value === "draft" ||
    value === "scheduled" ||
    value === "published" ||
    value === "blocked" ||
    value === "submitted_for_review" ||
    value === "archived"
  ) {
    return value;
  }
  return undefined;
}

adminPublishingRouter.get(
  "/authors",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await listAdminAuthors({
        actorUserId: req.auth!.id,
        status: parseAuthorStatus(req.query.status),
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(createSuccessResponse(data, "Authors directory loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/authors/:participantId/block",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const data = await blockAdminAuthor({
        actorUserId: req.auth!.id,
        participantId: routeParam(req.params.participantId),
        reason,
      });
      res.json(createSuccessResponse(data, "Author blocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/authors/:participantId/unblock",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const data = await unblockAdminAuthor({
        actorUserId: req.auth!.id,
        participantId: routeParam(req.params.participantId),
        reason,
      });
      res.json(createSuccessResponse(data, "Author unblocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.get(
  "/publications",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await listAdminPublications({
        actorUserId: req.auth!.id,
        status: parsePublicationStatus(req.query.status),
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(createSuccessResponse(data, "Publications directory loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/publications/:postId/block",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const data = await blockAdminPublication({
        actorUserId: req.auth!.id,
        postId: routeParam(req.params.postId),
        reason,
      });
      res.json(createSuccessResponse(data, "Publication blocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/publications/:postId/unblock",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const data = await unblockAdminPublication({
        actorUserId: req.auth!.id,
        postId: routeParam(req.params.postId),
        reason,
      });
      res.json(createSuccessResponse(data, "Publication unblocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);
