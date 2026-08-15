import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";

import {
  getInitiativeCollaborationChannelSummary,
  listInitiativeCollaborationChannelHistory,
  markInitiativeCollaborationChannelRead,
  sendInitiativeCollaborationChannelMessage,
} from "./initiative-collaboration-channel.service.js";

export const initiativeCollaborationChannelRouter = Router();

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
 * Part 2 — the Channel is never publicly visible: "not found" and "access
 * denied" resolve to the same generic 404 so an unauthorized caller can
 * never distinguish "this Initiative does not exist" from "this Initiative
 * exists but you are not an Author/Active Ally", never leaking which
 * Initiative ids are valid.
 */
function resolveErrorStatus(errorName: string): number {
  if (
    errorName === "InitiativeCollaborationChannelNotFoundError" ||
    errorName === "InitiativeCollaborationChannelAccessDeniedError"
  ) {
    return 404;
  }

  if (errorName === "InitiativeCollaborationChannelValidationError") {
    return 400;
  }

  return 400;
}

function handleServiceError(res: Response, error: unknown): void {
  const name = error instanceof Error ? error.name : "Error";
  const message =
    error instanceof Error ? error.message : "Initiative Collaboration Channel request failed.";
  res.status(resolveErrorStatus(name)).json(createFailureResponse(message));
}

initiativeCollaborationChannelRouter.get(
  "/:initiativeId/collaboration-channel/summary",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const summary = await getInitiativeCollaborationChannelSummary(
        identity,
        resolveParam(req.params.initiativeId),
      );

      res.json(createSuccessResponse(summary, "Collaboration Channel summary loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborationChannelRouter.get(
  "/:initiativeId/collaboration-channel/messages",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const beforeCreatedAt = resolveParam(req.query.beforeCreatedAt as string | string[] | undefined);
      const beforeMessageId = resolveParam(req.query.beforeMessageId as string | string[] | undefined);
      const limitParam = resolveParam(req.query.limit as string | string[] | undefined);
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

      const history = await listInitiativeCollaborationChannelHistory(
        identity,
        resolveParam(req.params.initiativeId),
        {
          beforeCreatedAt: beforeCreatedAt || undefined,
          beforeMessageId: beforeMessageId || undefined,
          limit: limit && Number.isFinite(limit) ? limit : undefined,
        },
      );

      res.json(createSuccessResponse(history, "Collaboration Channel history loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborationChannelRouter.post(
  "/:initiativeId/collaboration-channel/messages",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const message = await sendInitiativeCollaborationChannelMessage(
        identity,
        resolveParam(req.params.initiativeId),
        req.body?.text,
      );

      res.status(201).json(createSuccessResponse(message, "Collaboration Channel message sent."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

initiativeCollaborationChannelRouter.post(
  "/:initiativeId/collaboration-channel/read",
  requireJwtAuthenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const readState = await markInitiativeCollaborationChannelRead(
        identity,
        resolveParam(req.params.initiativeId),
      );

      res.json(createSuccessResponse(readState, "Collaboration Channel marked as read."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default initiativeCollaborationChannelRouter;
