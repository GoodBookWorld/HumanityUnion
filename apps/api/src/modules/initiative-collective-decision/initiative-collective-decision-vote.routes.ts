import { Router, type Request, type Response } from "express";

import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../shared/initiative-ancestry/index.js";
import {
  castOrUpdateInitiativeDecisionVote,
  getMyInitiativeDecisionVote,
} from "../initiative-decision-vote/initiative-decision-vote.service.js";
import { validateCastInitiativeDecisionVoteInput } from "../initiative-decision-vote/initiative-decision-vote.validators.js";

const initiativeCollectiveDecisionVoteRouter = Router();

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
    message.includes("not open for voting") ||
    message.includes("voting window") ||
    message.includes("already has an active vote") ||
    message.includes("Participation Area") ||
    message.includes("eligible") ||
    message.includes("registered") ||
    message.includes("active vote")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  // Shared Initiative ancestry errors (Recovery Task 10): mapped explicitly
  // because their messages ("Referenced Initiative does not exist.", etc.)
  // do not match the pre-existing substring heuristic in resolveErrorStatus
  // (e.g. InitiativeNotFoundError's message contains no "not found"
  // substring and would otherwise fall through to the 400 default).
  if (error instanceof InitiativeNotFoundError) {
    res.status(404).json(createFailureResponse(error.message));
    return;
  }

  if (error instanceof InitiativeAncestryMissingError || error instanceof InitiativeIdMalformedError) {
    res.status(400).json(createFailureResponse(error.message));
    return;
  }

  const message = error instanceof Error ? error.message : "Vote request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getDecisionId(req: Request): string {
  const decisionId = req.params.decisionId;
  return Array.isArray(decisionId) ? (decisionId[0] ?? "") : (decisionId ?? "");
}

initiativeCollectiveDecisionVoteRouter.post(
  "/:decisionId/vote",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateCastInitiativeDecisionVoteInput(req.body);
      const vote = await castOrUpdateInitiativeDecisionVote(identity, getDecisionId(req), input);

      res.status(201).json(createSuccessResponse(vote, "Vote recorded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollectiveDecisionVoteRouter.get(
  "/:decisionId/my-vote",
  ...authenticatedWorkspaceWriteMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const vote = await getMyInitiativeDecisionVote(identity, getDecisionId(req));

      res.json(createSuccessResponse(vote, vote ? "Vote loaded." : "No vote recorded yet."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeCollectiveDecisionVoteRouter;
