import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  generateInitiativeImplementationTrackingDraft,
  getInitiativeImplementationTrackingWorkspaceContext,
  listMyActiveInitiativeImplementationTrackings,
  publishInitiativeImplementationTrackingStage,
  saveInitiativeImplementationTrackingDraft,
  updateInitiativeImplementationTrackingProgress,
} from "./initiative-implementation-tracking-lifecycle.service.js";
import { validateSaveInitiativeImplementationTrackingLifecycleDraftInput } from "./initiative-implementation-tracking-lifecycle.validators.js";

const initiativeImplementationTrackingLifecycleRouter = Router();

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
    message.includes("cannot be updated") ||
    message.includes("must be a number") ||
    message.includes("At least one Evidence Reference")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Initiative Implementation Tracking request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

function getTrackingId(req: Request): string {
  const trackingId = req.params.trackingId;
  return Array.isArray(trackingId) ? (trackingId[0] ?? "") : (trackingId ?? "");
}

initiativeImplementationTrackingLifecycleRouter.get(
  "/initiative/:initiativeId/workspace",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const context = await getInitiativeImplementationTrackingWorkspaceContext(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(context, "Implementation Tracking workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationTrackingLifecycleRouter.post(
  "/initiative/:initiativeId/draft/generate",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const draft = await generateInitiativeImplementationTrackingDraft(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(draft, "Implementation Tracking draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationTrackingLifecycleRouter.patch(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeImplementationTrackingLifecycleDraftInput(req.body);
      const draft = saveInitiativeImplementationTrackingDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(draft, "Implementation Tracking draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationTrackingLifecycleRouter.post(
  "/initiative/:initiativeId/publish",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const pkg = await publishInitiativeImplementationTrackingStage(identity, getInitiativeId(req));

      res.json(createSuccessResponse(pkg, "Implementation Tracking published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationTrackingLifecycleRouter.patch(
  "/trackings/:trackingId/progress",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const tracking = await updateInitiativeImplementationTrackingProgress(
        identity,
        getTrackingId(req),
        req.body ?? {},
      );

      res.json(createSuccessResponse(tracking, "Implementation Tracking progress updated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImplementationTrackingLifecycleRouter.get("/mine", authenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const trackings = listMyActiveInitiativeImplementationTrackings(identity);

    res.json(createSuccessResponse(trackings, "My active implementation trackings loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default initiativeImplementationTrackingLifecycleRouter;
