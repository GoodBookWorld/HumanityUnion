import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  createInitiativeRevisionDraft,
  getInitiativeRevisionWorkspaceContext,
  listInitiativeVersionRevisions,
  publishInitiativeRevision,
  saveInitiativeRevisionDraft,
} from "./initiative-version-revision.service.js";
import { validateSaveInitiativeRevisionDraftInput } from "./initiative-version-revision.validators.js";

const initiativeVersionRevisionRouter = Router();

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
    message.includes("must be published before") ||
    message.includes("not eligible") ||
    message.includes("can only be created for published or projected")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Initiative version revision request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

initiativeVersionRevisionRouter.get(
  "/initiative/:initiativeId",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const revisions = listInitiativeVersionRevisions(identity, getInitiativeId(req));

      res.json(createSuccessResponse(revisions, "Initiative version revisions loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeVersionRevisionRouter.get(
  "/initiative/:initiativeId/workspace",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const context = getInitiativeRevisionWorkspaceContext(identity, getInitiativeId(req));

      res.json(createSuccessResponse(context, "Initiative revision workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeVersionRevisionRouter.post(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const draft = createInitiativeRevisionDraft(identity, getInitiativeId(req));

      res.status(201).json(createSuccessResponse(draft, "Initiative revision draft created."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeVersionRevisionRouter.patch(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const input = validateSaveInitiativeRevisionDraftInput(req.body);
      const draft = saveInitiativeRevisionDraft(identity, getInitiativeId(req), input);

      res.json(createSuccessResponse(draft, "Initiative revision draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeVersionRevisionRouter.post(
  "/initiative/:initiativeId/publish",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const result = publishInitiativeRevision(identity, getInitiativeId(req));

      res.json(createSuccessResponse(result, "Initiative revision published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeVersionRevisionRouter;
