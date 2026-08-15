import type { NextFunction, Request, Response } from "express";

/**
 * UX Evolution Pack 03 Part 8 — abuse prevention for the media upload /
 * video-link endpoints. Mirrors the existing in-memory bucket pattern used
 * by `auth-rate-limit.ts`, but scoped to the authenticated user id (these
 * routes already require `requireJwtAuthenticationMiddleware`) rather than
 * IP, with limits sized for occasional cover-media changes rather than
 * frequent auth attempts.
 */

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

export function clearMediaUploadRateLimitBucketsForTests(): void {
  buckets.clear();
}

function resolveRateLimitKey(req: Request): string {
  const userId = req.auth?.id;

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

export function mediaUploadRateLimiter(req: Request, res: Response, next: NextFunction): void {
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
      message: "Too many media changes. Please try again later.",
    });
    return;
  }

  existing.count += 1;
  next();
}
