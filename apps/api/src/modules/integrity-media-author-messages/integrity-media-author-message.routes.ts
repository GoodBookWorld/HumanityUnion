import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { listIntegrityMediaAuthors } from "./integrity-media-author-directory.service.js";
import { listIntegrityMediaAuthorMessageHistory } from "./integrity-media-author-message.history.js";
import { sendIntegrityMediaAuthorMessage } from "./integrity-media-author-message.service.js";

const MESSAGE_FIELDS = new Set(["title", "body", "cta"]);

const LIST_QUERY = new Set(["limit", "offset", "state"]);
const HISTORY_QUERY = new Set(["limit", "cursor"]);
const DIRECTORY_STATES = new Set(["all", "linked", "disabled", "setup_pending"]);

const integrityMediaAuthorMessageRouter = Router();

integrityMediaAuthorMessageRouter.get(
  "/",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (unexpectedListQuery(req)) {
      sendFailure(res, 400, "The author list request is not valid.", "unexpected_field");
      return;
    }

    const state = readQueryString(req.query.state);
    const limit = readQueryInt(req.query.limit);
    const offset = readQueryInt(req.query.offset);

    if (
      state === "invalid" ||
      (state !== undefined && !DIRECTORY_STATES.has(state)) ||
      limit === "invalid" ||
      offset === "invalid"
    ) {
      sendFailure(res, 400, "The author list request is not valid.", "invalid_request");
      return;
    }

    try {
      const result = await listIntegrityMediaAuthors({
        actorUserId: req.auth?.id ?? "",
        actorMemberId: req.auth?.memberId ?? "",
        ...(state !== undefined ? { state } : {}),
        ...(limit !== undefined ? { limit } : {}),
        ...(offset !== undefined ? { offset } : {}),
      });

      if (!result.ok) {
        sendFailure(res, result.status, result.message, result.code);
        return;
      }

      res.status(200).json(createSuccessResponse(result.data, "Integrity authors loaded."));
    } catch (error) {
      if (error instanceof AdministrationUnauthorizedError) {
        sendFailure(res, 401, "Authentication is required.", "authentication_required");
        return;
      }

      if (error instanceof AdministrationForbiddenError) {
        sendFailure(res, 403, "Administrator access is required.", "administrator_required");
        return;
      }

      sendFailure(res, 500, "Integrity authors could not be loaded.", "unavailable");
    }
  },
);

integrityMediaAuthorMessageRouter.get(
  "/:memberId/messages",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (unexpectedHistoryQuery(req)) {
      sendFailure(res, 400, "The message history request is not valid.", "unexpected_field");
      return;
    }

    const limit = readQueryInt(req.query.limit);
    const cursor = readQueryString(req.query.cursor);

    if (limit === "invalid" || cursor === "invalid") {
      sendFailure(res, 400, "The message history request is not valid.", "invalid_request");
      return;
    }

    try {
      const result = await listIntegrityMediaAuthorMessageHistory({
        actorUserId: req.auth?.id ?? "",
        actorMemberId: req.auth?.memberId ?? "",
        recipientMemberId: String(req.params.memberId ?? ""),
        ...(limit !== undefined ? { limit } : {}),
        ...(cursor !== undefined ? { cursor } : {}),
      });

      if (!result.ok) {
        sendFailure(res, result.status, result.message, result.code);
        return;
      }

      res.status(200).json(createSuccessResponse(result.data, "Integrity author messages loaded."));
    } catch (error) {
      if (error instanceof AdministrationUnauthorizedError) {
        sendFailure(res, 401, "Authentication is required.", "authentication_required");
        return;
      }

      if (error instanceof AdministrationForbiddenError) {
        sendFailure(res, 403, "Administrator access is required.", "administrator_required");
        return;
      }

      sendFailure(res, 500, "Integrity author messages could not be loaded.", "unavailable");
    }
  },
);

integrityMediaAuthorMessageRouter.post(
  "/:memberId/messages",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const body = readObject(req);
    const unexpected = unexpectedField(body, MESSAGE_FIELDS) ?? unexpectedQuery(req);

    if (!body || unexpected) {
      sendFailure(res, 400, "The message request is not valid.", "unexpected_field");
      return;
    }

    try {
      const result = await sendIntegrityMediaAuthorMessage({
        actorUserId: req.auth?.id ?? "",
        actorMemberId: req.auth?.memberId ?? "",
        recipientMemberId: String(req.params.memberId ?? ""),
        title: body.title,
        body: body.body,
        cta: body.cta,
      });

      if (!result.ok) {
        sendFailure(res, result.status, result.message, result.code);
        return;
      }

      res.status(result.status).json(createSuccessResponse(result.data, result.message));
    } catch (error) {
      if (error instanceof AdministrationUnauthorizedError) {
        sendFailure(res, 401, "Authentication is required.", "authentication_required");
        return;
      }

      if (error instanceof AdministrationForbiddenError) {
        sendFailure(res, 403, "Administrator access is required.", "administrator_required");
        return;
      }

      sendFailure(res, 500, "The message could not be sent.", "unavailable");
    }
  },
);

export default integrityMediaAuthorMessageRouter;

function readObject(req: Request): Record<string, unknown> | null {
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    return null;
  }

  return req.body as Record<string, unknown>;
}

function unexpectedField(
  body: Record<string, unknown> | null,
  allowed: Set<string>,
): string | null {
  if (!body) {
    return "body";
  }

  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      return key;
    }
  }

  return null;
}

function unexpectedHistoryQuery(req: Request): boolean {
  for (const key of Object.keys(req.query)) {
    if (!HISTORY_QUERY.has(key)) {
      return true;
    }
  }

  return false;
}

function unexpectedListQuery(req: Request): boolean {
  for (const key of Object.keys(req.query)) {
    if (!LIST_QUERY.has(key)) {
      return true;
    }
  }

  return false;
}

function readQueryString(value: unknown): string | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "string" ? value : "invalid";
}

function readQueryInt(value: unknown): number | undefined | "invalid" {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return "invalid";
  }

  return Number(value);
}

function unexpectedQuery(req: Request): string | null {
  for (const key of Object.keys(req.query)) {
    return key;
  }

  return null;
}

function sendFailure(res: Response, status: number, message: string, code: string): void {
  res.status(status).json({
    success: false,
    data: null,
    meta: { code },
    links: {},
    message,
  });
}
