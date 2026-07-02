import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getDecisionBySubjectId } from "./collective-decision.store.js";

export const initiativeCollectiveDecisionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    message,
    data: null,
  };
}

function resolveInitiativeId(value: string | string[]): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0) {
    return value[0];
  }

  return null;
}

initiativeCollectiveDecisionRouter.get("/:initiativeId/decision", (req, res) => {
  const initiativeId = resolveInitiativeId(req.params.initiativeId);

  if (!initiativeId) {
    res.status(400).json(createFailureResponse("Initiative ID is required."));
    return;
  }

  const decision = getDecisionBySubjectId("Initiative", initiativeId);

  if (!decision) {
    res.status(404).json(createFailureResponse("Collective Decision not found."));
    return;
  }

  res.json(createSuccessResponse(decision, "Collective Decision loaded."));
});
