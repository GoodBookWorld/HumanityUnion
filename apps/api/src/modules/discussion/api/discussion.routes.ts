import { Router } from "express";

import { createSuccessResponse } from "../../../shared/http-response.js";
import {
  requireJwtAuthenticationMiddleware,
} from "../../auth/auth.middleware.js";
import { requireVerifiedEmailForMutationsMiddleware } from "../../auth/auth-workspace-gate.js";
import { createDiscussion } from "../application/create-discussion.service.js";
import { getDiscussionByIdForMember } from "../application/discussion-query.service.js";
import {
  DiscussionActivityNotFoundError,
  DiscussionForbiddenError,
  DiscussionMemberNotRegisteredError,
  DiscussionNotFoundError,
  DiscussionPersistenceError,
  DiscussionTransactionError,
  DiscussionValidationError,
} from "../domain/discussion.errors.js";
import {
  assertNoTrustedCreateDiscussionFields,
  validateCreateDiscussionInput,
} from "../domain/discussion.validation.js";

const discussionRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

discussionRouter.post(
  "/",
  requireJwtAuthenticationMiddleware,
  requireVerifiedEmailForMutationsMiddleware,
  async (req, res) => {
    if (!req.auth?.memberId) {
      res.status(403).json(createFailureResponse("Registered Member is required to create a Discussion."));
      return;
    }

    const body = req.body as Record<string, unknown>;

    try {
      assertNoTrustedCreateDiscussionFields(body);
      const command = validateCreateDiscussionInput(body);

      const result = await createDiscussion({
        creatorMemberId: req.auth.memberId,
        actorId: req.auth.id,
        command,
      });

      res.status(201).json(createSuccessResponse(result.discussion, "Discussion created."));
    } catch (error) {
      if (error instanceof DiscussionValidationError) {
        res.status(400).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof DiscussionMemberNotRegisteredError) {
        res.status(403).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof DiscussionActivityNotFoundError) {
        res.status(404).json(createFailureResponse(error.message));
        return;
      }

      if (error instanceof DiscussionTransactionError || error instanceof DiscussionPersistenceError) {
        res.status(500).json(createFailureResponse(error.message));
        return;
      }

      const message = error instanceof Error ? error.message : "Discussion creation failed.";
      res.status(500).json(createFailureResponse(message));
    }
  },
);

discussionRouter.get("/:discussionId", requireJwtAuthenticationMiddleware, async (req, res) => {
  if (!req.auth?.memberId) {
    res.status(401).json(createFailureResponse("Authentication required."));
    return;
  }

  const discussionId = req.params.discussionId;

  if (!discussionId || Array.isArray(discussionId)) {
    res.status(400).json(createFailureResponse("Discussion identifier is required."));
    return;
  }

  try {
    const discussion = await getDiscussionByIdForMember({
      discussionId,
      memberId: req.auth.memberId,
    });

    res.json(createSuccessResponse(discussion, "Discussion loaded."));
  } catch (error) {
    if (error instanceof DiscussionNotFoundError) {
      res.status(404).json(createFailureResponse(error.message));
      return;
    }

    if (error instanceof DiscussionForbiddenError) {
      res.status(403).json(createFailureResponse(error.message));
      return;
    }

    const message = error instanceof Error ? error.message : "Discussion request failed.";
    res.status(500).json(createFailureResponse(message));
  }
});

export default discussionRouter;
