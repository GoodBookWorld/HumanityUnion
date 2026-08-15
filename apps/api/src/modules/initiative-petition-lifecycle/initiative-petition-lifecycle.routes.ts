import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  generateInitiativePetitionDraft,
  getInitiativePetitionWorkspaceContext,
  publishInitiativePetitionStage,
  saveInitiativePetitionDraft,
} from "./initiative-petition-lifecycle.service.js";
import { validateSaveInitiativePetitionDraftInput } from "./initiative-petition-lifecycle.validators.js";

const initiativePetitionLifecycleRouter = Router();

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
    message.includes("is required") ||
    message.includes("already been published") ||
    message.includes("no longer current")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Initiative petition request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

/** Initiative Lifecycle — Part F, Section 6 (Petition Workspace). Sources + AI Suggestions + Draft Status in one call, mirroring Part E's `/workspace` endpoint. */
initiativePetitionLifecycleRouter.get(
  "/initiative/:initiativeId/workspace",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const context = await getInitiativePetitionWorkspaceContext(identity, getInitiativeId(req));

      res.json(createSuccessResponse(context, "Initiative petition workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Section 3 (Petition Draft Builder) — "Generate": deterministically (re)builds every suggested field from the current Intelligence Snapshot. */
initiativePetitionLifecycleRouter.post(
  "/initiative/:initiativeId/draft/generate",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const draft = await generateInitiativePetitionDraft(identity, getInitiativeId(req));

      res.json(createSuccessResponse(draft, "Petition draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Section 6 — "Save Draft": the Author's own edits to the generated (or blank) draft fields. */
initiativePetitionLifecycleRouter.patch(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativePetitionDraftInput(req.body);
      const draft = saveInitiativePetitionDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(draft, "Petition draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Section 6/9/10 — "Publish": promotes the draft to the canonical Public Petition, opens it for signing, and advances the Lifecycle. */
initiativePetitionLifecycleRouter.post(
  "/initiative/:initiativeId/publish",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const petition = await publishInitiativePetitionStage(identity, getInitiativeId(req));

      res.json(createSuccessResponse(petition, "Petition published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativePetitionLifecycleRouter;
