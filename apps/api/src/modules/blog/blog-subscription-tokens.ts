/**
 * Pack 21A — opaque hashed tokens for Blog subscription confirm / unsubscribe.
 *
 * Lookup hash is sha256(purpose:rawToken) so routes can resolve the subscriber
 * without embedding subscriberId in the URL. Random 256-bit tokens make
 * cross-subscriber collision impractical.
 */
import { createHash, randomBytes } from "node:crypto";

export type BlogSubscriptionTokenPurpose = "confirm" | "unsubscribe";

export function generateBlogSubscriptionRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashBlogSubscriptionToken(
  purpose: BlogSubscriptionTokenPurpose,
  rawToken: string,
): string {
  return createHash("sha256").update(`${purpose}:${rawToken.trim()}`).digest("hex");
}

export function resolveBlogSubscriptionConfirmExpiresAt(now = new Date()): string {
  const hours = Number.parseInt(process.env.BLOG_SUBSCRIPTION_CONFIRM_TTL_HOURS ?? "48", 10);
  const ttlHours = Number.isFinite(hours) && hours > 0 ? hours : 48;
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
}

export function isBlogSubscriptionConfirmExpired(
  expiresAt: string | undefined,
  nowIso = new Date().toISOString(),
): boolean {
  if (!expiresAt) {
    return true;
  }
  return expiresAt <= nowIso;
}
