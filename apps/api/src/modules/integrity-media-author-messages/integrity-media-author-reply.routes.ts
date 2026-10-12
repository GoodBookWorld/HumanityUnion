import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER,
} from "../external-author-link/external-author-link.constants.js";
import {
  acceptIntegrityMediaAuthorReply,
  resolveIntegrityMediaAuthorReplySecret,
} from "./integrity-media-author-reply.service.js";

const REPLY_FIELDS = new Set([
  "messageId",
  "authorId",
  "memberId",
  "linkRevision",
  "replyToMessageId",
  "body",
]);

const integrityMediaAuthorReplyRouter = Router();

integrityMediaAuthorReplyRouter.post("/author-reply", async (req, res) => {
  const body = readObject(req);
  const unexpected = unexpectedField(body, REPLY_FIELDS) ?? unexpectedQuery(req);

  if (!body || unexpected) {
    sendFailure(res, 400, "The reply request is not valid.", "invalid_request");
    return;
  }

  const linkRevision = body.linkRevision;
  const replyToProvided = Object.prototype.hasOwnProperty.call(body, "replyToMessageId");

  if (
    typeof body.messageId !== "string" ||
    typeof body.authorId !== "string" ||
    typeof body.memberId !== "string" ||
    typeof body.body !== "string" ||
    typeof linkRevision !== "number" ||
    (replyToProvided && typeof body.replyToMessageId !== "string")
  ) {
    sendFailure(res, 400, "The reply request is not valid.", "invalid_request");
    return;
  }

  const result = await acceptIntegrityMediaAuthorReply({
    messageId: body.messageId,
    authorId: body.authorId,
    memberId: body.memberId,
    linkRevision,
    ...(replyToProvided ? { replyToMessageId: body.replyToMessageId as string } : {}),
    body: body.body,
    timestamp: headerValue(req, INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER),
    signature: headerValue(req, INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER),
    secret: resolveIntegrityMediaAuthorReplySecret(),
  });

  if (!result.ok) {
    sendFailure(res, result.status, result.message, result.code);
    return;
  }

  res.json(
    createSuccessResponse(
      {
        messageId: result.messageId,
        authorId: result.authorId,
        memberId: result.memberId,
        idempotent: result.idempotent,
      },
      "Integrity Media author reply accepted.",
    ),
  );
});

export default integrityMediaAuthorReplyRouter;

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

function headerValue(req: Request, name: string): string {
  const value = req.header(name);
  return typeof value === "string" ? value.trim() : "";
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
