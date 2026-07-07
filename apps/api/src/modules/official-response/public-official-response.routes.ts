import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import {
  computeOfficialResponseMetrics,
  getPublicOfficialResponse,
  listPublicOfficialResponsesForCap,
  listPublicOfficialResponsesForInitiative,
} from "./official-response.projection.js";

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

  if (!projection) {
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

  const responses = listPublicOfficialResponsesForCap(capId);
  const metrics = computeOfficialResponseMetrics();

  res.json(createSuccessResponse(responses, "Official response timeline loaded.", { metrics }));
});

export const publicOfficialResponsesByInitiativeRouter = Router();

publicOfficialResponsesByInitiativeRouter.get("/:initiativeId/official-responses", (req, res) => {
  const initiativeId = Array.isArray(req.params.initiativeId)
    ? (req.params.initiativeId[0] ?? "")
    : (req.params.initiativeId ?? "");
  const responses = listPublicOfficialResponsesForInitiative(initiativeId);
  const metrics = computeOfficialResponseMetrics();

  res.json(createSuccessResponse(responses, "Official response timeline loaded.", { metrics }));
});

export default publicOfficialResponseRouter;
