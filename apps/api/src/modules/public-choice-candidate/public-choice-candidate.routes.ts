import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  createPublicChoiceCandidateForInitiative,
  deletePublicChoiceCandidateForInitiative,
  listPublicChoiceCandidatesForInitiative,
  updatePublicChoiceCandidateForInitiative,
} from "./public-choice-candidate.service.js";

export const publicChoiceCandidateRouter = Router();

/** Fix 06 — Visitor-safe public roster (same service as authenticated list). */
export const publicChoiceCandidatesByInitiativeRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function getParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

async function handleListCandidates(req: Request, res: Response): Promise<void> {
  try {
    const initiativeId = getParam(req.params.initiativeId);
    const initiative = getInitiativeById(initiativeId);
    if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
      res.status(404).json(createFailureResponse("Initiative not found."));
      return;
    }
    const candidates = await listPublicChoiceCandidatesForInitiative(initiativeId);
    res.json(createSuccessResponse({ candidates }, "Candidates loaded."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Candidates request failed.";
    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json(createFailureResponse(message));
  }
}

publicChoiceCandidateRouter.get(
  "/:initiativeId/candidates",
  optionalAuthenticationMiddleware,
  handleListCandidates,
);

publicChoiceCandidatesByInitiativeRouter.get("/:initiativeId/candidates", handleListCandidates);

publicChoiceCandidateRouter.post(
  "/:initiativeId/candidates",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const candidate = await createPublicChoiceCandidateForInitiative(
        identity,
        getParam(req.params.initiativeId),
        {
          name: typeof body.name === "string" ? body.name : "",
          photoUrl: typeof body.photoUrl === "string" ? body.photoUrl : undefined,
          campaignPageUrl:
            typeof body.campaignPageUrl === "string" ? body.campaignPageUrl : undefined,
        },
      );
      res.status(201).json(createSuccessResponse(candidate, "Candidate created."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Create candidate failed.";
      const status = message.includes("not found")
        ? 404
        : message.includes("access") || message.includes("owner")
          ? 403
          : 400;
      res.status(status).json(createFailureResponse(message));
    }
  },
);

publicChoiceCandidateRouter.patch(
  "/:initiativeId/candidates/:candidateId",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const candidate = await updatePublicChoiceCandidateForInitiative(
        identity,
        getParam(req.params.initiativeId),
        getParam(req.params.candidateId),
        {
          name: typeof body.name === "string" ? body.name : undefined,
          photoUrl:
            body.photoUrl === null
              ? null
              : typeof body.photoUrl === "string"
                ? body.photoUrl
                : undefined,
          campaignPageUrl:
            body.campaignPageUrl === null
              ? null
              : typeof body.campaignPageUrl === "string"
                ? body.campaignPageUrl
                : undefined,
        },
      );
      res.json(createSuccessResponse(candidate, "Candidate updated."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update candidate failed.";
      const status = message.includes("not found") ? 404 : 400;
      res.status(status).json(createFailureResponse(message));
    }
  },
);

publicChoiceCandidateRouter.delete(
  "/:initiativeId/candidates/:candidateId",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      await deletePublicChoiceCandidateForInitiative(
        identity,
        getParam(req.params.initiativeId),
        getParam(req.params.candidateId),
      );
      res.json(createSuccessResponse({ deleted: true }, "Candidate deleted."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete candidate failed.";
      const status =
        message.includes("not found")
          ? 404
          : message.includes("already has votes")
            ? 409
            : 400;
      res.status(status).json(createFailureResponse(message));
    }
  },
);
