import { Router } from "express";
import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import {
  getPreferencesByMemberId,
  updatePreferences,
  type PreferencesUpdate,
} from "./preferences.store.js";

const preferencesRouter = Router();

const EDITABLE_GROUPS = new Set([
  "experiencePreferences",
  "participationPreferences",
  "communicationPreferences",
  "accessibilityPreferences",
  "workspacePreferences",
]);

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

preferencesRouter.get("/me", authenticationMiddleware, (req, res) => {
  const preferences = getPreferencesByMemberId(req.auth!.memberId);

  if (!preferences) {
    res.status(404).json(createFailureResponse("Member preferences not found."));
    return;
  }

  res.json(createSuccessResponse(preferences, "Member preferences loaded."));
});

preferencesRouter.patch("/me", authenticationMiddleware, (req, res) => {
  const body = req.body as Record<string, unknown>;

  for (const key of Object.keys(body)) {
    if (!EDITABLE_GROUPS.has(key)) {
      res.status(400).json(createFailureResponse(`Field "${key}" cannot be modified.`));
      return;
    }
  }

  const update: PreferencesUpdate = {};

  if (body.experiencePreferences !== undefined) {
    update.experiencePreferences =
      body.experiencePreferences as PreferencesUpdate["experiencePreferences"];
  }

  if (body.participationPreferences !== undefined) {
    update.participationPreferences =
      body.participationPreferences as PreferencesUpdate["participationPreferences"];
  }

  if (body.communicationPreferences !== undefined) {
    update.communicationPreferences =
      body.communicationPreferences as PreferencesUpdate["communicationPreferences"];
  }

  if (body.accessibilityPreferences !== undefined) {
    update.accessibilityPreferences =
      body.accessibilityPreferences as PreferencesUpdate["accessibilityPreferences"];
  }

  if (body.workspacePreferences !== undefined) {
    update.workspacePreferences =
      body.workspacePreferences as PreferencesUpdate["workspacePreferences"];
  }

  const preferences = updatePreferences(req.auth!.memberId, update);

  if (!preferences) {
    res.status(404).json(createFailureResponse("Member preferences not found."));
    return;
  }

  res.json(createSuccessResponse(preferences, "Member preferences updated."));
});

export default preferencesRouter;
