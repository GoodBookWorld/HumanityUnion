import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { AuthCodeRateLimitError, AuthValidationError } from "../auth/auth.errors.js";
import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import {
  PreferencesNotFoundError,
  PreferencesPersistenceUnavailableError,
  PreferencesValidationError,
} from "./preferences.errors.js";
import {
  buildNotificationEmailDestinationView,
  confirmAlternativeNotificationEmail,
  removeAlternativeNotificationEmail,
  requestAlternativeNotificationEmail,
  useAccountNotificationEmail,
} from "./notification-alternative-email.service.js";
import {
  getMemberPreferencesForAuthUser,
  updateMemberPreferencesForAuthUser,
} from "./preferences.service.js";

const preferencesRouter = Router();

function createFailureResponse(message: string, meta: Record<string, unknown> = {}) {
  return {
    success: false,
    data: null,
    meta,
    links: {},
    message,
  };
}

function resolveClientIpKey(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim();
  }
  return req.ip;
}

function resolvePreferencesErrorStatus(error: unknown): number {
  if (error instanceof AuthCodeRateLimitError) {
    return 429;
  }

  if (error instanceof PreferencesValidationError || error instanceof AuthValidationError) {
    return 400;
  }

  if (error instanceof PreferencesNotFoundError) {
    return 404;
  }

  if (error instanceof PreferencesPersistenceUnavailableError) {
    return 503;
  }

  return 500;
}

function handlePreferencesError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Member preferences request failed.";
  const meta =
    error instanceof AuthCodeRateLimitError
      ? {
          limitType: error.limitType,
          retryAfterSeconds: error.retryAfterSeconds,
        }
      : {};
  res.status(resolvePreferencesErrorStatus(error)).json(createFailureResponse(message, meta));
}

preferencesRouter.get("/me", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
  if (!req.auth?.memberId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const preferences = await getMemberPreferencesForAuthUser({
      memberId: req.auth.memberId,
      userId: req.auth.id,
    });

    res.json(createSuccessResponse(preferences, "Member preferences loaded."));
  } catch (error) {
    handlePreferencesError(res, error);
  }
});

preferencesRouter.patch("/me", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
  if (!req.auth?.memberId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const preferences = await updateMemberPreferencesForAuthUser(req.auth.memberId, req.body);
    res.json(createSuccessResponse(preferences, "Member preferences updated."));
  } catch (error) {
    handlePreferencesError(res, error);
  }
});

/** HU-NOTIF-02B — notification email destination (authenticated owner only). */
preferencesRouter.get(
  "/me/notification-email",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const destination = await buildNotificationEmailDestinationView({
        userId: req.auth.id,
        memberId: req.auth.memberId,
      });
      res.json(createSuccessResponse(destination, "Notification email destination loaded."));
    } catch (error) {
      handlePreferencesError(res, error);
    }
  },
);

preferencesRouter.post(
  "/me/notification-email/request-alternative",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const result = await requestAlternativeNotificationEmail({
        userId: req.auth.id,
        memberId: req.auth.memberId,
        email: String(req.body?.email ?? ""),
        ipKey: resolveClientIpKey(req),
      });
      res.json(
        createSuccessResponse(
          {
            preferences: result.preferences,
            destination: result.destination,
            emailSent: result.emailSent === true,
          },
          "Alternative notification email verification requested.",
        ),
      );
    } catch (error) {
      handlePreferencesError(res, error);
    }
  },
);

preferencesRouter.post(
  "/me/notification-email/confirm-alternative",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const result = await confirmAlternativeNotificationEmail({
        userId: req.auth.id,
        memberId: req.auth.memberId,
        code: String(req.body?.code ?? ""),
      });
      res.json(
        createSuccessResponse(
          {
            preferences: result.preferences,
            destination: result.destination,
          },
          "Alternative notification email verified.",
        ),
      );
    } catch (error) {
      handlePreferencesError(res, error);
    }
  },
);

preferencesRouter.post(
  "/me/notification-email/use-account",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const result = await useAccountNotificationEmail({
        userId: req.auth.id,
        memberId: req.auth.memberId,
      });
      res.json(
        createSuccessResponse(
          {
            preferences: result.preferences,
            destination: result.destination,
          },
          "Account email selected for notifications.",
        ),
      );
    } catch (error) {
      handlePreferencesError(res, error);
    }
  },
);

preferencesRouter.delete(
  "/me/notification-email/alternative",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const result = await removeAlternativeNotificationEmail({
        userId: req.auth.id,
        memberId: req.auth.memberId,
      });
      res.json(
        createSuccessResponse(
          {
            preferences: result.preferences,
            destination: result.destination,
          },
          "Alternative notification email removed.",
        ),
      );
    } catch (error) {
      handlePreferencesError(res, error);
    }
  },
);

export default preferencesRouter;
