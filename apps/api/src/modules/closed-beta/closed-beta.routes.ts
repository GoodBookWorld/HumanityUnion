import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import { getMemberById } from "../member/member-access.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  buildPlatformReadinessChecklist,
  resolveBetaOnboardingForUser,
  resolvePlatformConfigPublic,
  resolveWorkspaceReadinessForUser,
} from "./closed-beta.service.js";

const closedBetaRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

closedBetaRouter.get("/config", (_req, res) => {
  res.json(createSuccessResponse(resolvePlatformConfigPublic(), "Platform configuration loaded."));
});

closedBetaRouter.get("/readiness/platform", async (_req, res: Response) => {
  try {
    const checklist = await buildPlatformReadinessChecklist();
    res.json(createSuccessResponse({ checklist }, "Platform readiness checklist loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Platform readiness request failed.";
    res.status(500).json(createFailureResponse(message));
  }
});

closedBetaRouter.get(
  "/onboarding",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const member = req.auth!.memberId ? await getMemberById(req.auth!.memberId) : null;
      const displayName = member?.profile.displayName ?? req.auth!.email.split("@")[0] ?? "Member";

      const items = await resolveBetaOnboardingForUser({
        userId: req.auth!.id,
        identity,
        displayName,
      });

      res.json(createSuccessResponse({ items }, "Beta onboarding checklist loaded."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Onboarding request failed.";
      res.status(500).json(createFailureResponse(message));
    }
  },
);

closedBetaRouter.get(
  "/readiness/workspace",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const member = req.auth!.memberId ? await getMemberById(req.auth!.memberId) : null;
      const displayName = member?.profile.displayName ?? req.auth!.email.split("@")[0] ?? "Member";

      const readiness = await resolveWorkspaceReadinessForUser({
        userId: req.auth!.id,
        identity,
        displayName,
      });

      res.json(createSuccessResponse(readiness, "Workspace readiness loaded."));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Workspace readiness request failed.";
      res.status(500).json(createFailureResponse(message));
    }
  },
);

export default closedBetaRouter;
