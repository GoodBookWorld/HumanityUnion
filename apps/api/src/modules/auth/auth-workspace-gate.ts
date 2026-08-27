import type { NextFunction, Request, Response } from "express";

import {
  ACCOUNT_ACCESS_SUSPENDED_MESSAGE,
  isMutatingHttpMethod,
  loadAuthUserForActiveGate,
} from "./auth-active-account-gate.js";
import { requireJwtAuthenticationMiddleware } from "./auth.middleware.js";

const WRITE_GATE_MESSAGE = "Please confirm your email before creating or changing civic records.";

/**
 * Blocks workspace mutations for accounts that are not active or have not confirmed email.
 * Pack 24B.1 — auth_users.status === "active" is required before the verified-email check.
 */
export async function requireVerifiedEmailForMutationsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isMutatingHttpMethod(req.method)) {
    next();
    return;
  }

  if (!req.auth?.id || req.auth.id === "auth-bootstrap-001") {
    next();
    return;
  }

  const user = await loadAuthUserForActiveGate(req.auth.id);

  if (!user || user.status !== "active") {
    res.status(403).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: ACCOUNT_ACCESS_SUSPENDED_MESSAGE,
    });
    return;
  }

  if (user.emailVerificationStatus !== "verified") {
    res.status(403).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: WRITE_GATE_MESSAGE,
    });
    return;
  }

  next();
}

/**
 * Standard JWT auth + active-account + verified-email gate for Capability 02 workspace writes.
 * JWT middleware already rechecks active status on mutations (Pack 24B.1); email gate
 * revalidates status on the same user load used for email verification.
 */
export const authenticatedWorkspaceWriteMiddleware = [
  requireJwtAuthenticationMiddleware,
  requireVerifiedEmailForMutationsMiddleware,
];

export {
  ACCOUNT_ACCESS_SUSPENDED_MESSAGE,
  requireActiveAccountForMutationsMiddleware,
  setAuthUserLookupOverrideForTests,
} from "./auth-active-account-gate.js";
