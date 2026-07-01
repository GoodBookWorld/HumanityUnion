import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getAnalysisById } from "./collaborative-analysis.store.js";
import { toPublicCollaborativeAnalysisProjection } from "./public-collaborative-analysis.projection.js";

const publicCollaborativeAnalysisRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicCollaborativeAnalysisRouter.get("/:analysisId", (req, res) => {
  const analysis = getAnalysisById(req.params.analysisId);

  if (!analysis) {
    res.status(404).json(createFailureResponse("Collaborative Analysis not found."));
    return;
  }

  res.json(
    createSuccessResponse(
      toPublicCollaborativeAnalysisProjection(analysis),
      "Public collaborative analysis loaded.",
    ),
  );
});

export default publicCollaborativeAnalysisRouter;
