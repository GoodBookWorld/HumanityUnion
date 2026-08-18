import type { Response } from "express";
import cookieParser from "cookie-parser";
import { Router, type Request } from "express";

import { resolveAuthConfig } from "../../config/auth.config.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import {
  AuthPersistenceUnavailableError,
  AuthCodeRateLimitError,
  AuthValidationError,
  DuplicateEmailError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RegistrationUnavailableError,
  UserDisabledError,
} from "./auth.errors.js";
import {
  changePasswordForUser,
  confirmEmailChangeWithToken,
  requestEmailChange,
  requestPasswordReset,
  resetPasswordWithToken,
  validatePasswordResetToken,
  verifyRegistrationEmail,
  resendRegistrationVerification,
} from "./auth-email.service.js";
import {
  confirmRegistrationEmailCode,
  getEmailConfirmationStatus,
  resendRegistrationConfirmationCode,
} from "./auth-email-confirmation.service.js";
import {
  clearPendingConfirmationCookie,
  setPendingConfirmationCookie,
} from "./auth-pending-confirmation.cookies.js";
import { resolvePendingConfirmationUserId } from "./auth-pending-confirmation.middleware.js";
import {
  confirmLoginTwoStepCode,
  getLoginTwoStepStatus,
  resendLoginTwoStepCode,
} from "./auth-login-two-step.service.js";
import {
  confirmDisableLoginTwoStep,
  confirmEnableLoginTwoStep,
  resendLoginTwoStepSettingCode,
  startDisableLoginTwoStep,
  startEnableLoginTwoStep,
} from "./auth-login-two-step-setting.service.js";
import {
  clearPendingLoginTwoStepCookie,
  setPendingLoginTwoStepCookie,
} from "./auth-pending-login-two-step.cookies.js";
import { resolvePendingLoginTwoStepUserId } from "./auth-pending-login-two-step.middleware.js";
import { createAuthRateLimiter } from "./auth-rate-limit.js";
import {
  authenticationMiddleware,
  optionalAuthenticationMiddleware,
  requireJwtAuthenticationMiddleware,
} from "./auth.middleware.js";
import {
  clearAuthSessionCookies,
  setAuthSessionCookies,
} from "./auth-session.cookies.js";
import {
  getAuthUserPublicById,
  loginAuthUser,
  logoutAuthSession,
  refreshAuthSession,
  registerAuthUser,
  revokeAllAuthSessionsExceptCurrent,
  isEmailConfirmationRequiredResponse,
  isLoginTwoStepRequiredResponse,
} from "./auth.service.js";
import { verifyRefreshToken } from "./auth-tokens.js";

const authRouter = Router();

const registerRateLimit = createAuthRateLimiter("auth-register");
const loginRateLimit = createAuthRateLimiter("auth-login");
const refreshRateLimit = createAuthRateLimiter("auth-refresh");
const passwordResetRateLimit = createAuthRateLimiter("auth-password-reset");
const emailChangeRateLimit = createAuthRateLimiter("auth-email-change");
const resendVerificationRateLimit = createAuthRateLimiter("auth-resend-verification");
const emailConfirmationRateLimit = createAuthRateLimiter("auth-email-confirmation");
const emailConfirmationResendRateLimit = createAuthRateLimiter("auth-email-confirmation-resend");
const loginTwoStepRateLimit = createAuthRateLimiter("auth-login-two-step");
const loginTwoStepResendRateLimit = createAuthRateLimiter("auth-login-two-step-resend");
const loginTwoStepSettingRateLimit = createAuthRateLimiter("auth-login-two-step-setting");

function resolveClientIpKey(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim();
  }

  return req.ip;
}

function createFailureResponse(message: string, meta: Record<string, unknown> = {}) {
  return {
    success: false,
    data: null,
    meta,
    links: {},
    message,
  };
}

function resolveAuthErrorStatus(error: unknown): number {
  if (error instanceof AuthCodeRateLimitError) {
    return 429;
  }

  if (error instanceof AuthValidationError) {
    return 400;
  }

  if (error instanceof DuplicateEmailError) {
    return 409;
  }

  if (error instanceof InvalidCredentialsError || error instanceof InvalidRefreshTokenError) {
    return 401;
  }

  if (error instanceof UserDisabledError) {
    return 403;
  }

  if (error instanceof RegistrationUnavailableError) {
    return 403;
  }

  if (error instanceof AuthPersistenceUnavailableError) {
    return 503;
  }

  return 500;
}

