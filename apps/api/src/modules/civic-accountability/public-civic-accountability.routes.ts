import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import { getResponseById } from "../official-response/official-response.store.js";
import {
  computeCivicAccountabilityMetrics,
  getPublicCivicAccountability,
  listPublicCivicAccountabilitiesForCap,
  listPublicCivicAccountabilitiesForInitiative,
  listPublicCivicAccountabilitiesForResponse,
} from "./civic-accountability.projection.js";

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

const publicCivicAccountabilityRouter = Router();

publicCivicAccountabilityRouter.get("/:accountabilityId", (req, res) => {
  const accountabilityId = Array.isArray(req.params.accountabilityId)
    ? (req.params.accountabilityId[0] ?? "")
    : (req.params.accountabilityId ?? "");
  const projection = getPublicCivicAccountability(accountabilityId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Civic accountability is not available."));
    return;
  }

  const metrics = computeCivicAccountabilityMetrics();

  res.json(createSuccessResponse(projection, "Civic accountability loaded.", { metrics }));
});

export const publicCivicAccountabilitiesByCapRouter = Router();

publicCivicAccountabilitiesByCapRouter.get("/:capId/civic-accountability", (req, res) => {
  const capId = Array.isArray(req.params.capId)
    ? (req.params.capId[0] ?? "")
    : (req.params.capId ?? "");
  const capPackage = getCapById(capId);

  if (!capPackage || capPackage.status !== "issued") {
    res.status(404).json(createFailureResponse("Civic Action Package not found."));
    return;
  }

  const records = listPublicCivicAccountabilitiesForCap(capId);
  const metrics = computeCivicAccountabilityMetrics();

  res.json(createSuccessResponse(records, "Civic accountability records loaded.", { metrics }));
});

export const publicCivicAccountabilitiesByInitiativeRouter = Router();

publicCivicAccountabilitiesByInitiativeRouter.get(
  "/:initiativeId/civic-accountability",
  (req, res) => {
    const initiativeId = Array.isArray(req.params.initiativeId)
      ? (req.params.initiativeId[0] ?? "")
      : (req.params.initiativeId ?? "");
    const records = listPublicCivicAccountabilitiesForInitiative(initiativeId);
    const metrics = computeCivicAccountabilityMetrics();

    res.json(createSuccessResponse(records, "Civic accountability records loaded.", { metrics }));
  },
);

export const publicCivicAccountabilitiesByResponseRouter = Router();

publicCivicAccountabilitiesByResponseRouter.get("/:responseId/civic-accountability", (req, res) => {
  const responseId = Array.isArray(req.params.responseId)
    ? (req.params.responseId[0] ?? "")
    : (req.params.responseId ?? "");
  const response = getResponseById(responseId);

  if (!response || response.publicationStatus === "draft") {
    res.status(404).json(createFailureResponse("Official response not found."));
    return;
  }

  const records = listPublicCivicAccountabilitiesForResponse(responseId);
  const metrics = computeCivicAccountabilityMetrics();

  res.json(createSuccessResponse(records, "Civic accountability records loaded.", { metrics }));
});

export default publicCivicAccountabilityRouter;
