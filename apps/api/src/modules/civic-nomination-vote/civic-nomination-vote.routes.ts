import type { Request, Response, Router } from "express";

import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";

import {
  castOrUpdateCivicNominationVote,
  getMyCivicNominationVote,
} from "./civic-nomination-vote.service.js";
import { validateCastCivicNominationVoteInput } from "./civic-nomination-vote.validators.js";
import {
  closeCivicNominationVoting,
  openCivicNominationVoting,
} from "./civic-nomination-voting-session.service.js";
import { validateOpenCivicNominationVotingInput } from "./civic-nomination-vote.validators.js";

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

  if (message.includes("privileges are required") || message.includes("do not have access")) {
    return 403;
  }

  if (
    message.includes("not open") ||
    message.includes("voting window") ||
    message.includes("already open") ||
    message.includes("already closed") ||
    message.includes("Participation Area") ||
    message.includes("eligible") ||
    message.includes("registered") ||
    message.includes("mismatch")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Civic nomination vote request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getNominationId(req: Request): string {
  const nominationId = req.params.nominationId;
  return Array.isArray(nominationId) ? (nominationId[0] ?? "") : (nominationId ?? "");
}

export function registerCivicNominationVoteRoutes(router: Router): void {
  router.post(
    "/:nominationId/voting/open",
    ...authenticatedWorkspaceWriteMiddleware,
    async (req, res) => {
      try {
        const identity = await resolveRequestIdentity(req);
        const input = validateOpenCivicNominationVotingInput(req.body);
        const session = await openCivicNominationVoting(
          getNominationId(req),
          identity,
          input.closesAt,
        );
        res.status(201).json(createSuccessResponse(session, "Civic nomination voting opened."));
      } catch (error) {
        handleServiceError(res, error);
      }
    },
  );

  router.post(
    "/:nominationId/voting/close",
    ...authenticatedWorkspaceWriteMiddleware,
    async (req, res) => {
      try {
        const identity = await resolveRequestIdentity(req);
        const session = await closeCivicNominationVoting(getNominationId(req), identity);
        res.json(createSuccessResponse(session, "Civic nomination voting closed."));
      } catch (error) {
        handleServiceError(res, error);
      }
    },
  );

  router.post("/:nominationId/vote", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const input = validateCastCivicNominationVoteInput(req.body);
      const vote = await castOrUpdateCivicNominationVote(
        identity,
        getNominationId(req),
        input,
        req.auth?.id,
      );
      res.status(201).json(createSuccessResponse(vote, "Civic nomination vote recorded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  });

  router.patch(
    "/:nominationId/vote",
    ...authenticatedWorkspaceWriteMiddleware,
    async (req, res) => {
      try {
        const identity = await resolveRequestIdentity(req);
        const input = validateCastCivicNominationVoteInput(req.body);
        const vote = await castOrUpdateCivicNominationVote(
          identity,
          getNominationId(req),
          input,
          req.auth?.id,
        );
        res.json(createSuccessResponse(vote, "Civic nomination vote updated."));
      } catch (error) {
        handleServiceError(res, error);
      }
    },
  );

  router.get("/:nominationId/my-vote", ...authenticatedWorkspaceWriteMiddleware, async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const vote = getMyCivicNominationVote(identity, getNominationId(req));
      res.json(createSuccessResponse(vote, vote ? "Vote loaded." : "No vote recorded yet."));
    } catch (error) {
      handleServiceError(res, error);
    }
  });
}
