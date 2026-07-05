import { Router, type Request, type Response } from "express";

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
  updateManagedInitiative,
  updatePublishedInitiative,
} from "./initiative.service.js";
import { getInitiativeById, listInitiatives } from "./initiative.store.js";
import {
  canExposePublicInitiativeProjection,
  toPublicInitiativeProjection,
} from "./public-initiative.projection.js";
import {
  validateCreateInitiativeDraftInput,
  validateSaveInitiativeDraftInput,
} from "./initiative.validators.js";

const initiativesRouter = Router();

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
    message.includes("Archived initiatives cannot be updated") ||
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

/** Public read — lists all initiatives (bootstrap operational view). */
initiativesRouter.get("/", (_req, res) => {
  const initiatives = listInitiatives();

  res.json(createSuccessResponse(initiatives, "Initiatives loaded."));
});

/** Identity-scoped read — current participant initiatives only. */
initiativesRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const initiatives = listMyInitiatives(identity);

  res.json(createSuccessResponse(initiatives, "My initiatives loaded."));
});

/** Canonical draft creation route. */
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

/**
 * Legacy create alias — delegates to canonical draft creation with RequestIdentity.
 * Prefer POST /draft for new clients.
 */
initiativesRouter.post("/", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input = validateCreateInitiativeDraftInput(req.body);
    const created = createInitiativeDraft(identity, input);

    res.status(201).json(createSuccessResponse(created, "Initiative draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

/** Public read — single initiative record. */
initiativesRouter.get("/:initiativeId", (req, res) => {
  const initiative = getInitiativeById(getInitiativeId(req));

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

/**
 * Legacy update alias — delegates to lifecycle-aware update with RequestIdentity.
 * Prefer PATCH /:id/draft or PATCH /:id/published for explicit lifecycle intent.
 */
initiativesRouter.patch("/:initiativeId", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input = validateSaveInitiativeDraftInput(req.body);
    const initiative = updateManagedInitiative(identity, getInitiativeId(req), input);

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

/** Public read — member-visible public projection when eligible. */
initiativesRouter.get("/:initiativeId/public-projection", (req, res) => {
  const initiative = getInitiativeById(getInitiativeId(req));

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
