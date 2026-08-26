import { Router, type Response } from "express";

import type {
  AdminAuthorDirectoryStatusFilter,
  AdminPublicationDirectoryStatusFilter,
} from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import {
  BlogConflictError,
  BlogNotFoundError,
} from "./blog.errors.js";
import {
  blockAdminAuthor,
  blockAdminPublication,
  listAdminAuthors,
  listAdminPublications,
  setAdminAuthorTrustedPublishing,
  unblockAdminAuthor,
  unblockAdminPublication,
} from "./admin-publishing.service.js";
import {
  listAdminPendingAuthorApplications,
  markInvalidLegacyAuthorApplicationForResubmit,
  reconcilePendingAuthorApplications,
} from "./blog-author-application-reconciliation.js";
import {
  listAdminPendingPublicationReviews,
  reconcilePendingPublicationReviews,
} from "./blog-publication-review-reconciliation.js";
import { BlogValidationError } from "./blog.errors.js";

export const adminPublishingRouter = Router();

function createFailureResponse(message: string) {
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

function resolveErrorStatus(error: unknown): number {
  if (error instanceof AdministrationUnauthorizedError) {
    return 401;
  }
  if (error instanceof AdministrationForbiddenError) {
    return 403;
  }
  if (error instanceof AdministrationValidationError) {
    return 400;
  }
  if (error instanceof BlogNotFoundError) {
    return 404;
  }
  if (error instanceof BlogConflictError) {
    return 409;
  }
  if (error instanceof BlogValidationError) {
    return 400;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin Publishing request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function parseAuthorStatus(value: unknown): AdminAuthorDirectoryStatusFilter | undefined {
  if (value === "active" || value === "blocked" || value === "all") {
    return value;
  }
  return undefined;
}

function parsePublicationStatus(
  value: unknown,
): AdminPublicationDirectoryStatusFilter | undefined {
  if (
    value === "all" ||
    value === "draft" ||
    value === "scheduled" ||
    value === "published" ||
    value === "blocked" ||
    value === "submitted_for_review" ||
    value === "archived"
  ) {
    return value;
  }
  return undefined;
}

adminPublishingRouter.get(
  "/authors",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await listAdminAuthors({
        actorUserId: req.auth!.id,
        status: parseAuthorStatus(req.query.status),
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(createSuccessResponse(data, "Authors directory loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.get(
  "/author-applications/pending",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await listAdminPendingAuthorApplications({
        actorUserId: req.auth!.id,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(createSuccessResponse(data, "Pending Author applications loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/author-applications/reconcile",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await reconcilePendingAuthorApplications({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(data, "Pending Author applications reconciled."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/author-applications/:applicationId/recovery-reset",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const data = await markInvalidLegacyAuthorApplicationForResubmit({
        actorUserId: req.auth!.id,
        applicationId: routeParam(req.params.applicationId),
        reason,
      });
      res.json(createSuccessResponse(data, "Invalid application marked for Participant resubmit."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/authors/:participantId/block",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const data = await blockAdminAuthor({
        actorUserId: req.auth!.id,
        participantId: routeParam(req.params.participantId),
        reason,
      });
      res.json(createSuccessResponse(data, "Author blocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/authors/:participantId/unblock",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const data = await unblockAdminAuthor({
        actorUserId: req.auth!.id,
        participantId: routeParam(req.params.participantId),
        reason,
      });
      res.json(createSuccessResponse(data, "Author unblocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** Pack 16G — Admin Trusted Publishing toggle (publish without manual review). */
adminPublishingRouter.patch(
  "/authors/:participantId/trusted-publishing",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      if (typeof req.body?.publishWithoutManualReview !== "boolean") {
        throw new AdministrationValidationError(
          "publishWithoutManualReview (boolean) is required.",
        );
      }
      const data = await setAdminAuthorTrustedPublishing({
        actorUserId: req.auth!.id,
        participantId: routeParam(req.params.participantId),
        publishWithoutManualReview: req.body.publishWithoutManualReview,
      });
      res.json(
        createSuccessResponse(
          data,
          data.publishWithoutManualReview
            ? "Trusted Publishing enabled."
            : "Trusted Publishing disabled.",
        ),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.get(
  "/publications/pending-review",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await listAdminPendingPublicationReviews({
        actorUserId: req.auth!.id,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(createSuccessResponse(data, "Pending publication reviews loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/publications/reconcile-review-notifications",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await reconcilePendingPublicationReviews({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(data, "Pending publication review notifications reconciled."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.get(
  "/publications",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const data = await listAdminPublications({
        actorUserId: req.auth!.id,
        status: parsePublicationStatus(req.query.status),
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(createSuccessResponse(data, "Publications directory loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/publications/:postId/block",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const data = await blockAdminPublication({
        actorUserId: req.auth!.id,
        postId: routeParam(req.params.postId),
        reason,
      });
      res.json(createSuccessResponse(data, "Publication blocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/publications/:postId/unblock",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const data = await unblockAdminPublication({
        actorUserId: req.auth!.id,
        postId: routeParam(req.params.postId),
        reason,
      });
      res.json(createSuccessResponse(data, "Publication unblocked."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** Pack 16F — Publication Categories management */
adminPublishingRouter.get(
  "/categories",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { listAdminBlogCategories } = await import("./blog-category-admin.service.js");
      const data = await listAdminBlogCategories({ actorUserId: req.auth!.id });
      res.json(createSuccessResponse(data, "Publication categories loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/categories",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { createAdminBlogCategory } = await import("./blog-category-admin.service.js");
      const data = await createAdminBlogCategory({
        actorUserId: req.auth!.id,
        body: req.body,
      });
      res.status(201).json(createSuccessResponse(data, "Publication category created."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/categories/reorder",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { reorderAdminBlogCategories } = await import("./blog-category-admin.service.js");
      const data = await reorderAdminBlogCategories({
        actorUserId: req.auth!.id,
        body: req.body,
      });
      res.json(createSuccessResponse(data, "Publication category order updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.patch(
  "/categories/:categoryId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { updateAdminBlogCategory } = await import("./blog-category-admin.service.js");
      const data = await updateAdminBlogCategory({
        actorUserId: req.auth!.id,
        categoryId: routeParam(req.params.categoryId),
        body: req.body,
      });
      res.json(createSuccessResponse(data, "Publication category updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/categories/:categoryId/activate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { activateAdminBlogCategory } = await import("./blog-category-admin.service.js");
      const data = await activateAdminBlogCategory({
        actorUserId: req.auth!.id,
        categoryId: routeParam(req.params.categoryId),
      });
      res.json(createSuccessResponse(data, "Publication category activated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.post(
  "/categories/:categoryId/deactivate",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { deactivateAdminBlogCategory } = await import("./blog-category-admin.service.js");
      const data = await deactivateAdminBlogCategory({
        actorUserId: req.auth!.id,
        categoryId: routeParam(req.params.categoryId),
      });
      res.json(createSuccessResponse(data, "Publication category deactivated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.delete(
  "/categories/:categoryId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { deleteAdminBlogCategory } = await import("./blog-category-admin.service.js");
      const reassignToCategoryId =
        typeof req.body?.reassignToCategoryId === "string"
          ? req.body.reassignToCategoryId
          : typeof req.query.reassignToCategoryId === "string"
            ? req.query.reassignToCategoryId
            : undefined;
      const data = await deleteAdminBlogCategory({
        actorUserId: req.auth!.id,
        categoryId: routeParam(req.params.categoryId),
        reassignToCategoryId,
      });
      res.json(createSuccessResponse(data, "Publication category deleted."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** Pack 21B — Blog subscription Welcome Message settings */
adminPublishingRouter.get(
  "/subscription-settings",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { getAdminBlogSubscriptionSettings } = await import(
        "./blog-subscription-settings.admin.service.js"
      );
      const data = await getAdminBlogSubscriptionSettings({ actorUserId: req.auth!.id });
      res.json(createSuccessResponse(data, "Blog subscription settings loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.patch(
  "/subscription-settings",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { updateAdminBlogSubscriptionSettings } = await import(
        "./blog-subscription-settings.admin.service.js"
      );
      const data = await updateAdminBlogSubscriptionSettings({
        actorUserId: req.auth!.id,
        body: req.body,
      });
      res.json(createSuccessResponse(data, "Blog subscription settings updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** Pack 21C — Admin Blog subscriber directory */
adminPublishingRouter.get(
  "/subscribers",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { listAdminBlogSubscribers } = await import("./blog-subscription-admin.service.js");
      const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
      const status =
        statusRaw === "not_confirmed" ||
        statusRaw === "subscribed" ||
        statusRaw === "unsubscribed" ||
        statusRaw === "all"
          ? statusRaw
          : undefined;
      const data = await listAdminBlogSubscribers({
        actorUserId: req.auth!.id,
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        status,
        limit:
          typeof req.query.limit === "string" && req.query.limit.trim()
            ? Number(req.query.limit)
            : undefined,
        offset:
          typeof req.query.offset === "string" && req.query.offset.trim()
            ? Number(req.query.offset)
            : undefined,
      });
      res.json(createSuccessResponse(data, "Blog subscribers loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** Pack 21G — Admin manual subscriber add */
adminPublishingRouter.post(
  "/subscribers",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { adminManualAddBlogSubscriber } = await import(
        "./blog-subscription-admin.service.js"
      );
      const data = await adminManualAddBlogSubscriber({
        actorUserId: req.auth!.id,
        body: req.body,
      });
      res.status(data.created ? 201 : 200).json(createSuccessResponse(data, data.message));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPublishingRouter.delete(
  "/subscribers/:subscriberId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { removeAdminBlogSubscriber } = await import("./blog-subscription-admin.service.js");
      const data = await removeAdminBlogSubscriber({
        actorUserId: req.auth!.id,
        subscriberId: routeParam(req.params.subscriberId),
      });
      res.json(createSuccessResponse(data, "Subscriber removed from Blog subscription emails."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

/** Pack 21E — queue Admin selected-subscriber message */
adminPublishingRouter.post(
  "/subscribers/messages",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { queueAdminBlogSubscriberMessage } = await import(
        "./blog-subscription-admin-message.service.js"
      );
      const data = await queueAdminBlogSubscriberMessage({
        actorUserId: req.auth!.id,
        body: req.body,
      });
      res.status(202).json(createSuccessResponse(data, data.message));
    } catch (error) {
      handleError(res, error);
    }
  },
);
