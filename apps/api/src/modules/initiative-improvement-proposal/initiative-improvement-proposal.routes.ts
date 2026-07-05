import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  archiveInitiativeImprovementProposal,
  createInitiativeImprovementProposalDraft,
  decideInitiativeImprovementProposal,
  getMyInitiativeImprovementProposal,
  listMyInitiativeImprovementProposals,
  listMyInitiativeImprovementProposalsForAnalysis,
  listMyInitiativeImprovementProposalsForInitiative,
  listSubmittedInitiativeImprovementProposalsForSteward,
  saveInitiativeImprovementProposalDraft,
  submitInitiativeImprovementProposal,
} from "./initiative-improvement-proposal.service.js";
import {
  validateCreateInitiativeImprovementProposalDraftInput,
  validateDecideInitiativeImprovementProposalInput,
  validateSaveInitiativeImprovementProposalDraftInput,
} from "./initiative-improvement-proposal.validators.js";

const initiativeImprovementProposalRouter = Router();

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
    message.includes("Only draft proposals") ||
    message.includes("already archived") ||
    message.includes("Decided proposals cannot be archived") ||
    message.includes("Only submitted proposals") ||
    message.includes("can only be created from published")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Initiative improvement proposal request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getProposalId(req: Request): string {
  const proposalId = req.params.proposalId;
  return Array.isArray(proposalId) ? (proposalId[0] ?? "") : (proposalId ?? "");
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

function getAnalysisId(req: Request): string {
  const analysisId = req.params.analysisId;
  return Array.isArray(analysisId) ? (analysisId[0] ?? "") : (analysisId ?? "");
}

initiativeImprovementProposalRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const proposals = listMyInitiativeImprovementProposals(identity);

  res.json(createSuccessResponse(proposals, "My improvement proposals loaded."));
});

initiativeImprovementProposalRouter.get(
  "/by-initiative/:initiativeId",
  authenticationMiddleware,
  (req, res) => {
    const identity = resolveRequestIdentity(req);
    const proposals = listMyInitiativeImprovementProposalsForInitiative(
      identity,
      getInitiativeId(req),
    );

    res.json(createSuccessResponse(proposals, "Initiative improvement proposals loaded."));
  },
);

initiativeImprovementProposalRouter.get(
  "/by-analysis/:analysisId",
  authenticationMiddleware,
  (req, res) => {
    const identity = resolveRequestIdentity(req);
    const proposals = listMyInitiativeImprovementProposalsForAnalysis(identity, getAnalysisId(req));

    res.json(createSuccessResponse(proposals, "Analysis improvement proposals loaded."));
  },
);

initiativeImprovementProposalRouter.get(
  "/steward/:initiativeId/submitted",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const proposals = listSubmittedInitiativeImprovementProposalsForSteward(
        identity,
        getInitiativeId(req),
      );

      res.json(createSuccessResponse(proposals, "Submitted improvement proposals loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalRouter.get("/:proposalId", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const proposal = getMyInitiativeImprovementProposal(identity, getProposalId(req));

    res.json(createSuccessResponse(proposal, "Improvement proposal loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

initiativeImprovementProposalRouter.post("/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input = validateCreateInitiativeImprovementProposalDraftInput(req.body);
    const created = createInitiativeImprovementProposalDraft(identity, input);

    res.status(201).json(createSuccessResponse(created, "Improvement proposal draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

initiativeImprovementProposalRouter.patch(
  "/:proposalId/draft",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const input = validateSaveInitiativeImprovementProposalDraftInput(req.body);
      const proposal = saveInitiativeImprovementProposalDraft(identity, getProposalId(req), input);

      res.json(createSuccessResponse(proposal, "Improvement proposal draft saved."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalRouter.post(
  "/:proposalId/submit",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const proposal = submitInitiativeImprovementProposal(identity, getProposalId(req));

      res.json(createSuccessResponse(proposal, "Improvement proposal submitted."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalRouter.post(
  "/:proposalId/archive",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const proposal = archiveInitiativeImprovementProposal(identity, getProposalId(req));

      res.json(createSuccessResponse(proposal, "Improvement proposal archived."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeImprovementProposalRouter.post(
  "/:proposalId/decide",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const input = validateDecideInitiativeImprovementProposalInput(req.body);
      const proposal = decideInitiativeImprovementProposal(identity, getProposalId(req), input);

      res.json(createSuccessResponse(proposal, "Improvement proposal decision recorded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeImprovementProposalRouter;
