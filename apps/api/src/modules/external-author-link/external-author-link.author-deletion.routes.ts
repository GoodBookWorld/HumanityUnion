import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { acceptIntegrityMediaAuthorDeletion } from "./external-author-link.author-deletion.js";
import { resolveIntegrityMediaLinkConfig } from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER,
} from "./external-author-link.constants.js";

const DELETION_FIELDS = new Set([
  "operationId",
  "authorId",
  "huTarget",
  "expectedMemberId",
  "expectedLinkRevision",
  "expectedLinkInstanceId",
]);

const integrityMediaAuthorDeletionRouter = Router();

integrityMediaAuthorDeletionRouter.post("/author-deletion", async (req, res) => {
  const body = readObject(req);
  const unexpected = unexpectedField(body, DELETION_FIELDS) ?? unexpectedQuery(req);

  if (!body || unexpected) {
    sendFailure(res, 400, "The deletion request is not valid.", "invalid_request");
    return;
  }

  const linkRevision = body.expectedLinkRevision;
  if (
    typeof body.operationId !== "string" ||
    typeof body.authorId !== "string" ||
    typeof body.huTarget !== "string" ||
    typeof body.expectedMemberId !== "string" ||
    typeof body.expectedLinkInstanceId !== "string" ||
    typeof linkRevision !== "number"
  ) {
    sendFailure(res, 400, "The deletion request is not valid.", "invalid_request");
    return;
  }

  const config = resolveIntegrityMediaLinkConfig();
  const result = await acceptIntegrityMediaAuthorDeletion({
    operationId: body.operationId,
    authorId: body.authorId,
    huTarget: body.huTarget,
    expectedMemberId: body.expectedMemberId,
    expectedLinkRevision: linkRevision,
    expectedLinkInstanceId: body.expectedLinkInstanceId,
    timestamp: headerValue(req, INTEGRITY_MEDIA_AUTHOR_DISCONNECT_TIMESTAMP_HEADER),
    signature: headerValue(req, INTEGRITY_MEDIA_AUTHOR_DISCONNECT_SIGNATURE_HEADER),
    secret: config.hmacSecret,
  });

  if (!result.ok) {
    sendFailure(res, result.status, result.message, result.code);
    return;
  }

  res.json(
    createSuccessResponse(
      {
        operationId: result.operationId,
        authorId: result.authorId,
        status: result.status,
        cleanup: result.cleanup,
        idempotent: result.idempotent,
      },
      "Integrity Media author deletion is pending.",
    ),
  );
});

export default integrityMediaAuthorDeletionRouter;

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
