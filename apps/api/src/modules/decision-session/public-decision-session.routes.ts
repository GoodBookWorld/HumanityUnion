import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  computeDecisionSessionMetrics,
  getPublicDecisionSession,
  listPublicDecisionSessionsForInitiative,
} from "./public-decision-session.projection.js";

const publicDecisionSessionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicDecisionSessionRouter.get("/:sessionId", (req, res) => {
  const sessionId = Array.isArray(req.params.sessionId)
    ? (req.params.sessionId[0] ?? "")
    : (req.params.sessionId ?? "");
  const projection = getPublicDecisionSession(sessionId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public decision session is not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public decision session loaded."));
});

export const publicDecisionSessionsByInitiativeRouter = Router();

publicDecisionSessionsByInitiativeRouter.get("/:initiativeId/decision-sessions", (req, res) => {
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

  const sessions = listPublicDecisionSessionsForInitiative(initiativeId);
  const metrics = computeDecisionSessionMetrics(initiativeId);

  res.json(createSuccessResponse(sessions, "Public decision sessions loaded.", { metrics }));
});

export default publicDecisionSessionRouter;
