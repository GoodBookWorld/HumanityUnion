import { Router, type Response } from "express";

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
  PlatformSocialAccountNotFoundError,
  PlatformSocialAccountPersistenceError,
  PlatformSocialAccountValidationError,
} from "./platform-social-accounts.errors.js";
import {
  listAdminPlatformSocialAccounts,
  upsertAdminPlatformSocialAccount,
} from "./platform-social-accounts.service.js";

const adminPlatformSocialAccountsRouter = Router();

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
  if (error instanceof PlatformSocialAccountNotFoundError) {
    return 404;
  }
  if (
    error instanceof PlatformSocialAccountValidationError ||
    error instanceof AdministrationValidationError
  ) {
    return 400;
  }
  if (error instanceof PlatformSocialAccountPersistenceError) {
    return 503;
  }
  return 500;
}

function handleError(res: Response, error: unknown): void {
  const message =
    error instanceof Error ? error.message : "Platform social accounts request failed.";
  res.status(resolveErrorStatus(error)).json(createFailureResponse(message));
}

adminPlatformSocialAccountsRouter.get(
  "/",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const result = await listAdminPlatformSocialAccounts({
        actorUserId: req.auth!.id,
      });
      res.json(createSuccessResponse(result, "Platform social accounts loaded."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

adminPlatformSocialAccountsRouter.put(
  "/:networkId",
  authenticationMiddleware,
  requireAuthenticationMiddleware,
  async (req, res) => {
    try {
      const networkId = Array.isArray(req.params.networkId)
        ? req.params.networkId[0]
        : req.params.networkId;
      const account = await upsertAdminPlatformSocialAccount({
        actorUserId: req.auth!.id,
        networkId: networkId ?? "",
        body: req.body,
      });
      res.json(createSuccessResponse(account, "Platform social account saved."));
    } catch (error) {
      handleError(res, error);
    }
  },
);

export default adminPlatformSocialAccountsRouter;
