import type { NextFunction, Request, Response } from "express";

import { environment } from "../../config/environment.js";

const MEDIA_CACHE_CONTROL = "public, max-age=3600";

export function mediaStaticHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", environment.corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", MEDIA_CACHE_CONTROL);
  next();
}
