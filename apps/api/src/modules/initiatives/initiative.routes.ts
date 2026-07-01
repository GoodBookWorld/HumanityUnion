import { Router } from "express";
import type { Initiative } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  createInitiative,
  getInitiativeById,
  listInitiatives,
  updateInitiative,
  type InitiativeUpdate,
} from "./initiative.store.js";

const initiativesRouter = Router();

const IMMUTABLE_FIELDS = new Set(["initiativeId", "stewardId", "createdAt"]);

const EDITABLE_FIELDS = new Set([
  "title",
  "description",
  "status",
  "visibility",
  "metadata",
  "revisions",
  "contributions",
  "timeline",
]);

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

initiativesRouter.get("/", (_req, res) => {
  const initiatives = listInitiatives();

  res.json(createSuccessResponse(initiatives, "Initiatives loaded."));
});

initiativesRouter.get("/:initiativeId", (req, res) => {
  const initiative = getInitiativeById(req.params.initiativeId);

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  res.json(createSuccessResponse(initiative, "Initiative loaded."));
});

initiativesRouter.post("/", (req, res) => {
  const initiative = req.body as Initiative;

  const created = createInitiative(initiative);

  res.status(201).json(createSuccessResponse(created, "Initiative created."));
});

initiativesRouter.patch("/:initiativeId", (req, res) => {
  const body = req.body as Record<string, unknown>;

  for (const key of Object.keys(body)) {
    if (IMMUTABLE_FIELDS.has(key)) {
      res.status(400).json(createFailureResponse(`Field "${key}" cannot be modified.`));
      return;
    }

    if (!EDITABLE_FIELDS.has(key)) {
      res.status(400).json(createFailureResponse(`Field "${key}" cannot be modified.`));
      return;
    }
  }

  const update: InitiativeUpdate = {};

  if (body.title !== undefined) {
    update.title = body.title as InitiativeUpdate["title"];
  }

  if (body.description !== undefined) {
    update.description = body.description as InitiativeUpdate["description"];
  }

  if (body.status !== undefined) {
    update.status = body.status as InitiativeUpdate["status"];
  }

  if (body.visibility !== undefined) {
    update.visibility = body.visibility as InitiativeUpdate["visibility"];
  }

  if (body.metadata !== undefined) {
    update.metadata = body.metadata as InitiativeUpdate["metadata"];
  }

  if (body.revisions !== undefined) {
    update.revisions = body.revisions as InitiativeUpdate["revisions"];
  }

  if (body.contributions !== undefined) {
    update.contributions = body.contributions as InitiativeUpdate["contributions"];
  }

  if (body.timeline !== undefined) {
    update.timeline = body.timeline as InitiativeUpdate["timeline"];
  }

  const initiative = updateInitiative(req.params.initiativeId, update);

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  res.json(createSuccessResponse(initiative, "Initiative updated."));
});

export default initiativesRouter;
