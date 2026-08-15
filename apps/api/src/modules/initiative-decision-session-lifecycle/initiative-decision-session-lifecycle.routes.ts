import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  generateInitiativeDecisionSessionDraft,
  getInitiativeDecisionSessionWorkspaceContext,
  listInitiativeDecisionSessionRecommendations,
  publishInitiativeDecisionSessionStage,
  saveInitiativeDecisionSessionDraft,
  submitInitiativeDecisionSessionRecommendation,
} from "./initiative-decision-session-lifecycle.service.js";
import {
  validateSaveInitiativeDecisionSessionDraftInput,
  validateSubmitDecisionSessionRecommendationInput,
} from "./initiative-decision-session-lifecycle.validators.js";

const initiativeDecisionSessionLifecycleRouter = Router();

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

  if (message.includes("do not have access") || message.includes("Only Active Allies")) {
    return 403;
  }

  if (
    message.includes("is required") ||
    message.includes("already been published") ||
    message.includes("no longer current") ||
    message.includes("cannot be submitted")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Initiative Decision Session request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

initiativeDecisionSessionLifecycleRouter.get(
  "/initiative/:initiativeId/workspace",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const context = await getInitiativeDecisionSessionWorkspaceContext(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(context, "Initiative Decision Session workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeDecisionSessionLifecycleRouter.post(
  "/initiative/:initiativeId/draft/generate",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const draft = await generateInitiativeDecisionSessionDraft(identity, getInitiativeId(req));

      res.json(createSuccessResponse(draft, "Decision Session draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeDecisionSessionLifecycleRouter.patch(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeDecisionSessionDraftInput(req.body);
      const draft = saveInitiativeDecisionSessionDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(draft, "Decision Session draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeDecisionSessionLifecycleRouter.post(
  "/initiative/:initiativeId/publish",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const session = await publishInitiativeDecisionSessionStage(identity, getInitiativeId(req));

      res.json(createSuccessResponse(session, "Decision Session published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeDecisionSessionLifecycleRouter.get(
  "/initiative/:initiativeId/recommendations",
  authenticationMiddleware,
  async (req, res) => {
    try {
      await resolveRequestIdentity(req);
      const recommendations = listInitiativeDecisionSessionRecommendations(getInitiativeId(req));

      res.json(createSuccessResponse(recommendations, "Decision Session recommendations loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeDecisionSessionLifecycleRouter.post(
  "/initiative/:initiativeId/recommendations",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSubmitDecisionSessionRecommendationInput(req.body);
      const recommendation = await submitInitiativeDecisionSessionRecommendation(
        identity,
        getInitiativeId(req),
        input,
      );

      res.json(createSuccessResponse(recommendation, "Decision Session recommendation submitted."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeDecisionSessionLifecycleRouter;
