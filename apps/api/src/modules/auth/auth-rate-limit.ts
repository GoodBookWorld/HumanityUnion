import type { NextFunction, Request, Response } from "express";

import { resolveAuthRateLimitConfig } from "../../config/auth.config.js";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export function clearAuthRateLimitBucketsForTests(): void {
  buckets.clear();
}

function resolveClientKey(req: Request, scope: string): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : (req.socket.remoteAddress ?? "unknown");

  return `${scope}:${ip}`;
}

export function createAuthRateLimiter(scope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const config = resolveAuthRateLimitConfig();
    const key = resolveClientKey(req, scope);
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      next();
      return;
    }

    if (existing.count >= config.maxAttempts) {
      res.status(429).json({
        success: false,
        data: null,
        meta: {},
        links: {},
        message: "Too many attempts. Please try again later.",
      });
      return;
    }

    existing.count += 1;
    next();
  };
}
