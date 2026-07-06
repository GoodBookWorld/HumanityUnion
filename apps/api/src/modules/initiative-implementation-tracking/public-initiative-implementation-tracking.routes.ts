import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { getCommitmentById } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import {
  computeInitiativeImplementationTrackingMetrics,
  getPublicInitiativeImplementationTracking,
  listPublicInitiativeImplementationTrackingsForCommitment,
  listPublicInitiativeImplementationTrackingsForInitiative,
} from "./public-initiative-implementation-tracking.projection.js";

const publicInitiativeImplementationTrackingRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicInitiativeImplementationTrackingRouter.get("/:trackingId", (req, res) => {
  const trackingId = Array.isArray(req.params.trackingId)
    ? (req.params.trackingId[0] ?? "")
    : (req.params.trackingId ?? "");
  const projection = getPublicInitiativeImplementationTracking(trackingId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public implementation tracking is not available."));
    return;
  }

  res.json(createSuccessResponse(projection, "Public implementation tracking loaded."));
});

export const publicInitiativeImplementationTrackingsByInitiativeRouter = Router();

publicInitiativeImplementationTrackingsByInitiativeRouter.get(
  "/:initiativeId/implementation-tracking",
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

    const trackings = listPublicInitiativeImplementationTrackingsForInitiative(initiativeId);
    const metrics = computeInitiativeImplementationTrackingMetrics(initiativeId);

    res.json(
      createSuccessResponse(trackings, "Public implementation tracking loaded.", { metrics }),
    );
  },
);

export const publicInitiativeImplementationTrackingsByCommitmentRouter = Router();

publicInitiativeImplementationTrackingsByCommitmentRouter.get(
  "/:commitmentId/implementation-tracking",
  (req, res) => {
    const commitmentId = Array.isArray(req.params.commitmentId)
      ? (req.params.commitmentId[0] ?? "")
      : (req.params.commitmentId ?? "");
    const commitment = getCommitmentById(commitmentId);

    if (!commitment || commitment.status === "draft") {
      res.status(404).json(createFailureResponse("Implementation commitment not found."));
      return;
    }

    const trackings = listPublicInitiativeImplementationTrackingsForCommitment(commitmentId);

    res.json(createSuccessResponse(trackings, "Public implementation tracking loaded."));
  },
);

export default publicInitiativeImplementationTrackingRouter;
