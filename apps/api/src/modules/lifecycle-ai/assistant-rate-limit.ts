import { createHash } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { resolveLifecycleAiConfig } from "./lifecycle-ai.config.js";
import { LifecycleAiError } from "./lifecycle-ai.errors.js";

interface MinuteBucket {
  count: number;
  resetAt: number;
}

interface DayBucket {
  count: number;
  dayKey: string;
}

interface DuplicateEntry {
  expiresAt: number;
}

const minuteBuckets = new Map<string, MinuteBucket>();
const dayBuckets = new Map<string, DayBucket>();
const duplicateBuckets = new Map<string, DuplicateEntry>();

function dayKeyUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function resolveParticipantKey(req: Request): string {
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

export function clearAssistantRateLimitBucketsForTests(): void {
  minuteBuckets.clear();
  dayBuckets.clear();
  duplicateBuckets.clear();
}

/**
 * Cost-protection gate for POST /assist.
 * Per-user minute + day limits and short-window duplicate rejection.
 */
export function assistantAssistRateLimiter(req: Request, res: Response, next: NextFunction): void {
  try {
    assertAssistantAssistWithinLimits(req);
    next();
  } catch (error) {
    if (error instanceof LifecycleAiError && error.code === "rate_limited") {
      res.status(429).json({
        success: false,
        data: null,
        meta: {},
        links: {},
        message: error.publicMessage,
      });
      return;
    }
    next(error);
  }
}

export function assertAssistantAssistWithinLimits(req: Request): void {
  const config = resolveLifecycleAiConfig();
  const key = resolveParticipantKey(req);
  const now = Date.now();

  const minute = minuteBuckets.get(key);
  if (!minute || minute.resetAt <= now) {
    minuteBuckets.set(key, { count: 1, resetAt: now + 60_000 });
  } else if (minute.count >= config.maxRequestsPerMinute) {
    throw new LifecycleAiError("rate_limited", "per-minute assistant budget exceeded");
  } else {
    minute.count += 1;
  }

  const today = dayKeyUtc(new Date(now));
  const day = dayBuckets.get(key);
  if (!day || day.dayKey !== today) {
    dayBuckets.set(key, { count: 1, dayKey: today });
  } else if (day.count >= config.maxRequestsPerDay) {
    throw new LifecycleAiError("rate_limited", "per-day assistant budget exceeded");
  } else {
    day.count += 1;
  }

  const body = req.body as {
    operation?: unknown;
    instructions?: unknown;
    surfaceId?: unknown;
    initiativeId?: unknown;
  };
  const fingerprintSource = [
    key,
    String(body.surfaceId ?? ""),
    String(body.operation ?? ""),
    String(body.initiativeId ?? ""),
    String(body.instructions ?? "").trim().toLowerCase(),
  ].join("|");
  const fingerprint = createHash("sha256").update(fingerprintSource).digest("hex").slice(0, 24);
  const duplicateKey = `dup:${fingerprint}`;
  const existing = duplicateBuckets.get(duplicateKey);
  if (existing && existing.expiresAt > now) {
    throw new LifecycleAiError("rate_limited", "duplicate rapid assistant request");
  }
  duplicateBuckets.set(duplicateKey, {
    expiresAt: now + config.duplicateRequestWindowMs,
  });
}
