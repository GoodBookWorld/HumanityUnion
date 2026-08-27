import { Router, type Response } from "express";

import { createSuccessResponse } from "../../shared/http-response.js";
import {
  authenticationMiddleware,
  requireAuthenticationMiddleware,
} from "../auth/auth.middleware.js";
import {
  BetaInviteAdminRequiredError,
  BetaInviteNotFoundError,
  BetaInviteValidationError,
} from "./beta-invite.errors.js";
import {
  createBetaInviteForAdmin,
  listBetaInvitesForAdmin,
  revokeBetaInviteForAdmin,
} from "./beta-invite.service.js";

const betaInviteRouter = Router();

function createFailureResponse(message: string) {
  return {
    success: false,
    data: null,
    meta: {},
    links: {},
    message,
  };
}

function resolveBetaInviteErrorStatus(error: unknown): number {
  if (error instanceof BetaInviteAdminRequiredError) {
    return 403;
  }

  if (error instanceof BetaInviteNotFoundError) {
    return 404;
  }

  if (error instanceof BetaInviteValidationError) {
    return 400;
  }

  return 500;
}

function handleBetaInviteError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Beta invite request failed.";
  res.status(resolveBetaInviteErrorStatus(error)).json(createFailureResponse(message));
}

betaInviteRouter.post(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    const body = req.body as { email?: unknown };

    try {
      const result = await createBetaInviteForAdmin({
        email: String(body.email ?? ""),
        createdBy: req.auth!.id,
      });

      res.status(201).json(
        createSuccessResponse(
          {
            invite: result.invite,
            code: result.code,
          },
          "Beta invite created.",
        ),
      );
    } catch (error) {
      handleBetaInviteError(res, error);
    }
  },
);

betaInviteRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const invites = await listBetaInvitesForAdmin(req.auth!.id);
      res.json(createSuccessResponse({ invites }, "Beta invites loaded."));
    } catch (error) {
      handleBetaInviteError(res, error);
    }
  },
);

betaInviteRouter.post(
  "/:inviteId/revoke",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const invite = await revokeBetaInviteForAdmin({
        inviteId: String(req.params.inviteId ?? ""),
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse({ invite }, "Beta invite revoked."));
    } catch (error) {
      handleBetaInviteError(res, error);
    }
  },
);

export default betaInviteRouter;
