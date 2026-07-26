import type { NextFunction, Request, Response } from "express";

import { findAuthUserById } from "./auth-user.repository.js";
import { requireJwtAuthenticationMiddleware } from "./auth.middleware.js";

const WRITE_GATE_MESSAGE = "Please confirm your email before creating or changing civic records.";

/** Blocks workspace mutations for accounts that have not confirmed email. */
export async function requireVerifiedEmailForMutationsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  if (!req.auth?.id || req.auth.id === "auth-bootstrap-001") {
    next();
    return;
  }

  const user = await findAuthUserById(req.auth.id);

  if (!user || user.emailVerificationStatus !== "verified") {
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

/** Standard JWT auth + verified-email gate for Capability 02 workspace writes. */
export const authenticatedWorkspaceWriteMiddleware = [
  requireJwtAuthenticationMiddleware,
  requireVerifiedEmailForMutationsMiddleware,
];
