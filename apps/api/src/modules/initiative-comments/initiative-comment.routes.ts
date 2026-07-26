import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  optionalAuthenticationMiddleware,
  requireJwtAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
import {
  createInitiativeCommentWithNotifications,
  deleteInitiativeComment,
  listApprovedInitiativeComments,
  mapCommentsToPublicDiscussionComments,
} from "./initiative-comment.service.js";
import { setInitiativeCommentReaction } from "../initiative-comment-reactions/initiative-comment-reaction.service.js";

export const initiativeCommentRouter = Router();

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

function resolveInitiativeOr404(initiativeId: string, res: Response) {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative || !canExposePublicInitiativeProjection(initiative)) {
    res.status(404).json(createFailureResponse("Initiative not found."));
    return null;
  }

  return initiative;
}

initiativeCommentRouter.get(
  "/:initiativeId/comments",
  optionalAuthenticationMiddleware,
  async (req, res) => {
    const initiative = resolveInitiativeOr404(resolveParam(req.params.initiativeId), res);

    if (!initiative) {
      return;
    }

    const limit = Number.parseInt(String(req.query.limit ?? "40"), 10);
    const offset = Number.parseInt(String(req.query.offset ?? "0"), 10);
    const listing = await listApprovedInitiativeComments({
      initiativeId: initiative.initiativeId,
      limit: Number.isFinite(limit) ? limit : 40,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    const comments = await mapCommentsToPublicDiscussionComments(
      listing.comments,
      req.auth?.id ?? null,
    );

    res.json(
      createSuccessResponse(
        {
          comments,
          total: listing.total,
          limit: listing.limit,
          offset: listing.offset,
          hasMore: listing.hasMore,
        },
        "Initiative comments loaded.",
      ),
    );
  },
);

initiativeCommentRouter.post(
  "/:initiativeId/comments",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const initiative = resolveInitiativeOr404(resolveParam(req.params.initiativeId), res);
    const userId = req.auth?.id;

    if (!initiative || !userId) {
      if (!userId) {
        res.status(401).json(createFailureResponse("Authentication required."));
      }

      return;
    }

    const authUser = await findAuthUserById(userId);

    if (!authUser || authUser.status !== "active") {
      res
        .status(403)
        .json(createFailureResponse("Your account is restricted and cannot post comments."));
      return;
    }

    if (authUser.emailVerificationStatus !== "verified") {
      res
        .status(403)
        .json(createFailureResponse("Confirm your email address before posting comments."));
      return;
    }

    const body = typeof req.body?.body === "string" ? req.body.body : "";
    const parentCommentId =
      typeof req.body?.parentCommentId === "string" && req.body.parentCommentId.trim()
        ? req.body.parentCommentId.trim()
        : undefined;

    try {
      const comment = await createInitiativeCommentWithNotifications({
        initiativeId: initiative.initiativeId,
        authorUserId: userId,
        body,
        parentCommentId,
        actorMemberId: authUser.memberId ?? null,
      });
      const [projectedComment] = await mapCommentsToPublicDiscussionComments([comment], userId);

      res.status(201).json(createSuccessResponse(projectedComment, "Comment posted."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to post comment.";
      const status = message.includes("wait") ? 429 : 400;
      res.status(status).json(createFailureResponse(message));
    }
  },
);

initiativeCommentRouter.delete(
  "/:initiativeId/comments/:commentId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const initiative = resolveInitiativeOr404(resolveParam(req.params.initiativeId), res);
    const userId = req.auth?.id;
    const commentId = resolveParam(req.params.commentId);

    if (!initiative || !userId) {
      if (!userId) {
        res.status(401).json(createFailureResponse("Authentication required."));
      }

      return;
    }

    const deleted = await deleteInitiativeComment({ commentId, authorUserId: userId });

    if (!deleted) {
      res.status(404).json(createFailureResponse("Comment not found."));
      return;
    }

    res.json(createSuccessResponse({ commentId }, "Comment removed."));
  },
);

initiativeCommentRouter.post(
  "/:initiativeId/comments/:commentId/reactions",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    const initiative = resolveInitiativeOr404(resolveParam(req.params.initiativeId), res);
    const userId = req.auth?.id;
    const commentId = resolveParam(req.params.commentId);
    const reactionInput = req.body?.reaction;

    if (!initiative || !userId) {
      if (!userId) {
        res.status(401).json(createFailureResponse("Authentication required."));
      }

      return;
    }

    const authUser = await findAuthUserById(userId);

    if (!authUser || authUser.status !== "active") {
      res
        .status(403)
        .json(createFailureResponse("Your account is restricted and cannot react to comments."));
      return;
    }

    if (authUser.emailVerificationStatus !== "verified") {
      res
        .status(403)
        .json(createFailureResponse("Confirm your email address before reacting to comments."));
      return;
    }

    const reaction =
      reactionInput === "like" || reactionInput === "dislike" || reactionInput === "none"
        ? reactionInput
        : null;

    if (!reaction) {
      res.status(400).json(createFailureResponse("Reaction must be like, dislike, or none."));
      return;
    }

    try {
      const currentUserReaction = await setInitiativeCommentReaction({
        initiativeId: initiative.initiativeId,
        commentId,
        actorUserId: userId,
        reaction,
      });

      res.json(
        createSuccessResponse({ commentId, currentUserReaction }, "Comment reaction saved."),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save comment reaction.";
      const status = message.includes("wait") ? 429 : 400;
      res.status(status).json(createFailureResponse(message));
    }
  },
);

export default initiativeCommentRouter;
