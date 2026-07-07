import { Router } from "express";

import { CIVIC_NOTIFICATION_EVENT_REGISTRY, type CivicEntityType } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import { buildIntegrationView } from "./capability02-integration.service.js";

const URL_ENTITY_TYPE_MAP: Record<string, CivicEntityType> = {
  initiative: "initiative",
  analysis: "analysis",
  "improvement-proposal": "improvement_proposal",
  "decision-session": "decision_session",
  "collective-decision": "collective_decision",
  "civic-action-package": "civic_action_package",
  "official-response": "official_response",
  "implementation-commitment": "implementation_commitment",
  "implementation-tracking": "implementation_tracking",
  "public-impact": "public_impact",
  "civic-archive": "civic_archive",
};

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

const capability02IntegrationRouter = Router();

capability02IntegrationRouter.get("/notification-events", (_req, res) => {
  res.json(
    createSuccessResponse(CIVIC_NOTIFICATION_EVENT_REGISTRY, "Notification event registry loaded."),
  );
});

capability02IntegrationRouter.get("/:entityType/:entityId", (req, res) => {
  const entityTypeParam = Array.isArray(req.params.entityType)
    ? (req.params.entityType[0] ?? "")
    : (req.params.entityType ?? "");
  const entityId = Array.isArray(req.params.entityId)
    ? (req.params.entityId[0] ?? "")
    : (req.params.entityId ?? "");
  const entityType = URL_ENTITY_TYPE_MAP[entityTypeParam];

  if (!entityType) {
    res.status(400).json(createFailureResponse("Unsupported civic entity type."));
    return;
  }

  const view = buildIntegrationView(entityType, entityId);

  if (!view) {
    res.status(404).json(createFailureResponse("Civic integration context is not available."));
    return;
  }

  res.json(createSuccessResponse(view, "Civic integration context loaded."));
});

export default capability02IntegrationRouter;
