import { Router, type Request, type Response } from "express";

import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveIntegrityMediaLinkConfig } from "./external-author-link.config.js";
import {
  cancelIntegrityMediaLink,
  confirmIntegrityMediaLink,
  previewIntegrityMediaLink,
  redeemIntegrityMediaLink,
  rejectIntegrityMediaLinkRequest,
} from "./external-author-link.service.js";

const CONFIRM_FIELDS = new Set(["state"]);
const REDEEM_FIELDS = new Set(["resultCode", "externalAuthorId"]);

const externalAuthorLinkRouter = Router();

externalAuthorLinkRouter.get("/preview", requireJwtAuthenticationMiddleware, async (req, res) => {
  const unexpected = unexpectedQuery(req, new Set(["state"]));

  if (unexpected) {
    await rejectIfAuthenticated(
      req,
      unexpected === "memberId" ? "browser_member_id" : "unexpected_field",
    );
    sendFailure(res, 400, "The confirmation request is not valid.", unexpectedCode(unexpected));
    return;
  }

  const result = await previewIntegrityMediaLink({
    memberId: sessionMemberId(req),
    email: req.auth?.email ?? "",
    attemptState: typeof req.query.state === "string" ? req.query.state : "",
  });

  if (!result.ok) {
    sendFailure(res, result.status, result.message, result.code);
    return;
  }

  res.json(
    createSuccessResponse(
      { source: result.source, displayName: result.displayName },
      "Humanity Union account loaded.",
    ),
  );
});

externalAuthorLinkRouter.post("/confirm", requireJwtAuthenticationMiddleware, async (req, res) => {
  const body = readObject(req);
  const unexpected = unexpectedField(body, CONFIRM_FIELDS) ?? unexpectedQuery(req, new Set());

  if (!body || unexpected) {
    const reason = unexpected === "memberId" ? "browser_member_id" : "unexpected_field";
    await rejectIfAuthenticated(req, reason);
    sendFailure(res, 400, "The confirmation request is not valid.", unexpectedCode(unexpected));
    return;
  }

  const result = await confirmIntegrityMediaLink({
    memberId: sessionMemberId(req),
    attemptState: typeof body.state === "string" ? body.state : "",
  });

  if (!result.ok) {
    sendFailure(res, result.status, result.message, result.code);
    return;
  }

  res.json(
    createSuccessResponse(
      { confirmed: true, redirectUrl: result.redirectUrl },
      "Humanity Union account confirmed.",
    ),
  );
});

externalAuthorLinkRouter.post("/cancel", requireJwtAuthenticationMiddleware, async (req, res) => {
  const body = readObject(req);
  const unexpected = unexpectedField(body, CONFIRM_FIELDS) ?? unexpectedQuery(req, new Set());

  if (!body || unexpected) {
    await rejectIfAuthenticated(
      req,
      unexpected === "memberId" ? "browser_member_id" : "unexpected_field",
    );
    sendFailure(res, 400, "The confirmation request is not valid.", unexpectedCode(unexpected));
    return;
  }

  const result = await cancelIntegrityMediaLink({
    memberId: sessionMemberId(req),
    attemptState: typeof body.state === "string" ? body.state : "",
  });

  if (!result.ok) {
    sendFailure(res, result.status, result.message, result.code);
    return;
  }

  res.json(
    createSuccessResponse(
      { cancelled: true, redirectUrl: result.redirectUrl },
      "Integrity Media connection cancelled.",
    ),
  );
});

externalAuthorLinkRouter.post("/redeem", async (req, res) => {
  const body = readObject(req);
  const unexpected = unexpectedField(body, REDEEM_FIELDS) ?? unexpectedQuery(req, new Set());

  if (!body || unexpected) {
    await rejectIntegrityMediaLinkRequest({
      memberId: null,
      reason: unexpected === "memberId" ? "browser_member_id" : "unexpected_field",
    });
    sendFailure(res, 400, "The redemption request is not valid.", unexpectedCode(unexpected));
    return;
  }

  const config = resolveIntegrityMediaLinkConfig();
  const result = await redeemIntegrityMediaLink({
    resultCode: typeof body.resultCode === "string" ? body.resultCode : "",
    externalAuthorId: typeof body.externalAuthorId === "string" ? body.externalAuthorId : "",
    timestamp: headerValue(req, "x-hu-integrity-media-timestamp"),
    signature: headerValue(req, "x-hu-integrity-media-signature"),
    secret: config.hmacSecret,
  });

  if (!result.ok) {
    sendFailure(res, result.status, result.message, result.code);
    return;
  }

  res.json(
    createSuccessResponse(
      {
        memberId: result.memberId,
        source: result.source,
        externalAuthorId: result.externalAuthorId,
        reconnected: result.reconnected,
      },
      "Integrity Media link redeemed.",
    ),
  );
});

export default externalAuthorLinkRouter;

function sessionMemberId(req: Request): string {
  return req.auth?.memberId ?? "";
}

async function rejectIfAuthenticated(
  req: Request,
  reason: "browser_member_id" | "unexpected_field",
): Promise<void> {
  await rejectIntegrityMediaLinkRequest({
    memberId: req.auth?.memberId ?? null,
    reason,
  });
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

function unexpectedQuery(req: Request, allowed: Set<string>): string | null {
  for (const key of Object.keys(req.query)) {
    if (!allowed.has(key)) {
      return key;
    }
  }

  return null;
}

function unexpectedCode(field: string | null): string {
  if (field === "memberId") {
    return "browser_member_id";
  }

  if (field === "returnUrl" || field === "returnTo" || field === "redirect") {
    return "return_origin_rejected";
  }

  return "unexpected_field";
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
