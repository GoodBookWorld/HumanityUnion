import { Router, type Request, type Response } from "express";

import { authenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import {
  archiveDecisionSession,
  closeDecisionSession,
  createDecisionSessionDraft,
  getDecisionSessionEligibility,
  getMyDecisionSession,
  listMyDecisionSessions,
  listMyDecisionSessionsForInitiative,
  publishDecisionSession,
  saveDecisionSessionDraft,
} from "./decision-session.service.js";
import {
  validateCreateDecisionSessionDraftInput,
  validateSaveDecisionSessionDraftInput,
} from "./decision-session.validators.js";

const decisionSessionRouter = Router();

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
    message.includes("must be projected") ||
    message.includes("must be published") ||
    message.includes("At least one") ||
    message.includes("not eligible") ||
    message.includes("Only draft") ||
    message.includes("Only published") ||
    message.includes("already archived")
  ) {
    return 409;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Decision session request failed.";
  res.status(resolveErrorStatus(message)).json(createFailureResponse(message));
}

function getSessionId(req: Request): string {
  const sessionId = req.params.sessionId;
  return Array.isArray(sessionId) ? (sessionId[0] ?? "") : (sessionId ?? "");
}

function getInitiativeId(req: Request): string {
  const initiativeId = req.params.initiativeId;
  return Array.isArray(initiativeId) ? (initiativeId[0] ?? "") : (initiativeId ?? "");
}

decisionSessionRouter.get("/mine", authenticationMiddleware, (req, res) => {
  const identity = resolveRequestIdentity(req);
  const sessions = listMyDecisionSessions(identity);

  res.json(createSuccessResponse(sessions, "My decision sessions loaded."));
});

decisionSessionRouter.get("/by-initiative/:initiativeId", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const sessions = listMyDecisionSessionsForInitiative(identity, getInitiativeId(req));

    res.json(createSuccessResponse(sessions, "Initiative decision sessions loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

decisionSessionRouter.get(
  "/initiative/:initiativeId/eligibility",
  authenticationMiddleware,
  (req, res) => {
    try {
      const identity = resolveRequestIdentity(req);
      const initiativeId = getInitiativeId(req);
      const initiative = getInitiativeById(initiativeId);

      if (!initiative) {
        throw new Error("Initiative not found.");
      }

      assertInitiativeOwnership(initiative, identity);

      const eligibility = getDecisionSessionEligibility(initiativeId);

      res.json(createSuccessResponse(eligibility, "Decision session eligibility loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

decisionSessionRouter.get("/:sessionId", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const session = getMyDecisionSession(identity, getSessionId(req));

    res.json(createSuccessResponse(session, "Decision session loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

decisionSessionRouter.post("/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input = validateCreateDecisionSessionDraftInput(req.body);
    const created = createDecisionSessionDraft(identity, input);

    res.status(201).json(createSuccessResponse(created, "Decision session draft created."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

decisionSessionRouter.patch("/:sessionId/draft", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const input = validateSaveDecisionSessionDraftInput(req.body);
    const session = saveDecisionSessionDraft(identity, getSessionId(req), input);

    res.json(createSuccessResponse(session, "Decision session draft saved."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

decisionSessionRouter.post("/:sessionId/publish", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const session = publishDecisionSession(identity, getSessionId(req));

    res.json(createSuccessResponse(session, "Decision session published."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

decisionSessionRouter.post("/:sessionId/close", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const session = closeDecisionSession(identity, getSessionId(req));

    res.json(createSuccessResponse(session, "Decision session closed."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

decisionSessionRouter.post("/:sessionId/archive", authenticationMiddleware, (req, res) => {
  try {
    const identity = resolveRequestIdentity(req);
    const session = archiveDecisionSession(identity, getSessionId(req));

    res.json(createSuccessResponse(session, "Decision session archived."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

export default decisionSessionRouter;
