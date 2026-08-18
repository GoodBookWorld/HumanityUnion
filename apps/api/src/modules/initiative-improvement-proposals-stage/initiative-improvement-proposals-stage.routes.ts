import { Router, type Request, type Response } from "express";

import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  addManualInitiativeStructuredProposal,
  archiveImprovementProposalsCollection,
  completeImprovementProposalsWithVersionCommit,
  ensureEmptyImprovementProposalsDraft,
  generateImprovementProposalsDraft,
  getMyImprovementProposalsCollection,
  getMyImprovementProposalsCollectionForInitiative,
  publishImprovementProposalsCollection,
  saveInitiativeStructuredProposal,
  setInitiativeStructuredProposalStatus,
} from "./initiative-improvement-proposals-stage.service.js";
import {
  validateCreateManualInitiativeStructuredProposalInput,
  validateProposalStatusInput,
  validateSaveInitiativeStructuredProposalInput,
} from "./initiative-improvement-proposals-stage.validators.js";
import { buildInitiativeProposalIntelligenceSnapshot } from "./initiative-proposal-intelligence.service.js";

const initiativeImprovementProposalsStageRouter = Router();

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
    message.includes("Only a draft") ||
    message.includes("already archived") ||
    message.includes("must be marked") ||
    message.includes("is required to publish") ||
    message.includes("Once published") ||
    message.includes("archived and its proposals") ||
    message.includes("already published") ||
    message.includes("Accept / Partial") ||
    message.includes("Initial version must be published")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Improvement Proposals stage request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

initiativeImprovementProposalsStageRouter.get(
  "/by-initiative/:initiativeId/current",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const collection = await getMyImprovementProposalsCollectionForInitiative(
        identity,
        param(req, "initiativeId"),
      );

      res.json(createSuccessResponse(collection, "Current Improvement Proposals collection loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Part 2/3 — the Author-only Proposal Intelligence Snapshot (Automatic Proposal Collection + Proposal Intelligence). */
initiativeImprovementProposalsStageRouter.get(
  "/by-initiative/:initiativeId/intelligence-snapshot",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const snapshot = await buildInitiativeProposalIntelligenceSnapshot(param(req, "initiativeId"));

      res.json(createSuccessResponse(snapshot, "Proposal intelligence snapshot loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Part 2/4: deterministic, non-AI enrichment of the Author's current draft with any newly detected proposal groups. */
initiativeImprovementProposalsStageRouter.post(
  "/by-initiative/:initiativeId/generate",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const collection = await generateImprovementProposalsDraft(identity, param(req, "initiativeId"));

      res.json(createSuccessResponse(collection, "Improvement Proposals draft generated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Zero-proposal path — open an empty draft so Author can commit Initiative version. */
initiativeImprovementProposalsStageRouter.post(
  "/by-initiative/:initiativeId/ensure-empty-draft",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const collection = await ensureEmptyImprovementProposalsDraft(identity, param(req, "initiativeId"));

      res.json(createSuccessResponse(collection, "Improvement Proposals draft ready."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/**
 * Final Author completion: commit InitiativeVersionRevision progress version,
 * publish the proposal collection, unlock Petition.
 */
initiativeImprovementProposalsStageRouter.post(
  "/by-initiative/:initiativeId/complete-with-version",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const result = await completeImprovementProposalsWithVersionCommit(
        identity,
        param(req, "initiativeId"),
      );

      res.json(
        createSuccessResponse(result, "Improvement Proposals completed and Initiative version committed."),
      );
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalsStageRouter.get(
  "/:collectionId",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const collection = await getMyImprovementProposalsCollection(identity, param(req, "collectionId"));

      res.json(createSuccessResponse(collection, "Improvement Proposals collection loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalsStageRouter.post(
  "/:collectionId/proposals",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateCreateManualInitiativeStructuredProposalInput(req.body);
      const collection = await addManualInitiativeStructuredProposal(
        identity,
        param(req, "collectionId"),
        input,
      );

      res.status(201).json(createSuccessResponse(collection, "Proposal added."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalsStageRouter.patch(
  "/:collectionId/proposals/:proposalId",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateSaveInitiativeStructuredProposalInput(req.body);
      const collection = await saveInitiativeStructuredProposal(
        identity,
        param(req, "collectionId"),
        param(req, "proposalId"),
        input,
      );

      res.json(createSuccessResponse(collection, "Proposal saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalsStageRouter.patch(
  "/:collectionId/proposals/:proposalId/status",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const status = validateProposalStatusInput(req.body);
      const collection = await setInitiativeStructuredProposalStatus(
        identity,
        param(req, "collectionId"),
        param(req, "proposalId"),
        status,
      );

      res.json(createSuccessResponse(collection, "Proposal status updated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalsStageRouter.post(
  "/:collectionId/publish",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const collection = await publishImprovementProposalsCollection(identity, param(req, "collectionId"));

      res.json(createSuccessResponse(collection, "Improvement Proposals published."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalsStageRouter.post(
  "/:collectionId/archive",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const collection = await archiveImprovementProposalsCollection(identity, param(req, "collectionId"));

      res.json(createSuccessResponse(collection, "Improvement Proposals collection archived."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeImprovementProposalsStageRouter;
