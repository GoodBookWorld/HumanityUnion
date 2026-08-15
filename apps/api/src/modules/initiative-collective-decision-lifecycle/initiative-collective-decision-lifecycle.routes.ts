import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  generateInitiativeCollectiveDecisionDraft,
  getInitiativeCollectiveDecisionWorkspaceContext,
  publishInitiativeCollectiveDecisionStage,
  saveInitiativeCollectiveDecisionDraft,
} from "./initiative-collective-decision-lifecycle.service.js";
import { validateSaveInitiativeCollectiveDecisionLifecycleDraftInput } from "./initiative-collective-decision-lifecycle.validators.js";

const initiativeCollectiveDecisionLifecycleRouter = Router();

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

  if (
    message.includes("is required") ||
    message.includes("already been published") ||
    message.includes("no longer current") ||
    message.includes("must be")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Initiative Collective Decision request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

initiativeCollectiveDecisionLifecycleRouter.get(
  "/initiative/:initiativeId/workspace",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const context = await getInitiativeCollectiveDecisionWorkspaceContext(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(context, "Initiative Collective Decision workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollectiveDecisionLifecycleRouter.post(
  "/initiative/:initiativeId/draft/generate",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const draft = await generateInitiativeCollectiveDecisionDraft(identity, getInitiativeId(req));

      res.json(createSuccessResponse(draft, "Collective Decision draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollectiveDecisionLifecycleRouter.patch(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeCollectiveDecisionLifecycleDraftInput(req.body);
      const draft = saveInitiativeCollectiveDecisionDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(draft, "Collective Decision draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollectiveDecisionLifecycleRouter.post(
  "/initiative/:initiativeId/publish",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const decision = await publishInitiativeCollectiveDecisionStage(identity, getInitiativeId(req));

      res.json(createSuccessResponse(decision, "Collective Decision published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeCollectiveDecisionLifecycleRouter;
