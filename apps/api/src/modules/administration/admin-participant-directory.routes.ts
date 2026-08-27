import { Router, type Response } from "express";
import type { MembershipStatus } from "@hu/types";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";
import {
  AdminParticipantDirectoryValidationError,
  AdminParticipantNotFoundError,
  AdminParticipantPublicProfileUnavailableError,
  listAdminParticipants,
  resolveAdminParticipantPublicProfile,
} from "./admin-participant-directory.service.js";

const adminParticipantDirectoryRouter = Router();

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

  if (error instanceof AdministrationForbiddenError) {
    return 403;
  }

  if (error instanceof AdminParticipantDirectoryValidationError) {
    return 400;
  }

  if (error instanceof AdminParticipantNotFoundError) {
    return 404;
  }

  if (error instanceof AdminParticipantPublicProfileUnavailableError) {
    return 404;
  }

  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Admin Participant directory request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

const MEMBERSHIP_STATUSES: readonly MembershipStatus[] = [
  "not_started",
  "application_started",
  "application_completed",
  "pending_payment",
  "manual_review",
  "active_member",
  "payment_refunded",
  "payment_disputed",
  "technical_error",
];

adminParticipantDirectoryRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const status =
        req.query.status === "active" || req.query.status === "disabled"
          ? req.query.status
          : undefined;
      const role =
        req.query.role === "member" || req.query.role === "admin" ? req.query.role : undefined;
      const membershipStatusRaw =
        typeof req.query.membershipStatus === "string" ? req.query.membershipStatus : undefined;
      const membershipStatus =
        membershipStatusRaw &&
        MEMBERSHIP_STATUSES.includes(membershipStatusRaw as MembershipStatus)
          ? (membershipStatusRaw as MembershipStatus)
          : undefined;

      const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "createdAt";
      const sort =
        sortRaw === "createdAt" || sortRaw === "lastLoginAt" || sortRaw === "email"
          ? sortRaw
          : "createdAt";
      const order = req.query.order === "asc" ? "asc" : "desc";
      const limit =
        typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 25;
      const offset =
        typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : 0;

      const result = await listAdminParticipants({
        actorUserId: req.auth!.id,
        search,
        status,
        role,
        membershipStatus,
        sort,
        order,
        limit,
        offset,
      });

      res.json(createSuccessResponse(result, "Admin Participant directory loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

/**
 * Pack 24A — Admin-only resolve of CURRENT `/member/{publicName}`.
 * Path uses stable Participant memberId; never embeds a stale uniqueName.
 */
adminParticipantDirectoryRouter.get(
  "/:participantId/public-profile",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await resolveAdminParticipantPublicProfile({
        actorUserId: req.auth!.id,
        participantId: String(req.params.participantId ?? ""),
      });
      res.json(createSuccessResponse(result, "Public profile resolved."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminParticipantDirectoryRouter;
