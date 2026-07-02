import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getDecision } from "./collective-decision.store.js";
import { toPublicCollectiveDecisionProjection } from "./public-collective-decision.projection.js";

const publicCollectiveDecisionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicCollectiveDecisionRouter.get("/:decisionId", (req, res) => {
  const decisionId = Array.isArray(req.params.decisionId)
    ? req.params.decisionId[0]
    : req.params.decisionId;
  const decision = getDecision(decisionId ?? "");

  if (!decision) {
    res.status(404).json(createFailureResponse("Collective Decision not found."));
    return;
  }

  res.json(
    createSuccessResponse(
      toPublicCollectiveDecisionProjection(decision),
      "Public collective decision loaded.",
    ),
  );
});

export default publicCollectiveDecisionRouter;
