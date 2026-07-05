import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { getAnalysisById } from "../initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  computeInitiativeImprovementProposalMetrics,
  getPublicInitiativeImprovementProposal,
  listPublicInitiativeImprovementProposals,
  listPublicInitiativeImprovementProposalsForAnalysis,
} from "./public-initiative-improvement-proposal.projection.js";

const publicInitiativeImprovementProposalRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicInitiativeImprovementProposalRouter.get("/:proposalId", (req, res) => {
  const projection = getPublicInitiativeImprovementProposal(req.params.proposalId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public improvement proposal is not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public improvement proposal loaded."));
});

export const publicInitiativeImprovementProposalsByInitiativeRouter = Router();

publicInitiativeImprovementProposalsByInitiativeRouter.get(
  "/:initiativeId/improvement-proposals",
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

    const proposals = listPublicInitiativeImprovementProposals(req.params.initiativeId);
    const metrics = computeInitiativeImprovementProposalMetrics(req.params.initiativeId);

    res.json(createSuccessResponse(proposals, "Public improvement proposals loaded.", { metrics }));
  },
);

export const publicInitiativeImprovementProposalsByAnalysisRouter = Router();

publicInitiativeImprovementProposalsByAnalysisRouter.get(
  "/:analysisId/improvement-proposals",
  (req, res) => {
    const analysis = getAnalysisById(req.params.analysisId);

    if (!analysis || analysis.status !== "published") {
      res.status(404).json(createFailureResponse("Public analysis is not available."));
      return;
    }

    const proposals = listPublicInitiativeImprovementProposalsForAnalysis(req.params.analysisId);

    res.json(createSuccessResponse(proposals, "Public analysis improvement proposals loaded."));
  },
);

export default publicInitiativeImprovementProposalRouter;
