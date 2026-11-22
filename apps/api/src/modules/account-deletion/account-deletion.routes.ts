import { Router, type Response } from "express";

import { createAuthRateLimiter } from "../auth/auth-rate-limit.js";
import { AuthValidationError } from "../auth/auth.errors.js";
import { requireJwtAuthenticationMiddleware } from "../auth/auth.middleware.js";
import { createSuccessResponse } from "../../shared/http-response.js";
import {
  AccountDeletionRejectedError,
  confirmAccountDeletion,
  confirmAccountDeletionCancellation,
  getAccountDeletionStatus,
  requestAccountDeletion,
  requestAccountDeletionCancellation,
} from "./account-deletion.service.js";

const requestRateLimit = createAuthRateLimiter("account-deletion-request");
const confirmRateLimit = createAuthRateLimiter("account-deletion-confirm");
const statusRateLimit = createAuthRateLimiter("account-deletion-status");
const cancelRequestRateLimit = createAuthRateLimiter("account-deletion-cancel-request");
const cancelConfirmRateLimit = createAuthRateLimiter("account-deletion-cancel-confirm");

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sendDeletionError(res: Response, error: unknown): void {
  if (error instanceof AccountDeletionRejectedError) {
    const status =
      error.code === "not_found"
        ? 404
        : error.code === "mail_failed"
          ? 503
          : error.code === "unavailable"
            ? 403
            : error.code === "invalid_code" || error.code === "invalid_password"
              ? 400
              : 409;
    res.status(status).json({
      success: false,
      data: null,
      meta: { code: error.code },
      links: {},
      message: error.message,
    });
    return;
  }
  if (error instanceof AuthValidationError) {
    res.status(400).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: error.message,
    });
    return;
  }
  res.status(500).json({
    success: false,
    data: null,
    meta: {},
    links: {},
    message: "Account deletion request failed.",
  });
}

export const accountDeletionRouter = Router();

accountDeletionRouter.get(
  "/",
  statusRateLimit,
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const status = await getAccountDeletionStatus(req.auth!.id);
      res.status(200).json(createSuccessResponse(status));
    } catch (error) {
      sendDeletionError(res, error);
    }
  },
);

accountDeletionRouter.post(
  "/request",
  requestRateLimit,
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const status = await requestAccountDeletion({
        userId: req.auth!.id,
        currentPassword: readString((req.body as { currentPassword?: unknown })?.currentPassword),
      });
      res.status(200).json(createSuccessResponse(status, "Confirmation code sent."));
    } catch (error) {
      sendDeletionError(res, error);
    }
  },
);

accountDeletionRouter.post(
  "/confirm",
  confirmRateLimit,
  requireJwtAuthenticationMiddleware,
  async (req, res) => {
    try {
      const status = await confirmAccountDeletion({
        userId: req.auth!.id,
        code: readString((req.body as { code?: unknown })?.code),
      });
      res.status(200).json(createSuccessResponse(status, "Account deletion is scheduled."));
    } catch (error) {
      sendDeletionError(res, error);
    }
  },
);

export const accountDeletionCancellationRouter = Router();

accountDeletionCancellationRouter.post("/cancel/request", cancelRequestRateLimit, async (req, res) => {
  try {
    const result = await requestAccountDeletionCancellation(
      readString((req.body as { email?: unknown })?.email),
    );
    res.status(200).json(createSuccessResponse(result, result.message));
  } catch (error) {
    sendDeletionError(res, error);
  }
});

accountDeletionCancellationRouter.post("/cancel/confirm", cancelConfirmRateLimit, async (req, res) => {
  try {
    const body = req.body as { email?: unknown; currentPassword?: unknown; code?: unknown };
    const result = await confirmAccountDeletionCancellation({
      email: readString(body?.email),
      currentPassword: readString(body?.currentPassword),
      code: readString(body?.code),
    });
    res.status(200).json(createSuccessResponse(result, result.message));
  } catch (error) {
    sendDeletionError(res, error);
  }
});
