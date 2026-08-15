import type { NextFunction, Request, Response } from "express";

import { environment } from "../../config/environment.js";
import { isAllowedWebOrigin } from "../../config/web-origins.js";

const MEDIA_CACHE_CONTROL = "public, max-age=3600";

export function mediaStaticHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  const allowOrigin = isAllowedWebOrigin(requestOrigin) ? requestOrigin : environment.corsOrigin;
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", MEDIA_CACHE_CONTROL);
  next();
}
