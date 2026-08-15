import type { NextFunction, Request, Response } from "express";

import { isAllowedWebOrigin } from "../../config/web-origins.js";

/**
 * Launch Readiness Pack 07 — CSRF defense-in-depth for browser credentialed
 * mutations. SameSite=Lax already blocks most cross-site cookie sends; this
 * additionally rejects state-changing requests whose `Origin` is present and
 * not an allowed Humanity Union Web origin.
 *
 * Launch Blocker Recovery Pack 01 — allowlist is shared with CORS
 * (`isAllowedWebOrigin`), including development loopback ports.
 *
 * Non-browser clients (API tests, scripts) typically omit `Origin` and pass.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isWebhookPath(path: string): boolean {
  return path.startsWith("/api/v1/webhooks/");
}

export function browserOriginGuardMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const method = req.method.toUpperCase();

  if (SAFE_METHODS.has(method) || isWebhookPath(req.path)) {
    next();
    return;
  }

  const originHeader = req.headers.origin;

  if (typeof originHeader !== "string" || originHeader.trim().length === 0) {
    next();
    return;
  }

  const origin = originHeader.trim();

  if (isAllowedWebOrigin(origin)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    data: null,
    meta: {
      code: "AUTH_ORIGIN_FORBIDDEN",
    },
    links: {},
    message: "Request origin is not allowed.",
  });
}
