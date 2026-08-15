import { Router, type Response } from "express";

import type { HumanityUnionAssistantSurfaceId, InitiativeLifecycleStageId } from "@hu/types";
import { isHumanityUnionAssistantSurfaceId } from "@hu/types";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";

import {
  resolveLifecycleAiHttpStatus,
  toLifecycleAiPublicMessage,
} from "./lifecycle-ai.errors.js";
import { assistantAssistRateLimiter } from "./assistant-rate-limit.js";
import {
  getHumanityUnionAssistantSessionContext,
  requestHumanityUnionAssistantAssist,
  type PlatformAssistantAssistBody,
} from "./platform-assistant.service.js";

/**
 * Canonical Humanity Union Assistant HTTP surface (Pack 02).
 * Mounted at `/api/v1/assistant`. Uses the same LifecycleAiProvider seam.
 */
const assistantRouter = Router();

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
  const message = toLifecycleAiPublicMessage(error);
  res.status(resolveLifecycleAiHttpStatus(error)).json(createFailureResponse(message));
}

assistantRouter.get("/session-context", authenticationMiddleware, async (req, res) => {
  if (!req.auth?.id) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const identity = await resolveRequestIdentity(req);
    const surfaceRaw = typeof req.query.surfaceId === "string" ? req.query.surfaceId : "";
    const initiativeId =
      typeof req.query.initiativeId === "string" ? req.query.initiativeId : undefined;
    const stageId =
      typeof req.query.stageId === "string"
        ? (req.query.stageId as InitiativeLifecycleStageId)
        : undefined;
    const pagePath = typeof req.query.pagePath === "string" ? req.query.pagePath : undefined;

    if (!isHumanityUnionAssistantSurfaceId(surfaceRaw)) {
      res.status(400).json(createFailureResponse("This Assistant request could not be completed."));
      return;
    }

    const context = await getHumanityUnionAssistantSessionContext(identity, {
      surfaceId: surfaceRaw,
      initiativeId,
      stageId,
      pagePath,
    });

    res.json(createSuccessResponse(context, "Humanity Union Assistant ready."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

assistantRouter.post(
  "/assist",
  authenticationMiddleware,
  assistantAssistRateLimiter,
  async (req, res) => {
  if (!req.auth?.id) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  try {
    const identity = await resolveRequestIdentity(req);
    const body = req.body as PlatformAssistantAssistBody;

    if (!isHumanityUnionAssistantSurfaceId(body.surfaceId)) {
      res.status(400).json(createFailureResponse("This Assistant request could not be completed."));
      return;
    }

    const result = await requestHumanityUnionAssistantAssist(identity, {
      ...body,
      surfaceId: body.surfaceId as HumanityUnionAssistantSurfaceId,
    });

    res.json(
      createSuccessResponse(
        result,
        result.outOfScope
          ? "Assistant stayed within Humanity Union scope."
          : "Humanity Union Assistant suggestion ready. Review before editing your draft.",
      ),
    );
  } catch (error) {
    handleServiceError(res, error);
  }
},
);

export default assistantRouter;
