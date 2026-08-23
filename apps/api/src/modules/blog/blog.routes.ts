import { Router, type Response } from "express";

import {
  optionalAuthenticationMiddleware,
  requireJwtAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import { resolveRequestIdentity } from "../initiatives/identity/resolve-request-identity.js";
import {
  BlogAccessDeniedError,
  BlogConflictError,
  BlogNotFoundError,
  BlogPersistenceUnavailableError,
  BlogSafetyNeedsReviewError,
  BlogSafetyRejectedError,
  BlogValidationError,
} from "./blog.errors.js";
import {
  BlogCommentAccessDeniedError,
  BlogCommentConflictError,
  BlogCommentNotFoundError,
  BlogCommentRateLimitError,
  BlogCommentValidationError,
  BlogReactionRateLimitError,
} from "./blog-interaction.errors.js";
import {
  approvePendingBlogComment,
  createBlogComment,
  deleteOwnBlogComment,
  editBlogComment,
  listPendingBlogCommentsForModeration,
  listPublicBlogComments,
  moderateRemoveBlogComment,
  projectOwnCommentCreateResponse,
  setBlogPostReaction,
} from "./blog-interaction.service.js";
import {
  applyForBlogAuthorCapability,
  archiveBlogPost,
  createBlogDraft,
  decideBlogAuthorApplication,
  decideBlogAuthorApplicationAsAdmin,
  declineBlogPost,
  getAdminAuthorApplicationReview,
  getBlogAuthoringAccessState,
  getBlogAuthorWorkspacePost,
  getEditorialReviewDetail,
  getPublicBlogPostBySlug,
  grantBlogCapabilities,
  listBlogCategories,
  listEditorialReviewQueue,
  listOwnBlogWorkspacePosts,
  listPublicBlogAuthors,
  listPublicBlogPosts,
  previewBlogPost,
  publishBlogPost,
  publishBlogPostAfterSafetyReview,
  cancelScheduledBlogPublication,
  requestBlogPostChanges,
  resubmitBlogAuthorApplication,
  submitBlogPostForReview,
  updateBlogDraft,
  withdrawBlogPostToDraft,
  type BlogAuthorApplicationDecision,
} from "./blog.service.js";

export const blogRouter = Router();
export const publicBlogRouter = Router();

function failure(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function routeParam(value: string | string[] | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return "";
}

function handleBlogError(res: Response, error: unknown): void {
  if (
    error instanceof BlogValidationError ||
    error instanceof BlogCommentValidationError
  ) {
    res.status(400).json(failure(error.message));
    return;
  }
  if (
    error instanceof BlogAccessDeniedError ||
    error instanceof BlogCommentAccessDeniedError
  ) {
    res.status(403).json(failure(error.message));
    return;
  }
  if (error instanceof BlogNotFoundError || error instanceof BlogCommentNotFoundError) {
    res.status(404).json(failure(error.message));
    return;
  }
  if (error instanceof BlogConflictError || error instanceof BlogCommentConflictError) {
    res.status(409).json(failure(error.message));
    return;
  }
  if (
    error instanceof BlogCommentRateLimitError ||
    error instanceof BlogReactionRateLimitError
  ) {
    res.status(429).json(failure(error.message));
    return;
  }
  if (error instanceof BlogSafetyRejectedError) {
    res.status(422).json(failure(error.message));
    return;
  }
  if (error instanceof BlogSafetyNeedsReviewError) {
    res.status(422).json(failure(error.message));
    return;
  }
  if (error instanceof BlogPersistenceUnavailableError) {
    res.status(503).json(failure(error.message));
    return;
  }

  const message = error instanceof Error ? error.message : "Blog request failed.";
  res.status(500).json(failure(message));
}

publicBlogRouter.get("/categories", (_req, res) => {
  res.json(createSuccessResponse({ categories: listBlogCategories() }, "Blog categories loaded."));
});

publicBlogRouter.get("/authors", async (req, res) => {
  try {
    const limit =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const data = await listPublicBlogAuthors({ limit });
    res.json(createSuccessResponse(data, "Public Blog authors loaded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

publicBlogRouter.get("/", async (req, res) => {
  try {
    const page =
      typeof req.query.page === "string" ? Number.parseInt(req.query.page, 10) : undefined;
    const pageSizeRaw =
      typeof req.query.pageSize === "string"
        ? Number.parseInt(req.query.pageSize, 10)
        : typeof req.query.limit === "string"
          ? Number.parseInt(req.query.limit, 10)
          : undefined;
    const offset =
      typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : undefined;
    const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const includeDiscovery =
      req.query.includeDiscovery === "0" || req.query.includeDiscovery === "false"
        ? false
        : true;

    const data = await listPublicBlogPosts({
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSizeRaw) ? pageSizeRaw : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
      categoryId,
      q,
      includeDiscovery,
    });
    res.json(createSuccessResponse(data, "Public Blog listing loaded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

publicBlogRouter.get("/:slug/comments", async (req, res) => {
  try {
    const limit =
      typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
    const offset =
      typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : undefined;
    const data = await listPublicBlogComments({
      slug: routeParam(req.params.slug),
      limit,
      offset,
    });
    res.json(createSuccessResponse(data, "Blog comments loaded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

publicBlogRouter.post(
  "/:slug/comments",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const authUser = await findAuthUserById(req.auth!.id);
      if (!authUser || authUser.emailVerificationStatus !== "verified") {
        res.status(403).json(failure("Verified email is required to comment."));
        return;
      }
      const identity = await resolveRequestIdentity(req);
      const parentCommentId =
        typeof req.body?.parentCommentId === "string" ? req.body.parentCommentId.trim() : undefined;
      const result = await createBlogComment({
        slug: routeParam(req.params.slug),
        actorParticipantId: identity.participantId,
        content: req.body?.content,
        parentCommentId: parentCommentId || undefined,
      });
      res.status(201).json(
        createSuccessResponse(
          projectOwnCommentCreateResponse(result),
          result.publicMessage ?? "Comment posted.",
        ),
      );
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

publicBlogRouter.patch(
  "/:slug/comments/:commentId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const result = await editBlogComment({
        commentId: routeParam(req.params.commentId),
        actorParticipantId: identity.participantId,
        content: req.body?.content,
      });
      res.json(
        createSuccessResponse(
          projectOwnCommentCreateResponse(result),
          result.publicMessage ?? "Comment updated.",
        ),
      );
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

publicBlogRouter.delete(
  "/:slug/comments/:commentId",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const comment = await deleteOwnBlogComment({
        commentId: routeParam(req.params.commentId),
        actorParticipantId: identity.participantId,
      });
      res.json(
        createSuccessResponse(
          { commentId: comment.commentId, status: comment.status },
          "Comment removed.",
        ),
      );
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

publicBlogRouter.post(
  "/:slug/reactions",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const authUser = await findAuthUserById(req.auth!.id);
      if (!authUser || authUser.emailVerificationStatus !== "verified") {
        res.status(403).json(failure("Verified email is required to react."));
        return;
      }
      const identity = await resolveRequestIdentity(req);
      const reaction =
        typeof req.body?.reaction === "string" ? req.body.reaction.trim() : "none";
      if (reaction !== "helpful" && reaction !== "not_helpful" && reaction !== "none") {
        res.status(400).json(failure("reaction must be helpful, not_helpful, or none."));
        return;
      }
      const data = await setBlogPostReaction({
        slug: routeParam(req.params.slug),
        actorParticipantId: identity.participantId,
        reaction,
      });
      res.json(createSuccessResponse(data, "Blog reaction updated."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

publicBlogRouter.get("/:slug", optionalAuthenticationMiddleware, async (req, res) => {
  try {
    const data = await getPublicBlogPostBySlug(
      routeParam(req.params.slug),
      req.auth?.memberId ?? null,
    );
    res.json(createSuccessResponse(data, "Public Blog post loaded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.post("/posts", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await createBlogDraft({
      actorParticipantId: identity.participantId,
      actorDisplayName: identity.displayName,
      role: identity.role,
      body: req.body,
    });
    res.status(201).json(createSuccessResponse(data, "Blog draft created."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.get("/posts", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await listOwnBlogWorkspacePosts({
      actorParticipantId: identity.participantId,
      role: identity.role,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      limit: typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined,
      offset:
        typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : undefined,
    });
    res.json(createSuccessResponse(data, "Author Blog publications loaded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.get("/posts/:postId", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await getBlogAuthorWorkspacePost({
      postId: routeParam(req.params.postId),
      actorParticipantId: identity.participantId,
      role: identity.role,
    });
    res.json(createSuccessResponse(data, "Blog post loaded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.patch("/posts/:postId", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await updateBlogDraft({
      postId: routeParam(req.params.postId),
      actorParticipantId: identity.participantId,
      role: identity.role,
      body: req.body,
    });
    res.json(createSuccessResponse(data, "Blog post updated."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.get("/posts/:postId/preview", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await previewBlogPost({
      postId: routeParam(req.params.postId),
      actorParticipantId: identity.participantId,
      role: identity.role,
    });
    res.json(createSuccessResponse(data, "Blog post preview loaded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.post("/posts/:postId/submit", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await submitBlogPostForReview({
      postId: routeParam(req.params.postId),
      actorParticipantId: identity.participantId,
      role: identity.role,
    });
    res.json(createSuccessResponse(data, "Blog post submitted for review."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.post("/posts/:postId/withdraw", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await withdrawBlogPostToDraft({
      postId: routeParam(req.params.postId),
      actorParticipantId: identity.participantId,
      role: identity.role,
    });
    res.json(createSuccessResponse(data, "Blog post returned to draft."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.post("/posts/:postId/publish", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const expectedUpdatedAt =
      typeof req.body?.expectedUpdatedAt === "string" ? req.body.expectedUpdatedAt : undefined;
    const reviewNote =
      typeof req.body?.reviewNote === "string" ? req.body.reviewNote : undefined;
    const publicationDate =
      typeof req.body?.publicationDate === "string" ? req.body.publicationDate : undefined;
    // Never accept reviewedByParticipantId from the client.
    const data = await publishBlogPost({
      postId: routeParam(req.params.postId),
      actorParticipantId: identity.participantId,
      role: identity.role,
      expectedUpdatedAt,
      reviewNote,
      publicationDate,
    });
    res.json(createSuccessResponse(data, "Blog post published."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.post(
  "/posts/:postId/publish-after-safety-review",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const reviewNote =
        typeof req.body?.reviewNote === "string" ? req.body.reviewNote : undefined;
      const expectedUpdatedAt =
        typeof req.body?.expectedUpdatedAt === "string" ? req.body.expectedUpdatedAt : undefined;
      const data = await publishBlogPostAfterSafetyReview({
        postId: routeParam(req.params.postId),
        actorParticipantId: identity.participantId,
        role: identity.role,
        reviewNote,
        expectedUpdatedAt,
      });
      res.json(createSuccessResponse(data, "Blog post published after Safety review."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

blogRouter.post("/posts/:postId/archive", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await archiveBlogPost({
      postId: routeParam(req.params.postId),
      actorParticipantId: identity.participantId,
      role: identity.role,
    });
    res.json(createSuccessResponse(data, "Blog post archived."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.post(
  "/posts/:postId/cancel-schedule",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const data = await cancelScheduledBlogPublication({
        postId: routeParam(req.params.postId),
        actorParticipantId: identity.participantId,
        role: identity.role,
      });
      res.json(createSuccessResponse(data, "Scheduled publication cancelled."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

blogRouter.post(
  "/posts/:postId/request-changes",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const reviewNote =
        typeof req.body?.reviewNote === "string" ? req.body.reviewNote : undefined;
      const expectedUpdatedAt =
        typeof req.body?.expectedUpdatedAt === "string" ? req.body.expectedUpdatedAt : undefined;
      const data = await requestBlogPostChanges({
        postId: routeParam(req.params.postId),
        actorParticipantId: identity.participantId,
        role: identity.role,
        reviewNote,
        expectedUpdatedAt,
      });
      res.json(createSuccessResponse(data, "Changes requested on Blog post."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

blogRouter.post(
  "/posts/:postId/decline",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const reviewNote =
        typeof req.body?.reviewNote === "string" ? req.body.reviewNote : undefined;
      const expectedUpdatedAt =
        typeof req.body?.expectedUpdatedAt === "string" ? req.body.expectedUpdatedAt : undefined;
      const data = await declineBlogPost({
        postId: routeParam(req.params.postId),
        actorParticipantId: identity.participantId,
        role: identity.role,
        reviewNote,
        expectedUpdatedAt,
      });
      res.json(createSuccessResponse(data, "Blog post declined."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

blogRouter.get("/editorial/queue", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await listEditorialReviewQueue({
      actorParticipantId: identity.participantId,
      role: identity.role,
      limit: typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined,
      offset:
        typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : undefined,
    });
    res.json(createSuccessResponse(data, "Editorial review queue loaded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.get("/editorial/posts/:postId", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await getEditorialReviewDetail({
      postId: routeParam(req.params.postId),
      actorParticipantId: identity.participantId,
      role: identity.role,
    });
    res.json(createSuccessResponse(data, "Editorial review detail loaded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

/** Pack 07 — minimal comment moderation seam (no second Editorial Console). */
blogRouter.get(
  "/editorial/posts/:postId/pending-comments",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const data = await listPendingBlogCommentsForModeration({
        postId: routeParam(req.params.postId),
        actorParticipantId: identity.participantId,
        role: identity.role,
      });
      res.json(createSuccessResponse({ comments: data }, "Pending Blog comments loaded."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

blogRouter.post(
  "/comments/:commentId/approve",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const data = await approvePendingBlogComment({
        commentId: routeParam(req.params.commentId),
        actorParticipantId: identity.participantId,
        role: identity.role,
      });
      res.json(
        createSuccessResponse(
          { commentId: data.commentId, status: data.status },
          "Blog comment approved.",
        ),
      );
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

blogRouter.post(
  "/comments/:commentId/remove",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const data = await moderateRemoveBlogComment({
        commentId: routeParam(req.params.commentId),
        actorParticipantId: identity.participantId,
        role: identity.role,
      });
      res.json(
        createSuccessResponse(
          { commentId: data.commentId, status: data.status },
          "Blog comment removed.",
        ),
      );
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

blogRouter.get("/authoring", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const data = await getBlogAuthoringAccessState({
      actorParticipantId: identity.participantId,
      role: identity.role,
    });
    res.json(createSuccessResponse(data, "Blog authoring access state."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.post("/author-applications", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    // Participant identity is always taken from JWT — never from the body.
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const { participantId: _ignoredParticipantId, applicantParticipantId: _ignoredApplicant, ...safeBody } =
      body;
    const data = await applyForBlogAuthorCapability({
      actorParticipantId: identity.participantId,
      role: identity.role,
      body: safeBody,
    });
    res.status(201).json(createSuccessResponse(data, "Blog author application recorded."));
  } catch (error) {
    handleBlogError(res, error);
  }
});

blogRouter.post(
  "/author-applications/:applicationId/resubmit",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      const { participantId: _ignoredParticipantId, ...safeBody } = body;
      const data = await resubmitBlogAuthorApplication({
        actorParticipantId: identity.participantId,
        role: identity.role,
        applicationId: routeParam(req.params.applicationId),
        body: safeBody,
      });
      res.json(createSuccessResponse(data, "Blog author application resubmitted."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

blogRouter.post(
  "/author-applications/:applicationId/decide",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const identity = await resolveRequestIdentity(req);
      const decision = typeof req.body?.decision === "string" ? req.body.decision.trim() : "";
      const allowed: readonly BlogAuthorApplicationDecision[] = [
        "mark_under_review",
        "request_changes",
        "approve",
        "decline",
      ];
      if (!allowed.includes(decision as BlogAuthorApplicationDecision)) {
        res.status(400).json(failure("decision must be mark_under_review, request_changes, approve, or decline."));
        return;
      }
      const reviewNote =
        typeof req.body?.reviewNote === "string" ? req.body.reviewNote : undefined;
      const data = await decideBlogAuthorApplication({
        actorParticipantId: identity.participantId,
        role: identity.role,
        applicationId: routeParam(req.params.applicationId),
        decision: decision as BlogAuthorApplicationDecision,
        reviewNote,
      });
      res.json(createSuccessResponse(data, "Blog author application decision recorded."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

/** Pack 13A — Admin Notification Center review modal payload. */
blogRouter.get(
  "/author-applications/:applicationId/admin-review",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await getAdminAuthorApplicationReview({
        actorUserId: req.auth!.id,
        applicationId: routeParam(req.params.applicationId),
      });
      res.json(createSuccessResponse(data, "Author application loaded for Admin review."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

/** Pack 13A — Invite = accept application + grant Author capability. */
blogRouter.post(
  "/author-applications/:applicationId/invite",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await decideBlogAuthorApplicationAsAdmin({
        actorUserId: req.auth!.id,
        applicationId: routeParam(req.params.applicationId),
        decision: "approve",
      });
      res.json(createSuccessResponse(data, "Author application accepted."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

/** Pack 13A — Refuse application without granting Author access. */
blogRouter.post(
  "/author-applications/:applicationId/refuse",
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reviewNote =
        typeof req.body?.reviewNote === "string" ? req.body.reviewNote : undefined;
      const data = await decideBlogAuthorApplicationAsAdmin({
        actorUserId: req.auth!.id,
        applicationId: routeParam(req.params.applicationId),
        decision: "decline",
        reviewNote,
      });
      res.json(createSuccessResponse(data, "Author application refused."));
    } catch (error) {
      handleBlogError(res, error);
    }
  },
);

blogRouter.post("/capabilities/grants", requireJwtAuthenticationMiddleware, async (req, res) => {
  try {
    const identity = await resolveRequestIdentity(req);
    const targetParticipantId =
      typeof req.body?.participantId === "string" ? req.body.participantId.trim() : "";
    const capabilities = Array.isArray(req.body?.capabilities) ? req.body.capabilities : [];

    if (!targetParticipantId) {
      res.status(400).json(failure("participantId is required."));
      return;
    }

    const data = await grantBlogCapabilities({
      actorParticipantId: identity.participantId,
      role: identity.role,
      targetParticipantId,
      capabilities,
    });
    res.json(createSuccessResponse(data, "Blog capabilities granted."));
  } catch (error) {
    handleBlogError(res, error);
  }
});
