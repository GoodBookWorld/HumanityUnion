import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { sendIntegrityMediaAuthorMessage } from "./integrity-media-author-message.service.js";

const MESSAGE_FIELDS = new Set(["title", "body", "cta"]);

const integrityMediaAuthorMessageRouter = Router();

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
