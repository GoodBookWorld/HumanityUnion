import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { getTrackingById } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import {
  computeInitiativePublicImpactMetrics,
  getPublicInitiativePublicImpact,
  listPublicInitiativePublicImpactsForInitiative,
  listPublicInitiativePublicImpactsForTracking,
} from "./public-initiative-public-impact.projection.js";

const publicInitiativePublicImpactRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicInitiativePublicImpactRouter.get("/:impactId", (req, res) => {
  const impactId = Array.isArray(req.params.impactId)
    ? (req.params.impactId[0] ?? "")
    : (req.params.impactId ?? "");
  const projection = getPublicInitiativePublicImpact(impactId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public impact record is not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public impact record loaded."));
});

export const publicInitiativePublicImpactsByInitiativeRouter = Router();

publicInitiativePublicImpactsByInitiativeRouter.get("/:initiativeId/public-impact", (req, res) => {
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

  const impacts = listPublicInitiativePublicImpactsForInitiative(initiativeId);
  const metrics = computeInitiativePublicImpactMetrics(initiativeId);

  res.json(createSuccessResponse(impacts, "Public impact records loaded.", { metrics }));
});

export const publicInitiativePublicImpactsByTrackingRouter = Router();

publicInitiativePublicImpactsByTrackingRouter.get("/:trackingId/public-impact", (req, res) => {
  const trackingId = Array.isArray(req.params.trackingId)
    ? (req.params.trackingId[0] ?? "")
    : (req.params.trackingId ?? "");
  const tracking = getTrackingById(trackingId);

  if (!tracking || tracking.status === "draft") {
    res.status(404).json(createFailureResponse("Implementation tracking not found."));
    return;
  }

  const impacts = listPublicInitiativePublicImpactsForTracking(trackingId);

  res.json(createSuccessResponse(impacts, "Public impact records loaded."));
});

export default publicInitiativePublicImpactRouter;
