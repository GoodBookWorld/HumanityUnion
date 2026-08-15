import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  generateInitiativeOfficialResponseDraft,
  getInitiativeOfficialResponseWorkspaceContext,
  listPublishedInitiativeOfficialResponses,
  listPublishedPackageResponses,
  publishInitiativeOfficialResponseStage,
  saveInitiativeOfficialResponseDraft,
} from "./initiative-official-response-lifecycle.service.js";
import { getPackageById } from "./initiative-official-response-package.store.js";
import { validateSaveInitiativeOfficialResponseLifecycleDraftInput } from "./initiative-official-response-lifecycle.validators.js";

const initiativeOfficialResponseLifecycleRouter = Router();

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
    message.includes("missing")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Official Responses request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

function getPackageId(req: Request): string {
  const packageId = req.params.packageId;
  return Array.isArray(packageId) ? (packageId[0] ?? "") : (packageId ?? "");
}

initiativeOfficialResponseLifecycleRouter.get(
  "/initiative/:initiativeId/workspace",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const context = await getInitiativeOfficialResponseWorkspaceContext(identity, getInitiativeId(req));

      res.json(createSuccessResponse(context, "Official Responses workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeOfficialResponseLifecycleRouter.post(
  "/initiative/:initiativeId/draft/generate",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const draft = await generateInitiativeOfficialResponseDraft(identity, getInitiativeId(req));

      res.json(createSuccessResponse(draft, "Official Responses draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeOfficialResponseLifecycleRouter.patch(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeOfficialResponseLifecycleDraftInput(req.body);
      const draft = saveInitiativeOfficialResponseDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(draft, "Official Responses draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeOfficialResponseLifecycleRouter.post(
  "/initiative/:initiativeId/publish",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const pkg = await publishInitiativeOfficialResponseStage(identity, getInitiativeId(req));

      res.json(createSuccessResponse(pkg, "Official Responses published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeOfficialResponseLifecycleRouter.get(
  "/packages/:packageId",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const pkg = getPackageById(getPackageId(req));

      if (!pkg) {
        res.status(404).json(createFailureResponse("Official Response Package not found."));
        return;
      }

      const responses = listPublishedPackageResponses(pkg.packageId);
      res.json(createSuccessResponse({ package: pkg, responses }, "Official Response Package loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeOfficialResponseLifecycleRouter.get("/initiative/:initiativeId/published", async (req, res) => {
  try {
    const responses = listPublishedInitiativeOfficialResponses(getInitiativeId(req));

    res.json(createSuccessResponse(responses, "Published Official Responses loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default initiativeOfficialResponseLifecycleRouter;
