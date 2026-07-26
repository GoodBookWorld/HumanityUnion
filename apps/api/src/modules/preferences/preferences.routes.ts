import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import {
  PreferencesNotFoundError,
  PreferencesPersistenceUnavailableError,
  PreferencesValidationError,
} from "./preferences.errors.js";
import {
  getMemberPreferencesForAuthUser,
  updateMemberPreferencesForAuthUser,
} from "./preferences.service.js";

const preferencesRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolvePreferencesErrorStatus(error: unknown): number {
  if (error instanceof PreferencesValidationError) {
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
  res.status(resolvePreferencesErrorStatus(error)).json(createFailureResponse(message));
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

export default preferencesRouter;
