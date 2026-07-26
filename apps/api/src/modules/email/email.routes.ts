import type { Response } from "express";
import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { createAuthRateLimiter } from "../auth/auth-rate-limit.js";
import { authenticationMiddleware } from "../auth/auth.middleware.js";
import {
  AuthValidationError,
  DuplicateEmailError,
  InvalidCredentialsError,
} from "../auth/auth.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  confirmEmailChangeWithToken,
  requestEmailChange,
  resendRegistrationVerification,
  verifyRegistrationEmail,
} from "../auth/auth-email.service.js";
import { getEmailProviderHealth } from "./email.service.js";

const emailRouter = Router();
const resendVerificationRateLimit = createAuthRateLimiter("email-resend-verification");
const emailChangeRateLimit = createAuthRateLimiter("email-change-request");

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveEmailErrorStatus(error: unknown): number {
  if (error instanceof AuthValidationError) {
    return 400;
  }

  if (error instanceof DuplicateEmailError) {
    return 409;
  }

  if (error instanceof InvalidCredentialsError) {
    return 401;
  }

  return 500;
}

function handleEmailError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Email request failed.";
  res.status(resolveEmailErrorStatus(error)).json(createFailureResponse(message));
}

emailRouter.get("/health", async (_req, res) => {
  try {
    const health = await getEmailProviderHealth();
    res.json(createSuccessResponse(health, "Email provider health loaded."));
  } catch (error) {
    handleEmailError(res, error);
  }
});

emailRouter.get("/verify", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";

  try {
    const user = await verifyRegistrationEmail(token);
    res.json(createSuccessResponse({ user }, "Email address verified."));
  } catch (error) {
    handleEmailError(res, error);
  }
});

emailRouter.post(
  "/resend-verification",
  resendVerificationRateLimit,
  authenticationMiddleware,
  async (req, res) => {
    if (!req.auth || req.auth.id === "auth-bootstrap-001") {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const user = await resendRegistrationVerification(req.auth.id);
      res.json(createSuccessResponse({ user }, "Verification email queued."));
    } catch (error) {
      handleEmailError(res, error);
    }
  },
);

emailRouter.post(
  "/change-request",
  emailChangeRateLimit,
  authenticationMiddleware,
  async (req, res) => {
    if (!req.auth || req.auth.id === "auth-bootstrap-001") {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    const body = req.body as { newEmail?: unknown };

    try {
      const user = await requestEmailChange(req.auth.id, String(body.newEmail ?? ""));
      res.json(createSuccessResponse({ user }, "Email change verification queued."));
    } catch (error) {
      handleEmailError(res, error);
    }
  },
);

emailRouter.get("/change/confirm", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";

  try {
    const user = await confirmEmailChangeWithToken(token);
    res.json(createSuccessResponse({ user }, "Email address updated."));
  } catch (error) {
    handleEmailError(res, error);
  }
});

emailRouter.get("/me/verification-status", authenticationMiddleware, async (req, res) => {
  if (!req.auth || req.auth.id === "auth-bootstrap-001") {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const user = await findAuthUserById(req.auth.id);

    if (!user) {
      res.status(404).json(createFailureResponse("Authenticated user not found."));
      return;
    }

    res.json(
      createSuccessResponse(
        {
          emailVerificationStatus: user.emailVerificationStatus,
          emailVerifiedAt: user.emailVerifiedAt,
          pendingEmail: user.pendingEmail,
        },
        "Email verification status loaded.",
      ),
    );
  } catch (error) {
    handleEmailError(res, error);
  }
});

export default emailRouter;
