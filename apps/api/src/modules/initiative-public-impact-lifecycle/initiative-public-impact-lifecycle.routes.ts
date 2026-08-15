import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  generateInitiativePublicImpactDraft,
  getInitiativePublicImpactWorkspaceContext,
  getPublishedInitiativePublicImpactReport,
  getPublishedInitiativePublicImpactReportById,
  publishInitiativePublicImpactStage,
  saveInitiativePublicImpactDraft,
} from "./initiative-public-impact-lifecycle.service.js";
import { validateSaveInitiativePublicImpactLifecycleDraftInput } from "./initiative-public-impact-lifecycle.validators.js";

const initiativePublicImpactLifecycleRouter = Router();

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
    message.includes("missing") ||
    message.includes("must be non-empty") ||
    message.includes("unsupported")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Public Impact request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

function getReportId(req: Request): string {
  const reportId = req.params.reportId;
  return Array.isArray(reportId) ? (reportId[0] ?? "") : (reportId ?? "");
}

initiativePublicImpactLifecycleRouter.get(
  "/initiative/:initiativeId/workspace",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const context = await getInitiativePublicImpactWorkspaceContext(identity, getInitiativeId(req));

      res.json(createSuccessResponse(context, "Public Impact workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativePublicImpactLifecycleRouter.post(
  "/initiative/:initiativeId/draft/generate",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const draft = await generateInitiativePublicImpactDraft(identity, getInitiativeId(req));

      res.json(createSuccessResponse(draft, "Public Impact draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativePublicImpactLifecycleRouter.patch(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativePublicImpactLifecycleDraftInput(req.body);
      const draft = saveInitiativePublicImpactDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(draft, "Public Impact draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativePublicImpactLifecycleRouter.post(
  "/initiative/:initiativeId/publish",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const report = await publishInitiativePublicImpactStage(identity, getInitiativeId(req));

      res.json(createSuccessResponse(report, "Public Impact published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativePublicImpactLifecycleRouter.get(
  "/reports/:reportId",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const report = getPublishedInitiativePublicImpactReportById(getReportId(req));

      if (!report) {
        res.status(404).json(createFailureResponse("Public Impact Report not found."));
        return;
      }

      res.json(createSuccessResponse(report, "Public Impact Report loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativePublicImpactLifecycleRouter.get("/initiative/:initiativeId/published", async (req, res) => {
  try {
    const report = getPublishedInitiativePublicImpactReport(getInitiativeId(req));

    res.json(createSuccessResponse(report, "Published Public Impact Report loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default initiativePublicImpactLifecycleRouter;
