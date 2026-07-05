import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  archiveInitiativeCollaborativeAnalysis,
  createInitiativeCollaborativeAnalysisDraft,
  getMyInitiativeCollaborativeAnalysis,
  listMyInitiativeCollaborativeAnalyses,
  listMyInitiativeCollaborativeAnalysesForInitiative,
  publishInitiativeCollaborativeAnalysis,
  saveInitiativeCollaborativeAnalysisDraft,
} from "./initiative-collaborative-analysis.service.js";
import {
  validateCreateInitiativeCollaborativeAnalysisDraftInput,
  validateSaveInitiativeCollaborativeAnalysisDraftInput,
} from "./initiative-collaborative-analysis.validators.js";

const initiativeCollaborativeAnalysisRouter = Router();

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
    message.includes("Only draft analyses") ||
    message.includes("already archived") ||
    message.includes("can only be created for published or projected")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Initiative collaborative analysis request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getAnalysisId(req: Request): string {
  const analysisId = req.params.analysisId;
  return Array.isArray(analysisId) ? (analysisId[0] ?? "") : (analysisId ?? "");
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

initiativeCollaborativeAnalysisRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const analyses = listMyInitiativeCollaborativeAnalyses(identity);

  res.json(createSuccessResponse(analyses, "My initiative analyses loaded."));
});

initiativeCollaborativeAnalysisRouter.get(
  "/by-initiative/:initiativeId",
  authenticationMiddleware,
  (req, res) => {
    const identity = resolveRequestIdentity(req);
    const analyses = listMyInitiativeCollaborativeAnalysesForInitiative(
      identity,
      getInitiativeId(req),
    );

    res.json(createSuccessResponse(analyses, "Initiative analyses loaded."));
  },
);

initiativeCollaborativeAnalysisRouter.get("/:analysisId", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const analysis = getMyInitiativeCollaborativeAnalysis(identity, getAnalysisId(req));

    res.json(createSuccessResponse(analysis, "Initiative analysis loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

initiativeCollaborativeAnalysisRouter.post("/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input = validateCreateInitiativeCollaborativeAnalysisDraftInput(req.body);
    const created = createInitiativeCollaborativeAnalysisDraft(identity, input);

    res.status(201).json(createSuccessResponse(created, "Initiative analysis draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

initiativeCollaborativeAnalysisRouter.patch(
  "/:analysisId/draft",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const input = validateSaveInitiativeCollaborativeAnalysisDraftInput(req.body);
      const analysis = saveInitiativeCollaborativeAnalysisDraft(
        identity,
        getAnalysisId(req),
        input,
      );

      res.json(createSuccessResponse(analysis, "Initiative analysis draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborativeAnalysisRouter.post(
  "/:analysisId/publish",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const analysis = publishInitiativeCollaborativeAnalysis(identity, getAnalysisId(req));

      res.json(createSuccessResponse(analysis, "Initiative analysis published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborativeAnalysisRouter.post(
  "/:analysisId/archive",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const analysis = archiveInitiativeCollaborativeAnalysis(identity, getAnalysisId(req));

      res.json(createSuccessResponse(analysis, "Initiative analysis archived."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeCollaborativeAnalysisRouter;
