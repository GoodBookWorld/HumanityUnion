/**
 * EMAIL SECURITY 02B — Blog subscription anti-abuse policy constants.
 * Blog-only; does not couple to Auth rate-limit APIs.
 */

export const BLOG_SUBSCRIPTION_IP_WINDOW_MS = 60 * 60_000;
export const BLOG_SUBSCRIPTION_IP_MAX_ATTEMPTS = 10;

export const BLOG_SUBSCRIPTION_EMAIL_COOLDOWN_MS = 30 * 60_000;
export const BLOG_SUBSCRIPTION_EMAIL_DAILY_WINDOW_MS = 24 * 60 * 60_000;
export const BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX = 3;

/** Privacy-safe security audit retention (~90 days). */
export const BLOG_SUBSCRIPTION_SECURITY_EVENT_TTL_MS = 90 * 24 * 60 * 60_000;

export type BlogSubscriptionAbuseBlockReason =
  | "invalid_email"
  | "ip_limit"
  | "email_cooldown"
  | "email_daily_cap"
  | "turnstile_missing"
  | "turnstile_invalid"
  | "turnstile_unavailable"
  | "subscribed_noop"
  | "pending_cooldown"
  | "mongo_unavailable";

export type BlogSubscriptionSecurityOutcome = "allowed_send" | "allowed_no_send" | "blocked";
