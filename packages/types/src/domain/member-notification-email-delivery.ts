/**
 * HU-NOTIF-02C.1 — durable ledger for future member_notification email copies.
 * No SMTP delivery in this phase.
 */

import type { CivicNotificationEventType } from "./capability02-integration.js";
import type { NotificationEmailDestinationMode } from "./member-preferences.js";

export type MemberNotificationEmailDeliveryChannel =
  | "immediate"
  | "digest_daily"
  | "digest_weekly";

export type MemberNotificationEmailDeliveryStatus =
  | "pending"
  | "claimed"
  | "sent"
  | "skipped"
  | "failed"
  | "cancelled"
  /** Dry-run validated; not a real send. Live must explicitly requeue — never auto-promoted. */
  | "dry_run_ok";

export type MemberNotificationEmailDeliverySkipReason =
  | "flag_off"
  | "not_allowlisted"
  | "opt_out"
  | "email_disabled"
  | "platform_only"
  | "no_verified_destination"
  | "disabled_category"
  | "index_not_ready"
  | "dry_run"
  | "frequency_not_immediate"
  | "account_inactive"
  | "live_not_ready"
  | "activation_blocked";

export type MemberNotificationEmailDeliveryMode = "off" | "dry_run" | "live";

export interface MemberNotificationEmailDeliveryRecord {
  deliveryId: string;
  notificationId: string;
  recipientUserId: string;
  /** Member/profile id used by notification routing when available. */
  recipientMemberId: string | null;
  eventType: CivicNotificationEventType;
  channel: MemberNotificationEmailDeliveryChannel;
  status: MemberNotificationEmailDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  digestBucketKey?: string | null;
  destinationModeSnapshot?: NotificationEmailDestinationMode | null;
  /** SHA-256 of resolved destination email — never plaintext. */
  destinationHash?: string | null;
  providerEmailId?: string | null;
  skipReason?: MemberNotificationEmailDeliverySkipReason | null;
  lastErrorCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Gap between notification persistence and ledger intent when dual-write is non-atomic. */
export interface MemberNotificationEmailDeliveryGapRecord {
  gapId: string;
  notificationId: string;
  recipientUserId: string;
  eventType: CivicNotificationEventType;
  reason: string;
  createdAt: string;
}
