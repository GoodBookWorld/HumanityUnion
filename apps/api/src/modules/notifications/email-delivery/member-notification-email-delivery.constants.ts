/** HU-NOTIF-02C.1 / 02C.2 / 02C.4 — ledger index names and worker defaults. */

export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS = 5;
export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_BATCH_SIZE = 25;
export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_LEASE_MS = 2 * 60 * 1000;
export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_POLL_INTERVAL_MS = 15_000;

/** HU-NOTIF-02C.4 — digest projector batch and category display bounds. */
export const MEMBER_NOTIFICATION_EMAIL_DIGEST_BATCH_SIZE = 10;
/** Distinct closed buckets discovered per tick (not raw child rows). */
export const MEMBER_NOTIFICATION_EMAIL_DIGEST_BUCKET_DISCOVERY_LIMIT = 50;
/** Page size when loading all children for one digest bucket. */
export const MEMBER_NOTIFICATION_EMAIL_DIGEST_CHILD_PAGE_SIZE = 200;
/**
 * Hard safety cap for children in one digest. Exceeding fails closed with retry
 * instead of silently completing a partial digest.
 */
export const MEMBER_NOTIFICATION_EMAIL_DIGEST_CHILD_MAX = 2000;
export const MEMBER_NOTIFICATION_EMAIL_DIGEST_MAX_CATEGORIES = 7;
export const MEMBER_NOTIFICATION_EMAIL_DIGEST_POLL_INTERVAL_MS = 30_000;

/** Ledger backoff only — do not stack with SMTP provider retries. */
export function resolveMemberNotificationEmailDeliveryBackoffMs(attemptCount: number): number {
  const steps = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
  const index = Math.max(0, Math.min(attemptCount - 1, steps.length - 1));
  return steps[index]!;
}

export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES = {
  deliveryIdUnique: "member_notification_email_deliveries_delivery_id_unique",
  notificationChannelUnique:
    "member_notification_email_deliveries_notification_channel_unique",
  workerDue: "member_notification_email_deliveries_worker_due",
  recipientCreated: "member_notification_email_deliveries_recipient_created",
  digestBucket: "member_notification_email_deliveries_digest_bucket",
  digestPeriodDue: "member_notification_email_deliveries_digest_period_due",
} as const;

export const MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_INDEX_NAMES = {
  digestIdUnique: "member_notification_email_digest_runs_digest_id_unique",
  workerDue: "member_notification_email_digest_runs_worker_due",
  recipientCreated: "member_notification_email_digest_runs_recipient_created",
} as const;

export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_REQUIRED_INDEX_NAMES = [
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.deliveryIdUnique,
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.notificationChannelUnique,
] as const;

export const MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_REQUIRED_INDEX_NAMES = [
  MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_INDEX_NAMES.digestIdUnique,
] as const;
