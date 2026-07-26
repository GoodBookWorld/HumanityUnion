import { Router } from "express";

import { authenticationMiddleware } from "../../auth/auth.middleware.js";
import { createSuccessResponse } from "../../../shared/http-response.js";
import { getWorkspaceOverviewForMember } from "../application/workspace-query.service.js";
import {
  WorkspaceMemberNotRegisteredError,
  WorkspaceQueryUnavailableError,
} from "../workspace.errors.js";

const workspaceRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

/** Canonical MVP Workspace read endpoint — projection-only, no legacy initiative data. */
workspaceRouter.get("/", authenticationMiddleware, async (req, res) => {
  if (!req.auth?.memberId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const overview = await getWorkspaceOverviewForMember(req.auth.memberId);

    res.json(createSuccessResponse(overview, "Workspace overview loaded."));
  } catch (error) {
    if (error instanceof WorkspaceMemberNotRegisteredError) {
      res.status(403).json(createFailureResponse(error.message));
      return;
    }

    if (error instanceof WorkspaceQueryUnavailableError) {
      res.status(503).json(createFailureResponse(error.message));
      return;
    }

    const message = error instanceof Error ? error.message : "Workspace request failed.";
    res.status(500).json(createFailureResponse(message));
  }
});

export default workspaceRouter;
