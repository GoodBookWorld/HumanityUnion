import { Router, type Request, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  DirectMessagingAccessDeniedError,
  DirectMessagingBlockedError,
  DirectMessagingConversationNotFoundError,
  DirectMessagingParticipantNotFoundError,
  DirectMessagingPersistenceUnavailableError,
  DirectMessagingSelfMessageError,
  DirectMessagingValidationError,
} from "./direct-messaging.errors.js";
import {
  getDirectConversationDetail,
  listMyDirectConversations,
  listOlderDirectMessages,
  markDirectConversationRead,
  openOrCreateDirectConversation,
  sendDirectMessage,
} from "./direct-messaging.service.js";

export const directMessagingRouter = Router();

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
  if (error instanceof DirectMessagingValidationError) {
    return 400;
  }

  if (error instanceof DirectMessagingSelfMessageError) {
    return 400;
  }

  if (error instanceof DirectMessagingParticipantNotFoundError) {
    return 404;
  }

  if (error instanceof DirectMessagingConversationNotFoundError) {
    return 404;
  }

  if (error instanceof DirectMessagingAccessDeniedError) {
    return 403;
  }

  if (error instanceof DirectMessagingBlockedError) {
    return 403;
  }

  if (error instanceof DirectMessagingPersistenceUnavailableError) {
    return 503;
  }

  return 500;
}

function handleServiceError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Direct Collaboration request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

/**
 * Part 5 — gate mirrors the existing collaboration-write gate (only
 * active, email-verified accounts may start or send Direct Collaboration
 * messages). Member status (paid Membership) is deliberately NOT checked
 * here (Part 24: "Membership requirement" is out of scope) — this is an
 * account-standing check only, identical in spirit to
 * `initiative-discussion-collaboration.routes.ts`'s
 * `requireEligibleParticipant`.
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

/**
 * Part 19 — "open or create conversation with Participant". Accepts either
 * the target's public `publicName` (public profile / notification entry
 * points) or their `participantId` (Communication UX Pack 03.2 Part 2/5 —
 * Workspace Ally entry point: an Ally is not required to have a public
 * profile). Either way the server — never the client — resolves the
 * identifier into a real Participant + `messagingPolicy` and re-checks
 * Privacy (Part 5: "frontend state is not authority").
 */
directMessagingRouter.post("/conversations", requireJwtAuthenticationMiddleware, async (req, res) => {
  if (!(await requireEligibleParticipant(req, res))) {
    return;
  }

  const publicName = typeof req.body?.publicName === "string" ? req.body.publicName.trim() : "";
  const participantId = typeof req.body?.participantId === "string" ? req.body.participantId.trim() : "";

  if (!publicName && !participantId) {
    res.status(400).json(createFailureResponse("publicName or participantId is required."));
    return;
  }

  try {
    const identity = await resolveRequestIdentity(req);
    const conversation = await openOrCreateDirectConversation(identity.participantId, {
      publicName: publicName || undefined,
      participantId: participantId || undefined,
    });

    res.status(201).json(createSuccessResponse(conversation, "Conversation ready."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

directMessagingRouter.get("/conversations", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const result = await listMyDirectConversations(identity.participantId);

    res.json(createSuccessResponse(result, "Conversations loaded."));
  } catch (error) {
    handleServiceError(res, error);
  }
});

directMessagingRouter.get(
  "/conversations/:conversationId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const conversation = await getDirectConversationDetail(
        resolveParam(req.params.conversationId),
        identity.participantId,
      );

      res.json(createSuccessResponse(conversation, "Conversation loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

directMessagingRouter.get(
  "/conversations/:conversationId/messages",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const before = typeof req.query.before === "string" ? req.query.before : "";

    if (!before) {
      res.status(400).json(createFailureResponse("before is required."));
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const result = await listOlderDirectMessages(
        resolveParam(req.params.conversationId),
        identity.participantId,
        before,
      );

      res.json(createSuccessResponse(result, "Older messages loaded."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

directMessagingRouter.post(
  "/conversations/:conversationId/messages",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    if (!(await requireEligibleParticipant(req, res))) {
      return;
    }

    try {
      const identity = await resolveRequestIdentity(req);
      const clientMessageId =
        typeof req.body?.clientMessageId === "string" ? req.body.clientMessageId : undefined;

      const message = await sendDirectMessage({
        conversationId: resolveParam(req.params.conversationId),
        senderParticipantId: identity.participantId,
        text: req.body?.text,
        clientMessageId,
      });

      res.status(201).json(createSuccessResponse(message, "Message sent."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

directMessagingRouter.post(
  "/conversations/:conversationId/read",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      await markDirectConversationRead(resolveParam(req.params.conversationId), identity.participantId);

      res.json(createSuccessResponse({ ok: true }, "Conversation marked read."));
    } catch (error) {
      handleServiceError(res, error);
    }
  },
);

export default directMessagingRouter;
