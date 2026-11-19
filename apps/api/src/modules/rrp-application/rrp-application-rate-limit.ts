/**
 * HU-RRP-FINAL-01B — in-process rate limits for RRP write endpoints.
 *
 * Mirrors `media-upload-rate-limit.ts` / `auth-rate-limit.ts` bucket pattern.
 * No new dependencies. Scoped by authenticated user id (routes already require JWT).
 * GET/read routes are not covered — only state-changing participant/admin writes.
 *
 * Finding from HU-RRP-FINAL-01A: no global Express limiter and auth limiter does not
 * cover `/api/v1/rrp-applications` or `/api/v1/admin/rrp-applications` writes.
 */

import type { NextFunction, Request, Response } from "express";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const participantBuckets = new Map<string, RateLimitBucket>();
const adminBuckets = new Map<string, RateLimitBucket>();

/** Participant draft/submit/withdraw: allow iterative editing + retries. */
const PARTICIPANT_WINDOW_MS = 10 * 60 * 1000;
const PARTICIPANT_MAX_PER_WINDOW = 40;

/** Admin review/confirm: higher ceiling for legitimate directory workflows. */
const ADMIN_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_MAX_PER_WINDOW = 80;

let nowMsOverrideForTests: number | null = null;

export function setRrpApplicationRateLimitNowMsForTests(value: number | null): void {
  nowMsOverrideForTests = value;
}

export function clearRrpApplicationRateLimitBucketsForTests(): void {
  participantBuckets.clear();
  adminBuckets.clear();
  nowMsOverrideForTests = null;
}

function nowMs(): number {
  return nowMsOverrideForTests ?? Date.now();
}

function resolveUserKey(req: Request, scope: "participant" | "admin"): string {
  const userId = req.auth?.id?.trim();
  if (userId) {
    return `${scope}:user:${userId}`;
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : (req.socket.remoteAddress ?? "unknown");
  return `${scope}:ip:${ip || "unknown"}`;
}

function enforceBucket(input: {
  buckets: Map<string, RateLimitBucket>;
  key: string;
  windowMs: number;
  maxPerWindow: number;
  message: string;
  req: Request;
  res: Response;
  next: NextFunction;
}): void {
  const { buckets, key, windowMs, maxPerWindow, message, res, next } = input;
  const now = nowMs();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (existing.count >= maxPerWindow) {
    res.status(429).json({
      success: false,
      data: null,
      meta: {},
      links: {},
      message,
    });
    return;
  }

  existing.count += 1;
  next();
}

/**
 * Participant write limiter — POST create, PATCH draft, submit, withdraw.
 */
export function rrpParticipantWriteRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  enforceBucket({
    buckets: participantBuckets,
    key: resolveUserKey(req, "participant"),
    windowMs: PARTICIPANT_WINDOW_MS,
    maxPerWindow: PARTICIPANT_MAX_PER_WINDOW,
    message: "Too many Regional Representative application changes. Please try again later.",
    req,
    res,
    next,
  });
}

/**
 * Admin write limiter — review, confirm-appointment (and message-intent side effects).
 * Appointment revoke has no public HTTP route yet; repository helper is internal-only.
 */
export function rrpAdminWriteRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  enforceBucket({
    buckets: adminBuckets,
    key: resolveUserKey(req, "admin"),
    windowMs: ADMIN_WINDOW_MS,
    maxPerWindow: ADMIN_MAX_PER_WINDOW,
    message: "Too many Regional Representative admin actions. Please try again later.",
    req,
    res,
    next,
  });
}

/** Test helpers — expose configured ceilings without exporting magic numbers twice. */
export const RRP_PARTICIPANT_WRITE_RATE_LIMIT_FOR_TESTS = {
  windowMs: PARTICIPANT_WINDOW_MS,
  maxPerWindow: PARTICIPANT_MAX_PER_WINDOW,
} as const;

export const RRP_ADMIN_WRITE_RATE_LIMIT_FOR_TESTS = {
  windowMs: ADMIN_WINDOW_MS,
  maxPerWindow: ADMIN_MAX_PER_WINDOW,
} as const;
