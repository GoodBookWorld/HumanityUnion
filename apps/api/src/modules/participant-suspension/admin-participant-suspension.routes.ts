import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  ParticipantSuspensionAdminRequiredError,
  ParticipantSuspensionConflictError,
  ParticipantSuspensionNotFoundError,
  ParticipantSuspensionUnauthorizedError,
  ParticipantSuspensionValidationError,
} from "./participant-suspension.errors.js";
import {
  getActiveSuspensionForParticipant,
  restoreParticipantForAdmin,
  suspendParticipantForAdmin,
} from "./participant-suspension.service.js";

const adminParticipantSuspensionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveErrorStatus(error: unknown): number {
  if (error instanceof ParticipantSuspensionUnauthorizedError) {
    return 401;
  }
  if (error instanceof ParticipantSuspensionAdminRequiredError) {
    return 403;
  }
  if (error instanceof ParticipantSuspensionNotFoundError) {
    return 404;
  }
  if (error instanceof ParticipantSuspensionValidationError) {
    return 400;
  }
  if (error instanceof ParticipantSuspensionConflictError) {
    return 409;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Participant suspension request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminParticipantSuspensionRouter.post(
  "/:participantId/suspend",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const body = req.body as { reasonCode?: unknown };
      const result = await suspendParticipantForAdmin({
        actorUserId: req.auth!.id,
        participantId: String(req.params.participantId ?? ""),
        reasonCode: body.reasonCode,
      });
      res.json(createSuccessResponse(result, "Participant suspended."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminParticipantSuspensionRouter.post(
  "/:participantId/restore",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await restoreParticipantForAdmin({
        actorUserId: req.auth!.id,
        participantId: String(req.params.participantId ?? ""),
      });
      res.json(createSuccessResponse(result, "Participant restored."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminParticipantSuspensionRouter.get(
  "/:participantId/suspension",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const suspension = await getActiveSuspensionForParticipant({
        actorUserId: req.auth!.id,
        participantId: String(req.params.participantId ?? ""),
      });
      res.json(
        createSuccessResponse(
          { suspension },
          suspension ? "Active suspension loaded." : "No active suspension.",
        ),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminParticipantSuspensionRouter;
