/**
 * EMAIL SECURITY 02B — privacy-safe identifiers for Blog subscription abuse control.
 */
import { createHmac, createHash } from "node:crypto";

import { hashRecipientEmail } from "../email/email.templates.js";

export { hashRecipientEmail };

/**
 * Deterministic HMAC of the trusted request IP for correlation without raw IP retention.
 * Uses BLOG_SUBSCRIPTION_ABUSE_HASH_SECRET when set; otherwise JWT_ACCESS_SECRET.
 */
export function resolveBlogSubscriptionAbuseHashSecret(): string {
  const dedicated = process.env.BLOG_SUBSCRIPTION_ABUSE_HASH_SECRET?.trim();
  if (dedicated) {
    return dedicated;
  }
  const jwt = process.env.JWT_ACCESS_SECRET?.trim();
  if (jwt) {
    return jwt;
  }
  // Local/unit tests without secrets — still deterministic within a process.
  return "blog-subscription-abuse-dev-hash-secret";
}

export function hashBlogSubscriptionSourceIp(ipKey: string): string {
  const normalized = (ipKey || "unknown").trim().toLowerCase() || "unknown";
  return createHmac("sha256", resolveBlogSubscriptionAbuseHashSecret())
    .update(`blog-sub-ip:${normalized}`)
    .digest("hex");
}

/** Stable day bucket for rolling 24h daily cap (UTC day start). */
export function blogSubscriptionDailyBucket(nowMs: number = Date.now()): string {
  const dayStart = Math.floor(nowMs / (24 * 60 * 60_000));
  return String(dayStart);
}

export function blogSubscriptionIpWindowBucket(nowMs: number = Date.now()): string {
  const windowStart = Math.floor(nowMs / (60 * 60_000));
  return String(windowStart);
}

/** Opaque fingerprint for test assertions (never log secrets). */
export function shortHashPrefix(value: string, length = 12): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}
