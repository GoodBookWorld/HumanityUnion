import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import {
  computeCivicDeliveryMetrics,
  getPublicCivicDelivery,
  listPublicCivicDeliveriesForCap,
} from "./civic-delivery.projection.js";

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

const publicCivicDeliveryRouter = Router();

publicCivicDeliveryRouter.get("/:deliveryId", (req, res) => {
  const deliveryId = Array.isArray(req.params.deliveryId)
    ? (req.params.deliveryId[0] ?? "")
    : (req.params.deliveryId ?? "");
  const projection = getPublicCivicDelivery(deliveryId);

  if (!projection) {
    res.status(404).json(createFailureResponse("Public delivery record is not available."));
    return;
  }

  const metrics = computeCivicDeliveryMetrics();

  res.json(createSuccessResponse(projection, "Public delivery record loaded.", { metrics }));
});

export const publicCivicDeliveriesByCapRouter = Router();

publicCivicDeliveriesByCapRouter.get("/:capId/deliveries", (req, res) => {
  const capId = Array.isArray(req.params.capId)
    ? (req.params.capId[0] ?? "")
    : (req.params.capId ?? "");
  const capPackage = getCapById(capId);

  if (!capPackage || capPackage.status !== "issued") {
    res.status(404).json(createFailureResponse("Civic Action Package not found."));
    return;
  }

  const deliveries = listPublicCivicDeliveriesForCap(capId);
  const metrics = computeCivicDeliveryMetrics();

  res.json(createSuccessResponse(deliveries, "Public delivery log loaded.", { metrics }));
});

export default publicCivicDeliveryRouter;
