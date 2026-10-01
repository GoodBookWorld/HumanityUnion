import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  DirectMessagingAccessDeniedError,
  DirectMessagingConversationNotFoundError,
  DirectMessagingPersistenceUnavailableError,
} from "../direct-messaging/direct-messaging.errors.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  DirectConversationCallConflictError,
  DirectConversationCallExpiredError,
  DirectConversationCallNotFoundError,
  DirectConversationCallPersistenceUnavailableError,
  DirectConversationCallRateLimitError,
  DirectConversationCallTransitionError,
  DirectConversationCallValidationError,
} from "./direct-conversation-call.errors.js";
import {
  acceptDirectConversationCall,
  createDirectConversationCall,
  declineDirectConversationCall,
  endDirectConversationCall,
  getCurrentDirectConversationCall,
  listDirectConversationCallHistory,
} from "./direct-conversation-call.service.js";

export const directConversationCallsRouter = Router();

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

function resolveErrorStatus(error: unknown): number {
  if (error instanceof DirectConversationCallValidationError) {
    return 400;
  }

  if (error instanceof DirectConversationCallNotFoundError) {
    return 404;
  }

  if (error instanceof DirectMessagingConversationNotFoundError) {
    return 404;
  }

  if (error instanceof DirectMessagingAccessDeniedError) {
    return 403;
  }

  if (error instanceof DirectConversationCallConflictError) {
    return 409;
  }

  if (error instanceof DirectConversationCallTransitionError) {
    return 409;
  }

  if (error instanceof DirectConversationCallExpiredError) {
    return 409;
  }

  if (error instanceof DirectConversationCallRateLimitError) {
    return 429;
  }

  if (
    error instanceof DirectConversationCallPersistenceUnavailableError ||
    error instanceof DirectMessagingPersistenceUnavailableError
  ) {
    return 503;
  }

  return 500;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Call request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

/**
 * Same account-standing gate as Direct Messaging: active and email-verified.
 * Paid membership is not required.
 */
async function requireEligibleParticipant(req: Request, res: Response): Promise<boolean> {
  const userId = req.auth?.id;

  if (!userId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return false;
  }

  const authUser = await findAuthUserById(userId);

  if (!authUser || authUser.status !== "active") {
    res
      .status(403)
      .json(createFailureResponse("Your account is restricted and cannot take this action."));
    return false;
  }

  if (authUser.emailVerificationStatus !== "verified") {
    res
      .status(403)
      .json(createFailureResponse("Confirm your email address before taking this action."));
    return false;
  }

  return true;
}

directConversationCallsRouter.post(
  "/conversations/:conversationId/calls",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const call = await createDirectConversationCall({
        conversationId: resolveParam(req.params.conversationId),
        initiatorParticipantId: identity.participantId,
      });

      res.status(201).json(createSuccessResponse(call, "Call invitation created."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

directConversationCallsRouter.get(
  "/conversations/:conversationId/calls/current",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const call = await getCurrentDirectConversationCall(
        resolveParam(req.params.conversationId),
        identity.participantId,
      );

      res.json(createSuccessResponse({ call }, "Current call loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

directConversationCallsRouter.get(
  "/conversations/:conversationId/calls",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const calls = await listDirectConversationCallHistory(
        resolveParam(req.params.conversationId),
        identity.participantId,
      );

      res.json(createSuccessResponse({ calls }, "Call history loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

directConversationCallsRouter.post(
  "/conversations/:conversationId/calls/:callId/accept",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const call = await acceptDirectConversationCall({
        conversationId: resolveParam(req.params.conversationId),
        callId: resolveParam(req.params.callId),
        participantId: identity.participantId,
      });

      res.json(createSuccessResponse(call, "Call accepted."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

directConversationCallsRouter.post(
  "/conversations/:conversationId/calls/:callId/decline",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const call = await declineDirectConversationCall({
        conversationId: resolveParam(req.params.conversationId),
        callId: resolveParam(req.params.callId),
        participantId: identity.participantId,
      });

      res.json(createSuccessResponse(call, "Call declined."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

directConversationCallsRouter.post(
  "/conversations/:conversationId/calls/:callId/end",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const call = await endDirectConversationCall({
        conversationId: resolveParam(req.params.conversationId),
        callId: resolveParam(req.params.callId),
        participantId: identity.participantId,
      });

      res.json(createSuccessResponse(call, "Call ended."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default directConversationCallsRouter;
