import type { NextFunction, Request, Response } from "express";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;

export function clearTranslationRateLimitBucketsForTests(): void {
  buckets.clear();
}

function resolveRateLimitKey(req: Request): string {
  const userId = req.auth?.id ?? req.auth?.memberId;
  if (userId) {
    return `user:${userId}`;
  }
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : (req.socket.remoteAddress ?? "unknown");
  return `ip:${ip}`;
}

export function translationRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = resolveRateLimitKey(req);
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: "Too many translation requests. Please try again later.",
    });
    return;
  }

  existing.count += 1;
  next();
}
