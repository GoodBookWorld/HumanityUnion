import { Router, type Request, type Response } from "express";

import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveIntegrityMediaLinkConfig } from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_PROVISION_VERSION_SIGNATURE_HEADER,
  INTEGRITY_MEDIA_PROVISION_VERSION_TIMESTAMP_HEADER,
} from "./external-author-link.constants.js";
import {
  cancelIntegrityMediaLink,
  acknowledgeIntegrityMediaLink,
  confirmIntegrityMediaLink,
  previewIntegrityMediaLink,
  redeemIntegrityMediaLink,
  rejectIntegrityMediaLinkRequest,
} from "./external-author-link.service.js";
import {
  confirmProvisionAttempt,
  ProvisionRequestError,
  readProvisionConsent,
  registerProvisionAttempt,
  registerProvisionSnapshot,
} from "./external-author-link.provision.service.js";
import { MongoTransactionUnavailableError } from "../../infrastructure/mongodb/mongo-transaction.js";

const CONFIRM_FIELDS = new Set(["state"]);
const REDEEM_FIELDS = new Set(["resultCode", "externalAuthorId"]);
const ACKNOWLEDGE_FIELDS = new Set([
  "eventId",
  "externalAuthorId",
  "memberId",
  "linkRevision",
  "linkInstanceId",
]);

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
        linkRevision: result.linkRevision,
        ...(result.linkInstanceId ? { linkInstanceId: result.linkInstanceId } : {}),
        ...(result.provisionOutcome ? { provisionOutcome: result.provisionOutcome } : {}),
      },
      "Integrity Media link redeemed.",
    ),
  );
});

externalAuthorLinkRouter.post("/acknowledge", async (req, res) => {
  const body = readObject(req);
  const unexpected = unexpectedField(body, ACKNOWLEDGE_FIELDS) ?? unexpectedQuery(req, new Set());

  if (!body || unexpected) {
    sendFailure(res, 400, "The acknowledgement request is not valid.", "invalid_request");
    return;
  }

  const config = resolveIntegrityMediaLinkConfig();
  const result = await acknowledgeIntegrityMediaLink({
    eventId: typeof body.eventId === "string" ? body.eventId : "",
    externalAuthorId: typeof body.externalAuthorId === "string" ? body.externalAuthorId : "",
    memberId: typeof body.memberId === "string" ? body.memberId : "",
    linkRevision: typeof body.linkRevision === "number" ? body.linkRevision : Number.NaN,
    linkInstanceId: typeof body.linkInstanceId === "string" ? body.linkInstanceId : "",
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
        source: result.source,
        externalAuthorId: result.externalAuthorId,
        memberId: result.memberId,
        linkRevision: result.linkRevision,
        linkInstanceId: result.linkInstanceId,
        finalization: result.finalization,
        idempotent: result.idempotent,
      },
      "Integrity Media link acknowledged.",
    ),
  );
});

externalAuthorLinkRouter.post("/provision-attempt", async (req, res) => {
  try {
    const result = await registerProvisionAttempt({
      body: readObject(req),
      timestamp: headerValue(req, "x-hu-integrity-media-timestamp"),
      signature: headerValue(req, "x-hu-integrity-media-signature"),
      versionTimestamp: headerValue(req, INTEGRITY_MEDIA_PROVISION_VERSION_TIMESTAMP_HEADER),
      versionSignature: headerValue(req, INTEGRITY_MEDIA_PROVISION_VERSION_SIGNATURE_HEADER),
    });
    res.status(200).json(
      createSuccessResponse(result, "Integrity Media provision attempt stored."),
    );
  } catch (error) {
    sendProvisionError(res, error);
  }
});

externalAuthorLinkRouter.post("/provision-snapshot", async (req, res) => {
  try {
    const result = await registerProvisionSnapshot({
      body: readObject(req),
      timestamp: headerValue(req, "x-hu-integrity-media-timestamp"),
      signature: headerValue(req, "x-hu-integrity-media-signature"),
    });
    res.status(200).json(
      createSuccessResponse(result, "Integrity Media provision snapshot stored."),
    );
  } catch (error) {
    sendProvisionError(res, error);
  }
});

externalAuthorLinkRouter.get("/provision-consent", async (req, res) => {
  const unexpected = unexpectedQuery(req, new Set(["state"]));

  if (unexpected) {
    sendFailure(res, 400, "The confirmation request is not valid.", "unexpected_field");
    return;
  }

  try {
    const result = await readProvisionConsent({
      attemptState: typeof req.query.state === "string" ? req.query.state : "",
    });
    res.json(createSuccessResponse(result, "Integrity Media provision consent loaded."));
  } catch (error) {
    sendProvisionError(res, error);
  }
});

externalAuthorLinkRouter.post("/provision-confirm", async (req, res) => {
  try {
    const result = await confirmProvisionAttempt({ body: readObject(req) });
    res.json(createSuccessResponse(result, "Humanity Union account provision confirmed."));
  } catch (error) {
    sendProvisionError(res, error);
  }
});

export default externalAuthorLinkRouter;

function sendProvisionError(res: Response, error: unknown): void {
  if (error instanceof ProvisionRequestError) {
    sendFailure(res, error.status, error.message, error.code);
    return;
  }

  if (error instanceof MongoTransactionUnavailableError) {
    sendFailure(res, 503, "Integrity Media account provisioning is not available.", "unavailable");
    return;
  }

  sendFailure(res, 503, "Integrity Media account provisioning is not available.", "unavailable");
}

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
