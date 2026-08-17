import { Router } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  completeInitiativeDiscussionStage,
  getInitiativeDiscussionCompletion,
} from "./initiative-discussion-lifecycle.service.js";

const initiativeDiscussionLifecycleRouter = Router();

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

function getInitiativeId(req: { params: { initiativeId?: string | string[] } }): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

initiativeDiscussionLifecycleRouter.get(
  "/initiative/:initiativeId/completion",
  authenticationMiddleware,
  async (req, res) => {
    try {
      await resolveRequestIdentity(req);
      const completion = getInitiativeDiscussionCompletion(getInitiativeId(req));
      res.json(createSuccessResponse(completion, "Discussion completion loaded."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Discussion completion request failed.";
      res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
    }
  },
);

/**
 * Explicit Author action — completes Discussion for lifecycle progression.
 * Idempotent. Does not invent a parallel Discussion domain document.
 */
initiativeDiscussionLifecycleRouter.post(
  "/initiative/:initiativeId/complete",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const completion = await completeInitiativeDiscussionStage(identity, getInitiativeId(req));
      res.json(createSuccessResponse(completion, "Discussion stage completed."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Discussion completion request failed.";
      res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
    }
  },
);

export { initiativeDiscussionLifecycleRouter };
