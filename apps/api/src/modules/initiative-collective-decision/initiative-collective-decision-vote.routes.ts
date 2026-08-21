import { Router, type Request, type Response } from "express";
import cookieParser from "cookie-parser";

import { authenticatedWorkspaceWriteMiddleware } from "../auth/auth-workspace-gate.js";
import { optionalAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  InitiativeAncestryMissingError,
  InitiativeIdMalformedError,
  InitiativeNotFoundError,
} from "../../shared/initiative-ancestry/index.js";
import {
  castOrUpdateInitiativeDecisionVote,
  castOrUpdateVisitorInitiativeDecisionVote,
  getMyInitiativeDecisionVote,
  getVisitorInitiativeDecisionVote,
  recallInitiativeDecisionVote,
  recallVisitorInitiativeDecisionVote,
} from "../initiative-decision-vote/initiative-decision-vote.service.js";
import { validateCastInitiativeDecisionVoteInput } from "../initiative-decision-vote/initiative-decision-vote.validators.js";

const initiativeCollectiveDecisionVoteRouter = Router();

initiativeCollectiveDecisionVoteRouter.use(cookieParser());

const VISITOR_COOKIE = "hu_initiative_visitor";

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

  if (message.includes("do not have access") || message.includes("Visitor voting")) {
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

function resolveVisitorKey(req: Request): string {
  const existing = req.cookies?.[VISITOR_COOKIE];

  if (typeof existing === "string" && existing.length > 0) {
    return existing;
  }

  const generated = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  req.res?.cookie(VISITOR_COOKIE, generated, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 365,
    path: "/",
  });

  return generated;
}

/**
 * Pack 02A — optional auth cast.
 * Authenticated → participant identity only (visitor cookie ignored for ownership).
 * Unauthenticated → visitor cookie identity (PUBLIC_CHOICE only; service enforces).
 */
initiativeCollectiveDecisionVoteRouter.post(
  "/:decisionId/vote",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    try {
      const input = validateCastInitiativeDecisionVoteInput(req.body);

      if (req.auth?.id) {
        const identity = await resolveRequestIdentity(req);
        const vote = await castOrUpdateInitiativeDecisionVote(identity, getDecisionId(req), input);
        res.status(201).json(createSuccessResponse(vote, "Vote recorded."));
        return;
      }

      const vote = await castOrUpdateVisitorInitiativeDecisionVote(
        resolveVisitorKey(req),
        getDecisionId(req),
        input,
      );
      res.status(201).json(createSuccessResponse(vote, "Visitor vote recorded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollectiveDecisionVoteRouter.get(
  "/:decisionId/my-vote",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    try {
      if (req.auth?.id) {
        const identity = await resolveRequestIdentity(req);
        const vote = await getMyInitiativeDecisionVote(identity, getDecisionId(req));
        res.json(createSuccessResponse(vote, vote ? "Vote loaded." : "No vote recorded yet."));
        return;
      }

      const existing = req.cookies?.[VISITOR_COOKIE];
      if (typeof existing !== "string" || !existing) {
        res.json(createSuccessResponse(null, "No vote recorded yet."));
        return;
      }

      const vote = await getVisitorInitiativeDecisionVote(existing, getDecisionId(req));
      res.json(createSuccessResponse(vote, vote ? "Vote loaded." : "No vote recorded yet."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Pack 04 — Recall: clear the caller's effective vote. */
initiativeCollectiveDecisionVoteRouter.delete(
  "/:decisionId/vote",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    try {
      if (req.auth?.id) {
        const identity = await resolveRequestIdentity(req);
        await recallInitiativeDecisionVote(identity, getDecisionId(req));
        res.json(createSuccessResponse(null, "Vote recalled."));
        return;
      }

      await recallVisitorInitiativeDecisionVote(resolveVisitorKey(req), getDecisionId(req));
      res.json(createSuccessResponse(null, "Visitor vote recalled."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

/** Authenticated workspace write gate — same cast, for clients that require the gate. */
initiativeCollectiveDecisionVoteRouter.post(
  "/:decisionId/vote/authenticated",
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

export default initiativeCollectiveDecisionVoteRouter;
