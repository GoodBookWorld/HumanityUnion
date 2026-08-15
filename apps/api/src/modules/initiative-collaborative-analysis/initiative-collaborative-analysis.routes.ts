import { Router, type Request, type Response } from "express";

import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../shared/initiative-ancestry/index.js";
import {
  archiveInitiativeCollaborativeAnalysis,
  createInitiativeCollaborativeAnalysisDraft,
  generateInitiativeCollaborativeAnalysisDraft,
  getMyInitiativeCollaborativeAnalysis,
  getMyInitiativeCollaborativeAnalysisForInitiative,
  listMyInitiativeCollaborativeAnalyses,
  listMyInitiativeCollaborativeAnalysesForInitiative,
  publishInitiativeCollaborativeAnalysis,
  saveInitiativeCollaborativeAnalysisDraft,
} from "./initiative-collaborative-analysis.service.js";
import {
  validateCreateInitiativeCollaborativeAnalysisDraftInput,
  validateSaveInitiativeCollaborativeAnalysisDraftInput,
} from "./initiative-collaborative-analysis.validators.js";
import { buildInitiativeAnalysisSourceSnapshot } from "./initiative-analysis-source-snapshot.service.js";

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
  if (error instanceof InitiativeNotFoundError) {
    // Matches the pre-existing "Initiative not found." 404 previously
    // produced by the hand-rolled assertEligibleInitiative check.
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  if (error instanceof InitiativeAncestryMissingError || error instanceof InitiativeIdMalformedError) {
    res.status(400).json(createFailureResponse(error.message));
    return;
  }

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

initiativeCollaborativeAnalysisRouter.get(
  "/mine",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    const identity = await resolveRequestIdentity(req);
    const analyses = listMyInitiativeCollaborativeAnalyses(identity);

    res.json(createSuccessResponse(analyses, "My initiative analyses loaded."));
  },
);

initiativeCollaborativeAnalysisRouter.get(
  "/by-initiative/:initiativeId",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    const identity = await resolveRequestIdentity(req);
    const analyses = listMyInitiativeCollaborativeAnalysesForInitiative(
      identity,
      getInitiativeId(req),
    );

    res.json(createSuccessResponse(analyses, "Initiative analyses loaded."));
  },
);

/**
 * Initiative Lifecycle — Part B. "The" Analysis the Lifecycle Stage
 * Workspace should render for this Author (current draft, else most
 * recently published, else `null` — the Workspace's own draft-empty
 * state), distinct from `/by-initiative/:id` (which returns every one of
 * this author's analyses for the pre-existing multi-analysis list view).
 */
initiativeCollaborativeAnalysisRouter.get(
  "/by-initiative/:initiativeId/current",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    const identity = await resolveRequestIdentity(req);
    const analysis = getMyInitiativeCollaborativeAnalysisForInitiative(identity, getInitiativeId(req));

    res.json(createSuccessResponse(analysis, "Current initiative analysis loaded."));
  },
);

/** Initiative Lifecycle — Part B, Section 2/3: the Author-only Source Snapshot (Automatic Source Collection). */
initiativeCollaborativeAnalysisRouter.get(
  "/by-initiative/:initiativeId/source-snapshot",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const snapshot = await buildInitiativeAnalysisSourceSnapshot(getInitiativeId(req));

      res.json(createSuccessResponse(snapshot, "Analysis source snapshot loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Initiative Lifecycle — Part B, Section 4: "Generate Analysis Draft" (deterministic, no external AI provider). */
initiativeCollaborativeAnalysisRouter.post(
  "/by-initiative/:initiativeId/generate",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const analysis = await generateInitiativeCollaborativeAnalysisDraft(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(analysis, "Analysis draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborativeAnalysisRouter.get(
  "/:analysisId",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const analysis = getMyInitiativeCollaborativeAnalysis(identity, getAnalysisId(req));

      res.json(createSuccessResponse(analysis, "Initiative analysis loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborativeAnalysisRouter.post(
  "/draft",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateCreateInitiativeCollaborativeAnalysisDraftInput(req.body);
      const created = await createInitiativeCollaborativeAnalysisDraft(identity, input);

      res.status(201).json(createSuccessResponse(created, "Initiative analysis draft created."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborativeAnalysisRouter.patch(
  "/:analysisId/draft",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
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
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const analysis = await publishInitiativeCollaborativeAnalysis(identity, getAnalysisId(req));

      res.json(createSuccessResponse(analysis, "Initiative analysis published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborativeAnalysisRouter.post(
  "/:analysisId/archive",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const analysis = archiveInitiativeCollaborativeAnalysis(identity, getAnalysisId(req));

      res.json(createSuccessResponse(analysis, "Initiative analysis archived."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeCollaborativeAnalysisRouter;
