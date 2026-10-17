import { Router, type Request, type Response } from "express";

import { MongoTransactionUnavailableError } from "../../infrastructure/mongodb/mongo-transaction.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { logger } from "../../shared/observability/logger.js";
import { AuthCodeRateLimitError } from "../auth/auth.errors.js";
import { setPendingConfirmationCookie } from "../auth/auth-pending-confirmation.cookies.js";
import { setAuthSessionCookies } from "../auth/auth-session.cookies.js";
import {
  completeSsoGrant,
  registerSsoGrant,
  SsoRequestError,
} from "./external-author-link.sso.service.js";

const integrityMediaAccountSsoRouter = Router();

integrityMediaAccountSsoRouter.post("/sso", async (req, res) => {
  try {
    const result = await registerSsoGrant({
      body: readObject(req),
      timestamp: headerValue(req, "x-hu-integrity-media-timestamp"),
      signature: headerValue(req, "x-hu-integrity-media-signature"),
    });
    res.status(200).json({ success: true, grantUrl: result.grantUrl });
  } catch (error) {
    sendSsoError(res, error);
  }
});

integrityMediaAccountSsoRouter.get("/sso/complete", (_req, res) => {
  rejectCompletionMethod(res);
});

integrityMediaAccountSsoRouter.post("/sso/complete", async (req, res) => {
  try {
    const result = await completeSsoGrant({
      body: readObject(req),
      userAgent: headerValue(req, "user-agent") || undefined,
      ipKey: clientIp(req),
    });

    if (result.kind === "session") {
      setAuthSessionCookies(res, result.tokens);
      res.status(200).json(
        createSuccessResponse(
          { authenticationComplete: true, destination: result.destination },
          "Integrity Media sign-in completed.",
        ),
      );
      return;
    }

    setPendingConfirmationCookie(res, result.pendingConfirmationToken);
    res.status(200).json(
      createSuccessResponse(
        {
          emailConfirmationRequired: true,
          emailSent: result.emailSent,
          maskedEmail: result.maskedEmail,
          resendAvailableAt: result.resendAvailableAt,
          destination: result.destination,
          ...(result.emailDeliveryError ? { emailDeliveryError: result.emailDeliveryError } : {}),
        },
        "Email confirmation required.",
      ),
    );
  } catch (error) {
    sendSsoError(res, error);
  }
});

integrityMediaAccountSsoRouter.all("/sso/complete", (_req, res) => {
  rejectCompletionMethod(res);
});

export default integrityMediaAccountSsoRouter;

function rejectCompletionMethod(res: Response): void {
  logger.info("integrity_media_account_sso", { outcome: "method_not_allowed" });
  res.setHeader("Allow", "POST");
  sendFailure(res, 405, "Integrity Media sign-in completion requires POST.", "method_not_allowed");
}

function sendSsoError(res: Response, error: unknown): void {
  if (error instanceof SsoRequestError) {
    sendFailure(res, error.status, error.message, error.code);
    return;
  }

  if (error instanceof AuthCodeRateLimitError) {
    res.setHeader("Retry-After", String(error.retryAfterSeconds));
    sendFailure(res, 429, error.message, "auth_code_rate_limited");
    return;
  }

  if (error instanceof MongoTransactionUnavailableError) {
    sendFailure(res, 503, "Integrity Media sign-in is not available.", "unavailable");
    return;
  }

  sendFailure(res, 503, "Integrity Media sign-in is not available.", "unavailable");
}

function readObject(req: Request): Record<string, unknown> | null {
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    return null;
  }

  return req.body as Record<string, unknown>;
}

function headerValue(req: Request, name: string): string {
  const value = req.header(name);
  return typeof value === "string" ? value.trim() : "";
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim();
  }

  return req.ip;
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
