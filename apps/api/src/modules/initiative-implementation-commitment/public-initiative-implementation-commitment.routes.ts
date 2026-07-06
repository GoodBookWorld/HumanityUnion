import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { getDecisionById } from "../initiative-collective-decision/initiative-collective-decision.store.js";
import {
  computeInitiativeImplementationCommitmentMetrics,
  getPublicInitiativeImplementationCommitment,
  listPublicInitiativeImplementationCommitmentsForDecision,
  listPublicInitiativeImplementationCommitmentsForInitiative,
} from "./public-initiative-implementation-commitment.projection.js";

const publicInitiativeImplementationCommitmentRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicInitiativeImplementationCommitmentRouter.get("/:commitmentId", (req, res) => {
  const commitmentId = Array.isArray(req.params.commitmentId)
    ? (req.params.commitmentId[0] ?? "")
    : (req.params.commitmentId ?? "");
  const projection = getPublicInitiativeImplementationCommitment(commitmentId);

  if (!projection) {
    res
      .status(404)
      .json(createFailureResponse("Public implementation commitment is not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public implementation commitment loaded."));
});

export const publicInitiativeImplementationCommitmentsByInitiativeRouter = Router();

publicInitiativeImplementationCommitmentsByInitiativeRouter.get(
  "/:initiativeId/implementation-commitments",
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

    const commitments = listPublicInitiativeImplementationCommitmentsForInitiative(initiativeId);
    const metrics = computeInitiativeImplementationCommitmentMetrics(initiativeId);

    res.json(
      createSuccessResponse(commitments, "Public implementation commitments loaded.", { metrics }),
    );
  },
);

export const publicInitiativeImplementationCommitmentsByDecisionRouter = Router();

publicInitiativeImplementationCommitmentsByDecisionRouter.get(
  "/:decisionId/implementation-commitments",
  (req, res) => {
    const decisionId = Array.isArray(req.params.decisionId)
      ? (req.params.decisionId[0] ?? "")
      : (req.params.decisionId ?? "");
    const decision = getDecisionById(decisionId);

    if (!decision || decision.status === "draft") {
      res.status(404).json(createFailureResponse("Collective decision not found."));
      return;
    }

    const commitments = listPublicInitiativeImplementationCommitmentsForDecision(decisionId);

    res.json(createSuccessResponse(commitments, "Public implementation commitments loaded."));
  },
);

export default publicInitiativeImplementationCommitmentRouter;
