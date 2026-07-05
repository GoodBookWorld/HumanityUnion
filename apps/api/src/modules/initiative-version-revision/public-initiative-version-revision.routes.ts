import { Router } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import { createInitialInitiativeVersionRevision } from "./initiative-version-revision.service.js";
import {
  getPublicInitiativeVersionHistory,
  getPublicInitiativeVersionRevision,
} from "./public-initiative-version-revision.projection.js";

export const publicInitiativeVersionRevisionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

publicInitiativeVersionRevisionRouter.get("/:initiativeId/revisions", (req, res) => {
  const initiative = getInitiativeById(req.params.initiativeId);

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  if (!canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  createInitialInitiativeVersionRevision(initiative, initiative.stewardId);
  const history = getPublicInitiativeVersionHistory(req.params.initiativeId);

  res.json(createSuccessResponse(history, "Public initiative version history loaded."));
});

publicInitiativeVersionRevisionRouter.get("/:initiativeId/revisions/:version", (req, res) => {
  const initiative = getInitiativeById(req.params.initiativeId);

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  if (!canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  const version = Number.parseInt(req.params.version, 10);

  if (!Number.isFinite(version) || version < 1) {
    res.status(400).json(createFailureResponse("Version must be a positive integer."));
    return;
  }

  createInitialInitiativeVersionRevision(initiative, initiative.stewardId);
  const revision = getPublicInitiativeVersionRevision(req.params.initiativeId, version);

  if (!revision) {
    res.status(404).json(createFailureResponse("Initiative version revision not found."));
    return;
  }

  res.json(createSuccessResponse(revision, "Public initiative version revision loaded."));
});

export default publicInitiativeVersionRevisionRouter;
