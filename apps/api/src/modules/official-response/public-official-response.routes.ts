import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  computeOfficialResponseMetrics,
  getPublicOfficialResponse,
  listPublicOfficialResponsesForCap,
  listPublicOfficialResponsesForInitiative,
} from "./official-response.projection.js";

/** Official responses are public only while their parent Initiative is. */
function isPublicInitiativeId(initiativeId: string): boolean {
  const initiative = getInitiativeById(initiativeId);
  return Boolean(initiative && canExposePublicInitiativeProjection(initiative));
}

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

const publicOfficialResponseRouter = Router();

publicOfficialResponseRouter.get("/:responseId", (req, res) => {
  const responseId = Array.isArray(req.params.responseId)
    ? (req.params.responseId[0] ?? "")
    : (req.params.responseId ?? "");
  const projection = getPublicOfficialResponse(responseId);

  if (!projection || !isPublicInitiativeId(projection.initiativeId)) {
    res.status(404).json(createFailureResponse("Official response is not available."));
    return;
  }

  const metrics = computeOfficialResponseMetrics();

  res.json(createSuccessResponse(projection, "Official response loaded.", { metrics }));
});

export const publicOfficialResponsesByCapRouter = Router();

publicOfficialResponsesByCapRouter.get("/:capId/official-responses", (req, res) => {
  const capId = Array.isArray(req.params.capId)
    ? (req.params.capId[0] ?? "")
    : (req.params.capId ?? "");
  const capPackage = getCapById(capId);

  if (!capPackage || capPackage.status !== "issued") {
    res.status(404).json(createFailureResponse("Civic Action Package not found."));
    return;
  }

  const responses = listPublicOfficialResponsesForCap(capId).filter((response) =>
    isPublicInitiativeId(response.initiativeId),
  );
  const metrics = computeOfficialResponseMetrics();

  res.json(createSuccessResponse(responses, "Official response timeline loaded.", { metrics }));
});

export const publicOfficialResponsesByInitiativeRouter = Router();

publicOfficialResponsesByInitiativeRouter.get("/:initiativeId/official-responses", (req, res) => {
  const initiativeId = Array.isArray(req.params.initiativeId)
    ? (req.params.initiativeId[0] ?? "")
    : (req.params.initiativeId ?? "");
  const responses = isPublicInitiativeId(initiativeId)
    ? listPublicOfficialResponsesForInitiative(initiativeId)
    : [];
  const metrics = computeOfficialResponseMetrics();

  res.json(createSuccessResponse(responses, "Official response timeline loaded.", { metrics }));
});

export default publicOfficialResponseRouter;