function handleAuthError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Authentication request failed.";

  if (error instanceof AuthCodeRateLimitError) {
    res.status(429).json(
      createFailureResponse(message, {
        code: error.code,
        retryAfterSeconds: error.retryAfterSeconds,
        limitType: error.limitType,
      }),
    );
    return;
  }

  res.status(resolveAuthErrorStatus(error)).json(createFailureResponse(message));
}

function readRefreshToken(req: Request): string | null {
  const config = resolveAuthConfig();

  const bodyToken =
    typeof req.body === "object" &&
    req.body !== null &&
    typeof (req.body as { refreshToken?: unknown }).refreshToken === "string"
      ? (req.body as { refreshToken: string }).refreshToken.trim()
      : null;

  if (bodyToken && bodyToken.length > 0) {
    return bodyToken;
  }

  const cookieToken = req.cookies?.[config.refreshCookieName];

  if (typeof cookieToken === "string" && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  return null;
}

function createAuthRequiredResponse(message = "Authentication is required.") {
  return {
    success: false,
    data: null,
    meta: {
      code: "AUTH_REFRESH_TOKEN_REQUIRED",
    },
    links: {},
    message,
    error: {
      code: "AUTH_REFRESH_TOKEN_REQUIRED",
      message,
    },
  };
}

function resolveCurrentSessionId(refreshToken: string | null): string | undefined {
  if (!refreshToken) {
    return undefined;
  }

  try {
    return verifyRefreshToken(refreshToken).sessionId;
  } catch {
    return undefined;
  }
}

authRouter.use(cookieParser());

authRouter.post("/register", registerRateLimit, async (req, res) => {
  const body = req.body as {
    email?: unknown;
    password?: unknown;
    displayName?: unknown;
    inviteCode?: unknown;
  };

  try {
    const result = await registerAuthUser({
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      displayName: String(body.displayName ?? ""),
      inviteCode: typeof body.inviteCode === "string" ? body.inviteCode : undefined,
    });

    if (isEmailConfirmationRequiredResponse(result)) {
      setPendingConfirmationCookie(res, result.confirmation.pendingConfirmationToken);

      res.status(201).json(
        createSuccessResponse(
          {
            emailConfirmationRequired: true,
            emailSent: result.confirmation.emailSent,
            maskedEmail: result.confirmation.maskedEmail,
            resendAvailableAt: result.confirmation.resendAvailableAt,
            pendingConfirmationToken: result.confirmation.pendingConfirmationToken,
            emailDeliveryError: result.confirmation.emailDeliveryError,
          },
          "Registration accepted. Email confirmation required.",
        ),
      );
      return;
    }

    setAuthSessionCookies(res, result.tokens);

    res.status(201).json(
      createSuccessResponse(
        {
          user: result.user,
          // Compatibility: tokens remain in JSON for non-browser API clients/tests.
          // Browser clients must not persist them (Pack 07 HttpOnly cookies).
          tokens: result.tokens,
        },
        "Account registered.",
      ),
    );
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post("/login", loginRateLimit, async (req, res) => {
  const body = req.body as {
    email?: unknown;
    password?: unknown;
  };

  try {
    const result = await loginAuthUser({
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      userAgent: req.headers["user-agent"],
      ipKey: resolveClientIpKey(req),
    });

    if (isEmailConfirmationRequiredResponse(result)) {
      setPendingConfirmationCookie(res, result.confirmation.pendingConfirmationToken);

      res.json(
        createSuccessResponse(
          {
            emailConfirmationRequired: true,
            emailSent: result.confirmation.emailSent,
            maskedEmail: result.confirmation.maskedEmail,
            resendAvailableAt: result.confirmation.resendAvailableAt,
            pendingConfirmationToken: result.confirmation.pendingConfirmationToken,
            emailDeliveryError: result.confirmation.emailDeliveryError,
          },
          "Email confirmation required.",
        ),
      );
      return;
    }

    if (isLoginTwoStepRequiredResponse(result)) {
      setPendingLoginTwoStepCookie(res, result.challenge.challengeToken);

      res.json(
        createSuccessResponse(
          {
            authenticationComplete: false,
            twoStepRequired: true,
            emailSent: result.challenge.emailSent,
            maskedEmail: result.challenge.maskedEmail,
            resendAvailableAt: result.challenge.resendAvailableAt,
            challengeToken: result.challenge.challengeToken,
            emailDeliveryError: result.challenge.emailDeliveryError,
          },
          result.challenge.emailSent
            ? "Two-Step Login required."
            : "Two-Step Login required, but the login code email could not be sent.",
        ),
      );
      return;
    }

    setAuthSessionCookies(res, result.tokens);

    res.json(
      createSuccessResponse(
        {
          authenticationComplete: true,
          user: result.user,
          // Compatibility: tokens remain in JSON for non-browser API clients/tests.
          // Browser clients must not persist them (Pack 07 HttpOnly cookies).
          tokens: result.tokens,
        },
        "Signed in.",
      ),
    );
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post("/refresh", refreshRateLimit, async (req, res) => {
  const refreshToken = readRefreshToken(req);

  if (!refreshToken) {
    clearAuthSessionCookies(res);
    res.status(401).json(createAuthRequiredResponse());
    return;
  }

  try {
    const result = await refreshAuthSession(refreshToken);

    setAuthSessionCookies(res, result.tokens);

    res.json(
      createSuccessResponse(
        {
          user: result.user,
          tokens: result.tokens,
        },
        "Session refreshed.",
      ),
    );
  } catch (error) {
    clearAuthSessionCookies(res);
    handleAuthError(res, error);
  }
});

authRouter.post("/logout", authenticationMiddleware, async (req, res) => {
  const refreshToken = readRefreshToken(req);

  if (!refreshToken) {
    clearAuthSessionCookies(res);
    clearPendingConfirmationCookie(res);
    clearPendingLoginTwoStepCookie(res);
    res.json(createSuccessResponse({ loggedOut: true }, "Signed out."));
    return;
  }

  try {
    await logoutAuthSession(refreshToken);
    clearAuthSessionCookies(res);
    clearPendingConfirmationCookie(res);
    clearPendingLoginTwoStepCookie(res);
    res.json(createSuccessResponse({ loggedOut: true }, "Signed out."));
  } catch {
    clearAuthSessionCookies(res);
    clearPendingConfirmationCookie(res);
    clearPendingLoginTwoStepCookie(res);
    res.json(createSuccessResponse({ loggedOut: true }, "Signed out."));
  }
});

authRouter.post("/sessions/revoke-all", authenticationMiddleware, async (req, res) => {
  if (!req.auth || req.auth.id === "auth-bootstrap-001") {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  const refreshToken = readRefreshToken(req);
  const currentSessionId = resolveCurrentSessionId(refreshToken);

  try {
    const result = await revokeAllAuthSessionsExceptCurrent(req.auth.id, currentSessionId);
    res.json(createSuccessResponse(result, "Other sessions revoked."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.get("/verify-email", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";

  try {
    const user = await verifyRegistrationEmail(token);
    res.json(createSuccessResponse({ user }, "Email address verified."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post(
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
      handleAuthError(res, error);
    }
  },
);

authRouter.get("/email-confirmation/status", async (req, res) => {
  try {
    const userId = resolvePendingConfirmationUserId(req);
    const status = await getEmailConfirmationStatus(userId);
    res.json(createSuccessResponse(status, "Email confirmation status loaded."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post("/email-confirmation/confirm", emailConfirmationRateLimit, async (req, res) => {
  const body = req.body as { code?: unknown };

  try {
    const userId = resolvePendingConfirmationUserId(req);
    const result = await confirmRegistrationEmailCode({
      userId,
      code: String(body.code ?? ""),
    });

    clearPendingConfirmationCookie(res);
    setAuthSessionCookies(res, result.tokens);

    res.json(
      createSuccessResponse(
        {
          user: result.user,
          tokens: result.tokens,
        },
        "Your email has been confirmed.",
      ),
    );
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post(
  "/email-confirmation/resend",
  emailConfirmationResendRateLimit,
  async (req, res) => {
    try {
      const userId = resolvePendingConfirmationUserId(req);
      const status = await resendRegistrationConfirmationCode({
        userId,
        ipKey: resolveClientIpKey(req),
      });

      res.json(createSuccessResponse(status, "Confirmation code sent."));
    } catch (error) {
      handleAuthError(res, error);
    }
  },
);

authRouter.post("/email-confirmation/cancel", async (req, res) => {
  clearPendingConfirmationCookie(res);
  res.json(createSuccessResponse({ cancelled: true }, "Email confirmation cancelled."));
});

authRouter.get("/login/two-step/status", async (req, res) => {
  try {
    const userId = resolvePendingLoginTwoStepUserId(req);
    const status = await getLoginTwoStepStatus(userId);
    res.json(createSuccessResponse(status, "Login two-step status loaded."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post("/login/two-step/confirm", loginTwoStepRateLimit, async (req, res) => {
  const body = req.body as { code?: unknown };

  try {
    const userId = resolvePendingLoginTwoStepUserId(req);
    const result = await confirmLoginTwoStepCode({
      userId,
      code: String(body.code ?? ""),
      userAgent: req.headers["user-agent"],
    });

    clearPendingLoginTwoStepCookie(res);
    setAuthSessionCookies(res, result.tokens);

    res.json(
      createSuccessResponse(
        {
          authenticationComplete: true,
          user: result.user,
          tokens: result.tokens,
        },
        "Login complete.",
      ),
    );
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post("/login/two-step/resend", loginTwoStepResendRateLimit, async (req, res) => {
  try {
    const userId = resolvePendingLoginTwoStepUserId(req);
    const status = await resendLoginTwoStepCode({
      userId,
      ipKey: resolveClientIpKey(req),
    });

    res.json(createSuccessResponse(status, "Login code sent."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post("/login/two-step/cancel", async (req, res) => {
  clearPendingLoginTwoStepCookie(res);
  res.json(createSuccessResponse({ cancelled: true }, "Login verification cancelled."));
});

authRouter.post(
  "/login-two-step/enable/start",
  loginTwoStepSettingRateLimit,
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!req.auth || req.auth.id === "auth-bootstrap-001") {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    const body = req.body as { currentPassword?: unknown };

    try {
      const result = await startEnableLoginTwoStep({
        userId: req.auth.id,
        currentPassword: String(body.currentPassword ?? ""),
      });
      res.json(createSuccessResponse(result, "Verification code sent."));
    } catch (error) {
      handleAuthError(res, error);
    }
  },
);

authRouter.post(
  "/login-two-step/enable/confirm",
  loginTwoStepSettingRateLimit,
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!req.auth || req.auth.id === "auth-bootstrap-001") {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    const body = req.body as { code?: unknown };

    try {
      const user = await confirmEnableLoginTwoStep({
        userId: req.auth.id,
        code: String(body.code ?? ""),
      });
      res.json(createSuccessResponse({ user }, "Two-Step Login enabled successfully."));
    } catch (error) {
      handleAuthError(res, error);
    }
  },
);

authRouter.post(
  "/login-two-step/disable/start",
  loginTwoStepSettingRateLimit,
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!req.auth || req.auth.id === "auth-bootstrap-001") {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    const body = req.body as { currentPassword?: unknown };

    try {
      const result = await startDisableLoginTwoStep({
        userId: req.auth.id,
        currentPassword: String(body.currentPassword ?? ""),
      });
      res.json(createSuccessResponse(result, "Verification code sent."));
    } catch (error) {
      handleAuthError(res, error);
    }
  },
);

authRouter.post(
  "/login-two-step/disable/confirm",
  loginTwoStepSettingRateLimit,
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!req.auth || req.auth.id === "auth-bootstrap-001") {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    const body = req.body as { code?: unknown };

    try {
      const user = await confirmDisableLoginTwoStep({
        userId: req.auth.id,
        code: String(body.code ?? ""),
      });
      res.json(createSuccessResponse({ user }, "Two-Step Login disabled successfully."));
    } catch (error) {
      handleAuthError(res, error);
    }
  },
);

authRouter.post(
  "/login-two-step/setting/resend",
  loginTwoStepSettingRateLimit,
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!req.auth || req.auth.id === "auth-bootstrap-001") {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    const body = req.body as { action?: unknown };

    try {
      const action = body.action === "disable" ? "disable" : "enable";
      const result = await resendLoginTwoStepSettingCode({
        userId: req.auth.id,
        action,
      });
      res.json(createSuccessResponse(result, "Verification code sent."));
    } catch (error) {
      handleAuthError(res, error);
    }
  },
);

authRouter.post("/password-reset/request", passwordResetRateLimit, async (req, res) => {
  const body = req.body as { email?: unknown };

  try {
    const result = await requestPasswordReset(String(body.email ?? ""));
    res.json(createSuccessResponse(result, result.message));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.get("/password-reset/validate", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";

  try {
    const result = await validatePasswordResetToken(token);
    res.json(createSuccessResponse(result, "Password reset token validated."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post("/password-reset/confirm", passwordResetRateLimit, async (req, res) => {
  const body = req.body as { token?: unknown; password?: unknown };

  try {
    const user = await resetPasswordWithToken(
      String(body.token ?? ""),
      String(body.password ?? ""),
    );
    clearAuthSessionCookies(res);
    res.json(createSuccessResponse({ user }, "Password reset complete."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post("/password-reset/reset", passwordResetRateLimit, async (req, res) => {
  const body = req.body as { token?: unknown; password?: unknown };

  try {
    const user = await resetPasswordWithToken(
      String(body.token ?? ""),
      String(body.password ?? ""),
    );
    clearAuthSessionCookies(res);
    res.json(createSuccessResponse({ user }, "Password reset complete."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post("/password/change", authenticationMiddleware, async (req, res) => {
  if (!req.auth || req.auth.id === "auth-bootstrap-001") {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  const body = req.body as { currentPassword?: unknown; newPassword?: unknown };
  const refreshToken = readRefreshToken(req);

  try {
    const user = await changePasswordForUser({
      userId: req.auth.id,
      currentPassword: String(body.currentPassword ?? ""),
      newPassword: String(body.newPassword ?? ""),
      currentSessionId: resolveCurrentSessionId(refreshToken),
    });

    res.json(createSuccessResponse({ user }, "Password changed."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.post(
  "/email-change/request",
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
      handleAuthError(res, error);
    }
  },
);

authRouter.post("/email-change/confirm", async (req, res) => {
  const body = req.body as { token?: unknown };

  try {
    const user = await confirmEmailChangeWithToken(String(body.token ?? ""));
    res.json(createSuccessResponse({ user }, "Email address updated."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

authRouter.get("/me", requireJwtAuthenticationMiddleware, async (req, res) => {
  if (!req.auth) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const user = await getAuthUserPublicById(req.auth.id);

    if (!user) {
      res.status(404).json(createFailureResponse("Authenticated user not found."));
      return;
    }

    res.json(createSuccessResponse(user, "Current user loaded."));
  } catch (error) {
    handleAuthError(res, error);
  }
});

/**
 * Launch Readiness Pack 07 — canonical browser session probe.
 * Never returns JWT/cookie values. Uses cookie (or Bearer) identity when present.
 */
authRouter.get("/session", optionalAuthenticationMiddleware, async (req, res) => {
  try {
    if (!req.auth?.id || req.auth.id === "auth-bootstrap-001") {
      res.json(
        createSuccessResponse(
          {
            authenticated: false,
            user: null,
            authSource: "none",
          },
          "Guest session.",
        ),
      );
      return;
    }

    const user = await getAuthUserPublicById(req.auth.id);

    if (!user) {
      res.json(
        createSuccessResponse(
          {
            authenticated: false,
            user: null,
            authSource: "none",
          },
          "Guest session.",
        ),
      );
      return;
    }

    res.json(
      createSuccessResponse(
        {
          authenticated: true,
          user,
          authSource: "cookie_or_bearer",
        },
        "Authenticated session.",
      ),
    );
  } catch (error) {
    handleAuthError(res, error);
  }
});

export default authRouter;
