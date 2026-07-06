import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  computeInitiativeCollectiveDecisionMetrics,
  getPublicInitiativeCollectiveDecision,
  listPublicInitiativeCollectiveDecisionsForInitiative,
} from "./public-initiative-collective-decision.projection.js";

const publicInitiativeCollectiveDecisionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicInitiativeCollectiveDecisionRouter.get("/:decisionId", (req, res) => {
  const decisionId = Array.isArray(req.params.decisionId)
    ? (req.params.decisionId[0] ?? "")
    : (req.params.decisionId ?? "");
  const projection = getPublicInitiativeCollectiveDecision(decisionId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public collective decision is not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public collective decision loaded."));
});

export const publicInitiativeCollectiveDecisionsByInitiativeRouter = Router();

publicInitiativeCollectiveDecisionsByInitiativeRouter.get(
  "/:initiativeId/collective-decisions",
  (req, res) => {
    const initiativeId = Array.isArray(req.params.initiativeId)
      ? (req.params.initiativeId[0] ?? "")
      : (req.params.initiativeId ?? "");
    const initiative = getInitiativeById(initiativeId);

    if (!initiative) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    if (!canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }

    const decisions = listPublicInitiativeCollectiveDecisionsForInitiative(initiativeId);
    const metrics = computeInitiativeCollectiveDecisionMetrics(initiativeId);

    res.json(createSuccessResponse(decisions, "Public collective decisions loaded.", { metrics }));
  },
);

export default publicInitiativeCollectiveDecisionRouter;
