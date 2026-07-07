import { Router, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";

import {
  respondToWorkspaceAssistant,
  type WorkspaceAssistantRouteBody,
} from "./workspace-assistant.service.js";

const workspaceAssistantRouter = Router();

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

  if (message.includes("do not have access") || message.includes("cannot be supplied")) {
    return 403;
  }

  if (
    message.includes("Unknown assistant capability") ||
    message.includes("not allowed") ||
    message.includes("prohibited") ||
    message.includes("blocked by safety guard") ||
    message.includes("must not include")
  ) {
    return 400;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Workspace assistant request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

workspaceAssistantRouter.post("/respond", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const body = req.body as WorkspaceAssistantRouteBody;
    const response = respondToWorkspaceAssistant(identity, body);

    res.json(createSuccessResponse(response, "Workspace assistant response generated."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default workspaceAssistantRouter;
