import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { getMemberById } from "../member/member-access.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import { getWorkspaceIntelligence } from "./workspace-intelligence.service.js";

const workspaceIntelligenceRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveErrorStatus(message: string): number {
  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("do not have access")) {
    return 403;
  }

  return 400;
}

workspaceIntelligenceRouter.get(
  "/intelligence",
  authenticationMiddleware,
  async (req, res: Response) => {
    if (!req.auth?.id) {
      res.status(401).json(createFailureResponse("Authentication required."));
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const member = req.auth.memberId ? await getMemberById(req.auth.memberId) : null;
      const displayName = member?.profile.displayName ?? req.auth.email.split("@")[0] ?? "Member";
      const initiativeId =
        typeof req.query.initiativeId === "string" ? req.query.initiativeId : undefined;
      const currentSection = typeof req.query.section === "string" ? req.query.section : undefined;

      const intelligence = await getWorkspaceIntelligence({
        identity,
        userId: req.auth.id,
        displayName,
        initiativeId,
        currentSection,
      });

      res.json(createSuccessResponse(intelligence, "Workspace intelligence loaded."));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Workspace intelligence request failed.";
      res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
    }
  },
);

export default workspaceIntelligenceRouter;
