import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveIntegrityMediaLinkConfig } from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER,
} from "./external-author-link.constants.js";
import { acceptIntegrityMediaAuthorDisconnect } from "./external-author-link.disconnect.js";

const DISCONNECT_FIELDS = new Set(["eventId", "authorId", "linkRevision", "generation"]);

const integrityMediaAuthorDisconnectRouter = Router();

integrityMediaAuthorDisconnectRouter.post("/author-disconnect", async (req, res) => {
  const body = readObject(req);
  const unexpected = unexpectedField(body, DISCONNECT_FIELDS) ?? unexpectedQuery(req);

  if (!body || unexpected) {
    sendFailure(res, 400, "The disconnect request is not valid.", "invalid_request");
    return;
  }

  const protocol = readProtocol(body);
  if (!protocol) {
    sendFailure(res, 400, "The disconnect request is not valid.", "invalid_request");
    return;
  }

  const config = resolveIntegrityMediaLinkConfig();
  const result = await acceptIntegrityMediaAuthorDisconnect({
    eventId: typeof body.eventId === "string" ? body.eventId : "",
    authorId: typeof body.authorId === "string" ? body.authorId : "",
    timestamp: headerValue(req, INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER),
    signature: headerValue(req, INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER),
    secret: config.hmacSecret,
    protocol,
  });

  if (!result.ok) {
    sendFailure(res, result.status, result.message, result.code);
    return;
  }

  res.json(
    createSuccessResponse(
      {
        eventId: result.eventId,
        authorId: result.authorId,
        state: result.state,
        idempotent: result.idempotent,
        superseded: result.superseded,
        linkRevision: result.linkRevision,
      },
      "Integrity Media author disconnected.",
    ),
  );
});

export default integrityMediaAuthorDisconnectRouter;

function readProtocol(
  body: Record<string, unknown>,
): { kind: "legacy" } | { kind: "initial" } | { kind: "numbered"; linkRevision: number } | null {
  const hasRevision = Object.prototype.hasOwnProperty.call(body, "linkRevision");
  const hasGeneration = Object.prototype.hasOwnProperty.call(body, "generation");

  if (hasRevision && hasGeneration) {
    return null;
  }

  if (hasGeneration) {
    return body.generation === "initial" ? { kind: "initial" } : null;
  }

  if (!hasRevision) {
    return { kind: "legacy" };
  }

  if (typeof body.linkRevision !== "number" || !Number.isInteger(body.linkRevision) || body.linkRevision < 1) {
    return null;
  }

  return { kind: "numbered", linkRevision: body.linkRevision };
}

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
