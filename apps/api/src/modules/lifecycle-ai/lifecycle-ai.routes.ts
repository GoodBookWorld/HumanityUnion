import { Router, type Response } from "express";

import type { InitiativeLifecycleStageId } from "@hu/types";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";

import {
  resolveLifecycleAiHttpStatus,
  toLifecycleAiPublicMessage,
} from "./lifecycle-ai.errors.js";
import {
  getLifecycleAiAssistantSessionContext,
  requestLifecycleAiAssist,
  type LifecycleAiAssistBody,
} from "./lifecycle-ai.service.js";

const lifecycleAiRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function handleServiceError(res: Response, error: unknown): void {
  // Never forward vendor/raw secret-bearing messages to the browser.
  const message = toLifecycleAiPublicMessage(error);
  res.status(resolveLifecycleAiHttpStatus(error)).json(createFailureResponse(message));
}

lifecycleAiRouter.get("/session-context", authenticationMiddleware, async (req, res) => {
  if (!req.auth?.id) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const identity = await resolveRequestIdentity(req);
    const initiativeId = typeof req.query.initiativeId === "string" ? req.query.initiativeId : "";
    const stageId = typeof req.query.stageId === "string" ? req.query.stageId : "";

    if (!initiativeId || !stageId) {
      res.status(400).json(createFailureResponse("This AI Assistant request could not be completed."));
      return;
    }

    const context = await getLifecycleAiAssistantSessionContext(
      identity,
      initiativeId,
      stageId as InitiativeLifecycleStageId,
    );

    res.json(createSuccessResponse(context, "Lifecycle AI session context ready."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

lifecycleAiRouter.post("/assist", authenticationMiddleware, async (req, res) => {
  if (!req.auth?.id) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const identity = await resolveRequestIdentity(req);
    const body = req.body as LifecycleAiAssistBody;
    const result = await requestLifecycleAiAssist(identity, body);

    res.json(
      createSuccessResponse(result, "Lifecycle AI suggestion ready. Review before editing your draft."),
    );
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default lifecycleAiRouter;
