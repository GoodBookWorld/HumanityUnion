import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { listIntegrityMediaAuthors } from "./integrity-media-author-directory.service.js";
import { INTEGRITY_MEDIA_AUTHOR_MESSAGE_HISTORY_PAGE_SIZE } from "./integrity-media-author-message.constants.js";
import { isIntegrityMediaAuthorMessageId } from "./integrity-media-author-message.contract.js";
import {
  acknowledgePresentedIntegrityMediaAuthorChats,
  listIntegrityMediaAuthorMessageHistory,
  resolveIntegrityMediaAuthorReplyMember,
} from "./integrity-media-author-message.history.js";
import {
  sendIntegrityMediaAuthorChat,
  sendIntegrityMediaAuthorMessage,
} from "./integrity-media-author-message.service.js";

const MESSAGE_FIELDS = new Set(["title", "body", "cta"]);
const CHAT_FIELDS = new Set(["body"]);

const LIST_QUERY = new Set(["limit", "offset", "state"]);
const REPLY_TARGET_QUERY = new Set(["messageId"]);
const HISTORY_QUERY = new Set(["limit", "cursor"]);
const DIRECTORY_STATES = new Set(["all", "linked", "disabled", "setup_pending", "unread"]);
const READ_FIELDS = new Set(["messageIds"]);

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
  "/reply-target",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (unexpectedReplyTargetQuery(req)) {
      sendFailure(res, 400, "The author conversation request is not valid.", "unexpected_field");
      return;
    }

    const messageId = readQueryString(req.query.messageId);
    if (messageId === "invalid" || !messageId || !isIntegrityMediaAuthorMessageId(messageId)) {
      sendFailure(res, 404, "The author conversation could not be found.", "not_found");
      return;
    }

    try {
      const result = await resolveIntegrityMediaAuthorReplyMember({
        actorUserId: req.auth?.id ?? "",
        actorMemberId: req.auth?.memberId ?? "",
        messageId,
      });

      if (!result.ok) {
        sendFailure(res, result.status, result.message, result.code);
        return;
      }

      res.status(200).json(createSuccessResponse(result.data, "Integrity author conversation found."));
    } catch (error) {
      if (error instanceof AdministrationUnauthorizedError) {
        sendFailure(res, 401, "Authentication is required.", "authentication_required");
        return;
      }

      if (error instanceof AdministrationForbiddenError) {
        sendFailure(res, 403, "Administrator access is required.", "administrator_required");
        return;
      }

      sendFailure(res, 500, "The author conversation could not be loaded.", "unavailable");
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
  "/:memberId/messages/read",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const body = readObject(req);
    const unexpected = unexpectedField(body, READ_FIELDS) ?? unexpectedQuery(req);
    const messageIds = body ? readMessageIds(body.messageIds) : "invalid";

    if (!body || unexpected || messageIds === "invalid") {
      sendFailure(
        res,
        400,
        "The message history request is not valid.",
        unexpected ? "unexpected_field" : "invalid_request",
      );
      return;
    }

    try {
      const result = await acknowledgePresentedIntegrityMediaAuthorChats({
        actorUserId: req.auth?.id ?? "",
        actorMemberId: req.auth?.memberId ?? "",
        recipientMemberId: String(req.params.memberId ?? ""),
        messageIds,
      });

      if (!result.ok) {
        sendFailure(res, result.status, result.message, result.code);
        return;
      }

      res.status(200).json(createSuccessResponse(result.data, "Integrity author messages marked read."));
    } catch (error) {
      if (error instanceof AdministrationUnauthorizedError) {
        sendFailure(res, 401, "Authentication is required.", "authentication_required");
        return;
      }

      if (error instanceof AdministrationForbiddenError) {
        sendFailure(res, 403, "Administrator access is required.", "administrator_required");
        return;
      }

      sendFailure(res, 500, "Integrity author messages could not be updated.", "unavailable");
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

integrityMediaAuthorMessageRouter.post(
  "/:memberId/chat",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const body = readObject(req);
    const unexpected = unexpectedField(body, CHAT_FIELDS) ?? unexpectedQuery(req);

    if (!body || unexpected) {
      sendFailure(res, 400, "The message request is not valid.", "unexpected_field");
      return;
    }

    try {
      const result = await sendIntegrityMediaAuthorChat({
        actorUserId: req.auth?.id ?? "",
        actorMemberId: req.auth?.memberId ?? "",
        recipientMemberId: String(req.params.memberId ?? ""),
        body: body.body,
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

function unexpectedReplyTargetQuery(req: Request): boolean {
  for (const key of Object.keys(req.query)) {
    if (!REPLY_TARGET_QUERY.has(key)) {
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

function readMessageIds(value: unknown): string[] | "invalid" {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > INTEGRITY_MEDIA_AUTHOR_MESSAGE_HISTORY_PAGE_SIZE
  ) {
    return "invalid";
  }

  const ids: string[] = [];
  for (const entry of value) {
    if (!isIntegrityMediaAuthorMessageId(entry)) {
      return "invalid";
    }
    if (!ids.includes(entry)) {
      ids.push(entry);
    }
  }

  return ids;
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
