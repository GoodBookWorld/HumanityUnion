import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  addAuthorOriginatedRevisionChange,
  applyRevisionChangeToDraft,
  createInitiativeRevisionDraft,
  generateInitiativeRevisionChanges,
  getInitiativeRevisionWorkspaceContext,
  listInitiativeVersionRevisions,
  publishInitiativeRevisionStage,
  removeRevisionChange,
  saveInitiativeRevisionDraft,
  saveRevisionChange,
} from "./initiative-version-revision.service.js";
import {
  validateAddAuthorOriginatedRevisionChangeInput,
  validateSaveInitiativeRevisionChangeInput,
  validateSaveInitiativeRevisionDraftInput,
} from "./initiative-version-revision.validators.js";

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
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
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
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const context = await getInitiativeRevisionWorkspaceContext(identity, getInitiativeId(req));

      res.json(createSuccessResponse(context, "Initiative revision workspace loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeVersionRevisionRouter.post(
  "/initiative/:initiativeId/draft",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
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
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
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
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const result = await publishInitiativeRevisionStage(identity, getInitiativeId(req));

      res.json(createSuccessResponse(result, "Initiative revision published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Part 3/6 — "Generate" (Revision Builder): deterministically enrich the draft's `changes` from eligible, not-yet-referenced Improvement Proposals. */
initiativeVersionRevisionRouter.post(
  "/initiative/:initiativeId/changes/generate",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const draft = await generateInitiativeRevisionChanges(identity, getInitiativeId(req));

      res.json(createSuccessResponse(draft, "Revision changes generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Part 8 — Author-originated change: an improvement not sourced from a Proposal, explicitly marked with a reason. */
initiativeVersionRevisionRouter.post(
  "/initiative/:initiativeId/changes",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateAddAuthorOriginatedRevisionChangeInput(req.body);
      const draft = addAuthorOriginatedRevisionChange(identity, getInitiativeId(req), input);

      res.status(201).json(createSuccessResponse(draft, "Author-originated revision change added."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Part 4/7 — the Author edits a suggested or manual change's text/explanation before applying it. */
initiativeVersionRevisionRouter.patch(
  "/initiative/:initiativeId/changes/:changeId",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeRevisionChangeInput(req.body);
      const changeId = Array.isArray(req.params.changeId) ? req.params.changeId[0] : req.params.changeId;
      const draft = saveRevisionChange(identity, getInitiativeId(req), changeId ?? "", input);

      res.json(createSuccessResponse(draft, "Revision change saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Part 6 — discard a suggested or manual change before publish. */
initiativeVersionRevisionRouter.delete(
  "/initiative/:initiativeId/changes/:changeId",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const changeId = Array.isArray(req.params.changeId) ? req.params.changeId[0] : req.params.changeId;
      const draft = removeRevisionChange(identity, getInitiativeId(req), changeId ?? "");

      res.json(createSuccessResponse(draft, "Revision change removed."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Part 6/7 — copy one reviewed change's `after` text into the draft's real title/description field. */
initiativeVersionRevisionRouter.post(
  "/initiative/:initiativeId/changes/:changeId/apply",
  authenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const changeId = Array.isArray(req.params.changeId) ? req.params.changeId[0] : req.params.changeId;
      const draft = applyRevisionChangeToDraft(identity, getInitiativeId(req), changeId ?? "");

      res.json(createSuccessResponse(draft, "Revision change applied to draft."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeVersionRevisionRouter;
