import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  getPublicInitiativeCollaborativeAnalysis,
  listPublicInitiativeCollaborativeAnalyses,
} from "./public-initiative-collaborative-analysis.projection.js";

const publicInitiativeCollaborativeAnalysisRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicInitiativeCollaborativeAnalysisRouter.get("/:analysisId", (req, res) => {
  const projection = getPublicInitiativeCollaborativeAnalysis(req.params.analysisId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public initiative analysis is not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public initiative analysis loaded."));
});

export const publicInitiativeCollaborativeAnalysesByInitiativeRouter = Router();

publicInitiativeCollaborativeAnalysesByInitiativeRouter.get(
  "/:initiativeId/analyses",
  (req, res) => {
    const initiative = getInitiativeById(req.params.initiativeId);

    if (!initiative) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    if (!canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    const analyses = listPublicInitiativeCollaborativeAnalyses(req.params.initiativeId);

    res.json(createSuccessResponse(analyses, "Public initiative analyses loaded."));
  },
);

export default publicInitiativeCollaborativeAnalysisRouter;
