import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { AuthenticationRequiredError } from "../auth/auth.errors.js";
import { PetitionSlotLimitError } from "../initiative-petition-slots/petition-slot.service.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { resolvePetitionMutationActor } from "../petition/petition-mutation-authorization.js";
import {
  createPetitionWorkingDraft,
  deleteInitiativePetitionWorkingDraft,
  getPetitionWorkingDraft,
  listInitiativePetitionWorkingDrafts,
  updatePetitionWorkingDraftContent,
} from "./petition-working-draft.service.js";
import {
  validatePetitionWorkingDraftCreate,
  validatePetitionWorkingDraftUpdate,
} from "./petition-working-draft.validators.js";

/**
 * HU-LC-05C.3 — independent Petition drafts (many per Initiative). Steward-only;
 * every route needs a verified access token. Not yet used by Petition publication.
 */
const petitionWorkingDraftRouter = Router();

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
    message.includes("already exists") ||
    message.includes("not available") ||
    message.includes("please retry")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  if (error instanceof AuthenticationRequiredError) {
    res.status(401).json(createFailureResponse(error.message));
    return;
  }

  if (error instanceof PetitionSlotLimitError) {
    res.status(409).json(createFailureResponse(error.message));
    return;
  }

  const message = error instanceof Error ? error.message : "Petition draft request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function param(req: Request, name: "initiativeId" | "draftId"): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

petitionWorkingDraftRouter.get(
  "/initiative/:initiativeId/drafts",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolvePetitionMutationActor(req);
      const drafts = await listInitiativePetitionWorkingDrafts(
        identity,
        param(req, "initiativeId"),
      );
      res.json(createSuccessResponse(drafts, "Petition drafts loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

petitionWorkingDraftRouter.post(
  "/initiative/:initiativeId/drafts",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolvePetitionMutationActor(req);
      const input = validatePetitionWorkingDraftCreate(req.body);
      const draft = await createPetitionWorkingDraft(identity, param(req, "initiativeId"), input);
      res.status(201).json(createSuccessResponse(draft, "Petition draft created."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

petitionWorkingDraftRouter.get(
  "/initiative/:initiativeId/drafts/:draftId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolvePetitionMutationActor(req);
      const draft = await getPetitionWorkingDraft(
        identity,
        param(req, "initiativeId"),
        param(req, "draftId"),
      );
      res.json(createSuccessResponse(draft, "Petition draft loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

petitionWorkingDraftRouter.patch(
  "/initiative/:initiativeId/drafts/:draftId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolvePetitionMutationActor(req);
      const update = validatePetitionWorkingDraftUpdate(req.body);
      const draft = await updatePetitionWorkingDraftContent(
        identity,
        param(req, "initiativeId"),
        param(req, "draftId"),
        update,
      );
      res.json(createSuccessResponse(draft, "Petition draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

petitionWorkingDraftRouter.delete(
  "/initiative/:initiativeId/drafts/:draftId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolvePetitionMutationActor(req);
      await deleteInitiativePetitionWorkingDraft(
        identity,
        param(req, "initiativeId"),
        param(req, "draftId"),
      );
      res.json(createSuccessResponse(null, "Petition draft deleted."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default petitionWorkingDraftRouter;
