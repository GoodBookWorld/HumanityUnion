import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  emailAdminMemberBadgeLabel,
  getAdminMemberBadgeLabelPdfBuffer,
  getAdminMemberBadgeOrderDetail,
  updateAdminMemberBadgeFulfillment,
} from "./member-badge-application-fulfillment.service.js";
import {
  MemberBadgeApplicationAccessDeniedError,
  MemberBadgeApplicationConflictError,
  MemberBadgeApplicationNotFoundError,
  MemberBadgeApplicationUnavailableError,
  MemberBadgeApplicationValidationError,
} from "./member-badge-application.errors.js";

const adminMemberBadgeApplicationRouter = Router();

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
  if (error instanceof AdministrationUnauthorizedError) {
    return 401;
  }

  if (
    error instanceof AdministrationForbiddenError ||
    error instanceof MemberBadgeApplicationAccessDeniedError
  ) {
    return 403;
  }

  if (error instanceof MemberBadgeApplicationValidationError) {
    return 400;
  }

  if (error instanceof MemberBadgeApplicationNotFoundError) {
    return 404;
  }

  if (error instanceof MemberBadgeApplicationConflictError) {
    return 409;
  }

  if (error instanceof MemberBadgeApplicationUnavailableError) {
    return 503;
  }

  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : "Admin Member Badge Application request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

function parseFulfillmentBody(body: unknown): { shipped?: boolean; delivered?: boolean } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new MemberBadgeApplicationValidationError("Request body must be an object.");
  }

  const record = body as Record<string, unknown>;
  const patch: { shipped?: boolean; delivered?: boolean } = {};

  if ("shipped" in record) {
    if (typeof record.shipped !== "boolean") {
      throw new MemberBadgeApplicationValidationError("shipped must be a boolean.");
    }
    patch.shipped = record.shipped;
  }

  if ("delivered" in record) {
    if (typeof record.delivered !== "boolean") {
      throw new MemberBadgeApplicationValidationError("delivered must be a boolean.");
    }
    patch.delivered = record.delivered;
  }

  return patch;
}

adminMemberBadgeApplicationRouter.get(
  "/:applicationId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const payload = await getAdminMemberBadgeOrderDetail({
        actorUserId: req.auth!.id,
        applicationId: String(req.params.applicationId ?? ""),
      });
      res.json(createSuccessResponse(payload, "Member Badge order loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminMemberBadgeApplicationRouter.patch(
  "/:applicationId/fulfillment",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const patch = parseFulfillmentBody(req.body);
      const payload = await updateAdminMemberBadgeFulfillment({
        actorUserId: req.auth!.id,
        applicationId: String(req.params.applicationId ?? ""),
        patch,
      });
      res.json(createSuccessResponse(payload, "Member Badge fulfillment updated."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminMemberBadgeApplicationRouter.post(
  "/:applicationId/email-label",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const payload = await emailAdminMemberBadgeLabel({
        actorUserId: req.auth!.id,
        applicationId: String(req.params.applicationId ?? ""),
      });
      res.json(createSuccessResponse(payload, payload.message));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminMemberBadgeApplicationRouter.get(
  "/:applicationId/label.pdf",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const { buffer, filename } = await getAdminMemberBadgeLabelPdfBuffer({
        actorUserId: req.auth!.id,
        applicationId: String(req.params.applicationId ?? ""),
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.status(200).send(buffer);
    } catch (error) {
      handleError(res, error);
    }
  },
);

export { adminMemberBadgeApplicationRouter };
