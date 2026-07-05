import { Router, type Request, type Response } from "express";
import type { Initiative } from "@hu/types";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "./identity/resolve-request-identity.js";
import {
  archiveInitiative,
  createInitiativeDraft,
  listMyInitiatives,
  publishInitiative,
  republishInitiative,
  saveInitiativeDraft,
  updatePublishedInitiative,
} from "./initiative.service.js";
import {
  createInitiative,
  getInitiativeById,
  listInitiatives,
  updateInitiative,
  type InitiativeUpdate,
} from "./initiative.store.js";
import {
  canExposePublicInitiativeProjection,
  toPublicInitiativeProjection,
} from "./public-initiative.projection.js";
import {
  validateCreateInitiativeDraftInput,
  validateSaveInitiativeDraftInput,
} from "./initiative.validators.js";

const initiativesRouter = Router();

const IMMUTABLE_FIELDS = new Set(["initiativeId", "stewardId", "createdAt"]);

const EDITABLE_FIELDS = new Set([
  "title",
  "description",
  "status",
  "lifecyclePhase",
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

function resolveErrorStatus(message: string): number {
  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("do not have access")) {
    return 403;
  }

  if (
    message.includes("Only draft initiatives") ||
    message.includes("Only published or projected") ||
    message.includes("already archived") ||
    message.includes("not allowed")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Initiative request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

initiativesRouter.get("/", (_req, res) => {
  const initiatives = listInitiatives();

  res.json(createSuccessResponse(initiatives, "Initiatives loaded."));
});

initiativesRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const initiatives = listMyInitiatives(identity);

  res.json(createSuccessResponse(initiatives, "My initiatives loaded."));
});

initiativesRouter.post("/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input = validateCreateInitiativeDraftInput(req.body);
    const created = createInitiativeDraft(identity, input);

    res.status(201).json(createSuccessResponse(created, "Initiative draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

initiativesRouter.post("/", (req, res) => {
  const initiative = req.body as Initiative;

  const created = createInitiative(initiative);

  res.status(201).json(createSuccessResponse(created, "Initiative created."));
});

initiativesRouter.get("/:initiativeId", (req, res) => {
  const initiative = getInitiativeById(req.params.initiativeId);

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  res.json(createSuccessResponse(initiative, "Initiative loaded."));
});

initiativesRouter.patch("/:initiativeId/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input = validateSaveInitiativeDraftInput(req.body);
    const initiative = saveInitiativeDraft(identity, getInitiativeId(req), input);

    res.json(createSuccessResponse(initiative, "Initiative draft saved."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

initiativesRouter.patch("/:initiativeId/published", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input = validateSaveInitiativeDraftInput(req.body);
    const initiative = updatePublishedInitiative(identity, getInitiativeId(req), input);

    res.json(createSuccessResponse(initiative, "Initiative updated."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

initiativesRouter.post("/:initiativeId/publish", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const initiative = publishInitiative(identity, getInitiativeId(req));

    res.json(createSuccessResponse(initiative, "Initiative published and projected."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

initiativesRouter.post("/:initiativeId/republish", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input =
      req.body && typeof req.body === "object" && Object.keys(req.body).length > 0
        ? validateSaveInitiativeDraftInput(req.body)
        : {};
    const initiative = republishInitiative(identity, getInitiativeId(req), input);

    res.json(createSuccessResponse(initiative, "Initiative republished."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

initiativesRouter.post("/:initiativeId/archive", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const initiative = archiveInitiative(identity, getInitiativeId(req));

    res.json(createSuccessResponse(initiative, "Initiative archived."));
  } catch (error) {
    handleServiceError(res, error);
  }
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

  if (body.lifecyclePhase !== undefined) {
    update.lifecyclePhase = body.lifecyclePhase as InitiativeUpdate["lifecyclePhase"];
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

initiativesRouter.get("/:initiativeId/public-projection", (req, res) => {
  const initiative = getInitiativeById(req.params.initiativeId);

  if (!initiative) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return;
  }

  if (!canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Public initiative projection is not available."));
    return;
  }

  res.json(
    createSuccessResponse(
      toPublicInitiativeProjection(initiative),
      "Initiative public projection loaded.",
    ),
  );
});

export default initiativesRouter;
