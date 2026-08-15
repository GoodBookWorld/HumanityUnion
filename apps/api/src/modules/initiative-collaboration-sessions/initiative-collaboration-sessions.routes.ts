import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";

import {
  cancelInitiativeCollaborationSession,
  createInitiativeCollaborationSession,
  getInitiativeCollaborationSession,
  listInitiativeCollaborationSessions,
  setInitiativeCollaborationSessionAttendance,
  updateInitiativeCollaborationSession,
} from "./initiative-collaboration-sessions.service.js";

export const initiativeCollaborationSessionsRouter = Router();

function resolveParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

/**
 * Part 2 — Sessions are never publicly visible: "not found" and "access
 * denied" resolve to the same generic 404, exactly like the Collaboration
 * Channel. `AuthorOnlyError`/`AttendanceRestrictedError` only ever occur
 * after the requester has already been confirmed as a legitimate Author or
 * Active Ally, so a 403 (a real authorization distinction, not an
 * existence leak) is safe there.
 */
function resolveErrorStatus(errorName: string): number {
  if (
    errorName === "InitiativeCollaborationSessionNotFoundError" ||
    errorName === "InitiativeCollaborationSessionAccessDeniedError"
  ) {
    return 404;
  }

  if (
    errorName === "InitiativeCollaborationSessionAuthorOnlyError" ||
    errorName === "InitiativeCollaborationSessionAttendanceRestrictedError"
  ) {
    return 403;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "Collaboration Session request failed.";
  res.status(resolveErrorStatus(name)).json(createFailureResponse(message));
}

initiativeCollaborationSessionsRouter.get(
  "/:initiativeId/collaboration-sessions",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const result = await listInitiativeCollaborationSessions(identity, resolveParam(req.params.initiativeId));

      res.json(createSuccessResponse(result, "Collaboration Sessions loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborationSessionsRouter.post(
  "/:initiativeId/collaboration-sessions",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const session = await createInitiativeCollaborationSession(
        identity,
        resolveParam(req.params.initiativeId),
        req.body ?? {},
      );

      res.status(201).json(createSuccessResponse(session, "Collaboration Session scheduled."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborationSessionsRouter.get(
  "/:initiativeId/collaboration-sessions/:sessionId",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const session = await getInitiativeCollaborationSession(
        identity,
        resolveParam(req.params.initiativeId),
        resolveParam(req.params.sessionId),
      );

      res.json(createSuccessResponse(session, "Collaboration Session loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborationSessionsRouter.patch(
  "/:initiativeId/collaboration-sessions/:sessionId",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const session = await updateInitiativeCollaborationSession(
        identity,
        resolveParam(req.params.initiativeId),
        resolveParam(req.params.sessionId),
        req.body ?? {},
      );

      res.json(createSuccessResponse(session, "Collaboration Session updated."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborationSessionsRouter.post(
  "/:initiativeId/collaboration-sessions/:sessionId/cancel",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const session = await cancelInitiativeCollaborationSession(
        identity,
        resolveParam(req.params.initiativeId),
        resolveParam(req.params.sessionId),
      );

      res.json(createSuccessResponse(session, "Collaboration Session cancelled."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborationSessionsRouter.post(
  "/:initiativeId/collaboration-sessions/:sessionId/attendance",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const session = await setInitiativeCollaborationSessionAttendance(
        identity,
        resolveParam(req.params.initiativeId),
        resolveParam(req.params.sessionId),
        req.body?.response,
      );

      res.json(createSuccessResponse(session, "Attendance recorded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeCollaborationSessionsRouter;
