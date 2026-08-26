/**
 * Pack 22E.1 — Admin Notification Center inbox projection (not member_notifications).
 * Pack 22E.3 — operational_alert + optional severity + expireAt retention.
 *
 * Exists = visible in Admin inbox. Deleted = cleared. No read/archive/history states.
 */
export const ADMIN_NOTIFICATION_TYPES = [
  "participant_registered",
  "blog_subscriber_confirmed",
  "initiative_published",
  "public_choice_published",
  "blog_post_published",
  "operational_alert",
] as const;

export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number];

export type AdminNotificationSeverity = "warning" | "critical";

export interface AdminNotification {
  adminNotificationId: string;
  recipientAdminUserId: string;
  type: AdminNotificationType;
  createdAt: string;
  title: string;
  actorLabel?: string;
  targetLabel?: string;
  targetHref?: string;
  sourceEventId?: string;
  dedupeKey?: string;
  /** Pack 22E.3 — ops alerts only. */
  severity?: AdminNotificationSeverity;
  /**
   * Pack 22E.3 — Mongo TTL bound (90 days). Cleared rows are hard-deleted;
   * uncleared rows expire via TTL index on this field.
   */
  expireAt?: string;
}

export interface AdminNotificationListResponse {
  notifications: AdminNotification[];
}

export interface AdminNotificationCountResponse {
  count: number;
}

/** Pack 22E.3 — operational incident keys (stable). */
export const ADMIN_OPS_DEDUPE_KEYS = [
  "ops:api-readiness",
  "ops:mongodb",
  "ops:outbox-failed",
  "ops:email",
] as const;

export type AdminOpsDedupeKey = (typeof ADMIN_OPS_DEDUPE_KEYS)[number];
