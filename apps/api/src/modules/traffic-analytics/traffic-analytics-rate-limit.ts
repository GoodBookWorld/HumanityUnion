import type { NextFunction, Request, Response } from "express";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

/** ~120 pageviews / IP / minute — human navigation headroom, abuse ceiling. */
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 120;

export function clearTrafficAnalyticsRateLimitBucketsForTests(): void {
  buckets.clear();
}

function resolveClientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : (req.socket.remoteAddress ?? "unknown");

  return `traffic-pageview:${ip}`;
}

export function trafficAnalyticsRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = resolveClientKey(req);
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (existing.count >= MAX_ATTEMPTS) {
    res.status(429).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message: "Too many analytics requests. Please try again later.",
    });
    return;
  }

  existing.count += 1;
  next();
}
