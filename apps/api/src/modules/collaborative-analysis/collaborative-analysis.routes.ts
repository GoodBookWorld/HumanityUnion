import { Router, type Response } from "express";
import type { CollaborativeAnalysis, Contribution, Signal } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { listPublishedAnalysesByInitiative } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  createAnalysis,
  getAnalysisById,
  getAnalysisByInitiativeId,
  listAnalyses,
  updateAnalysis,
  type CollaborativeAnalysisUpdate,
} from "./collaborative-analysis.store.js";

const collaborativeAnalysisRouter = Router();

export const initiativeCollaborativeAnalysisRouter = Router();

const IMMUTABLE_FIELDS = new Set(["analysisId", "initiativeId", "createdAt"]);

const PATCHABLE_FIELDS = new Set(["status", "progressPolicy"]);

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function handleStoreError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Collaborative Analysis request failed.";
  res.status(400).json(createFailureResponse(message));
}

collaborativeAnalysisRouter.get("/", (_req, res) => {
  const analyses = listAnalyses();

  res.json(createSuccessResponse(analyses, "Collaborative analyses loaded."));
});

collaborativeAnalysisRouter.get("/:analysisId", (req, res) => {
  const analysis = getAnalysisById(req.params.analysisId);

  if (!analysis) {
    res.status(404).json(createFailureResponse("Collaborative Analysis not found."));
    return;
  }

  res.json(createSuccessResponse(analysis, "Collaborative Analysis loaded."));
});

collaborativeAnalysisRouter.post("/", (req, res) => {
  try {
    const analysis = req.body as CollaborativeAnalysis;
    const created = createAnalysis(analysis);

    res.status(201).json(createSuccessResponse(created, "Collaborative Analysis created."));
  } catch (error) {
    handleStoreError(res, error);
  }
});

collaborativeAnalysisRouter.post("/:analysisId/contributions", (req, res) => {
  const contribution = req.body as Contribution;

  try {
    const analysis = updateAnalysis(req.params.analysisId, {
      addContributions: [contribution],
    });

    if (!analysis) {
      res.status(404).json(createFailureResponse("Collaborative Analysis not found."));
      return;
    }

    res.status(201).json(createSuccessResponse(analysis, "Contribution added."));
  } catch (error) {
    handleStoreError(res, error);
  }
});

collaborativeAnalysisRouter.post("/:analysisId/signals", (req, res) => {
  const signal = req.body as Signal;

  try {
    const analysis = updateAnalysis(req.params.analysisId, {
      addSignals: [signal],
    });

    if (!analysis) {
      res.status(404).json(createFailureResponse("Collaborative Analysis not found."));
      return;
    }

    res.status(201).json(createSuccessResponse(analysis, "Signal added."));
  } catch (error) {
    handleStoreError(res, error);
  }
});

collaborativeAnalysisRouter.patch("/:analysisId", (req, res) => {
  const body = req.body as Record<string, unknown>;

  for (const key of Object.keys(body)) {
    if (IMMUTABLE_FIELDS.has(key)) {
      res.status(400).json(createFailureResponse(`Field "${key}" cannot be modified.`));
      return;
    }

    if (
      key === "contributions" ||
      key === "signals" ||
      key === "addContributions" ||
      key === "addSignals"
    ) {
      res.status(400).json(createFailureResponse(`Field "${key}" cannot be modified.`));
      return;
    }

    if (key === "readiness" || key === "metrics") {
      res.status(400).json(createFailureResponse(`Field "${key}" cannot be modified.`));
      return;
    }

    if (!PATCHABLE_FIELDS.has(key)) {
      res.status(400).json(createFailureResponse(`Field "${key}" cannot be modified.`));
      return;
    }
  }

  const update: CollaborativeAnalysisUpdate = {};

  if (body.status !== undefined) {
    update.status = body.status as CollaborativeAnalysisUpdate["status"];
  }

  if (body.progressPolicy !== undefined) {
    update.progressPolicy = body.progressPolicy as CollaborativeAnalysisUpdate["progressPolicy"];
  }

  try {
    const analysis = updateAnalysis(req.params.analysisId, update);

    if (!analysis) {
      res.status(404).json(createFailureResponse("Collaborative Analysis not found."));
      return;
    }

    res.json(createSuccessResponse(analysis, "Collaborative Analysis updated."));
  } catch (error) {
    handleStoreError(res, error);
  }
});

initiativeCollaborativeAnalysisRouter.get("/:initiativeId/analysis", (req, res) => {
  const analysis = getAnalysisByInitiativeId(req.params.initiativeId);

  if (analysis) {
    res.json(createSuccessResponse(analysis, "Collaborative Analysis loaded."));
    return;
  }

  // Legacy store miss — resolve from the canonical Initiative Collaborative
  // Analysis module (published only). This is a COMPATIBILITY_READ_ONLY path,
  // not a second authoritative store write path. Frontend lifecycle
  // progression must not treat this route as lifecycle authority.
  // Intended removal/deprecation: Phase 03–04 (migrate remaining callers to
  // initiative-analyses).
  const publishedCanonical = listPublishedAnalysesByInitiative(req.params.initiativeId)[0] ?? null;

  if (publishedCanonical) {
    res.json(
      createSuccessResponse(
        {
          analysisId: publishedCanonical.analysisId,
          initiativeId: publishedCanonical.initiativeId,
          status: "completed",
          createdAt: publishedCanonical.createdAt,
          updatedAt: publishedCanonical.updatedAt,
          title: publishedCanonical.title,
          summary: publishedCanonical.summary,
          supportingEvidence: publishedCanonical.supportingEvidence,
          risks: publishedCanonical.risks,
          openQuestions: publishedCanonical.openQuestions,
          suggestedImprovements: publishedCanonical.suggestedImprovements,
          references: publishedCanonical.references,
          initiativeVersion: publishedCanonical.initiativeVersion,
          publishedAt: publishedCanonical.publishedAt,
          contributions: [],
          signals: [],
          summaries: [],
        },
        "Collaborative Analysis loaded via legacy compatibility from initiative-analyses.",
      ),
    );
    return;
  }

  res.status(404).json(
    createFailureResponse(
      "Collaborative Analysis was not found. Use the initiative-analyses API.",
    ),
  );
});

export default collaborativeAnalysisRouter;
