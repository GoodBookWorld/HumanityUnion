/**
 * HU-NOTIF-02C.1 — idempotent durable delivery-intent enqueue.
 * No SMTP. No worker. Preference-aware channel routing.
 */

import { createHash, randomUUID } from "node:crypto";

import type {
  MemberNotification,
  MemberNotificationEmailDeliveryChannel,
  MemberNotificationEmailDeliveryRecord,
  MemberNotificationEmailDeliverySkipReason,
  MemberPreferences,
  NotificationFrequency,
} from "@hu/types";
import type { ClientSession } from "mongodb";

import { findAuthUserById } from "../../auth/auth-user.repository.js";
import { resolveNotificationEmailDestination } from "../../preferences/notification-alternative-email.service.js";
import { findPreferencesByMemberId } from "../../preferences/preferences.repository.js";
import { buildDefaultMemberPreferences } from "../../preferences/preferences.defaults.js";
import { isMemberNotificationEmailEventAllowlisted } from "./allowlist.js";
import {
  resolveMemberNotificationDigestBucketKey,
  resolveMemberNotificationDigestPeriodEndsAt,
} from "./digest-period.js";
import {
  isMemberNotificationEmailDeliveryEnabled,
  resolveMemberNotificationEmailDeliveryActivationAt,
} from "./feature-flag.js";
import { MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS } from "./member-notification-email-delivery.constants.js";
import { assertMemberNotificationEmailDeliveryIndexesReady } from "./member-notification-email-delivery.index-readiness.js";
import {
  findMemberNotificationEmailDeliveryByNotificationAndChannel,
  insertMemberNotificationEmailDelivery,
  listMemberNotificationEmailDeliveryGaps,
  recordMemberNotificationEmailDeliveryGap,
} from "./member-notification-email-delivery.repository.js";

export type EnqueueMemberNotificationEmailDeliveryResult =
  | { outcome: "flag_off" }
  | { outcome: "not_allowlisted" }
  | { outcome: "index_not_ready"; gapRecorded: boolean }
  | {
      outcome: "enqueued" | "duplicate" | "skipped";
      record: MemberNotificationEmailDeliveryRecord;
    };

function hashDestination(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function resolveChannel(
  frequency: NotificationFrequency,
): MemberNotificationEmailDeliveryChannel | "platform_only" {
  switch (frequency) {
    case "immediate":
      return "immediate";
    case "daily_digest":
      return "digest_daily";
    case "weekly_digest":
      return "digest_weekly";
    case "platform_only":
      return "platform_only";
    default:
      return "digest_daily";
  }
}

function categoryDisabled(
  preferences: MemberPreferences,
  eventType: MemberNotification["eventType"],
): boolean {
  const disabled = preferences.communicationPreferences.disabledNotificationCategories ?? [];
  return disabled.includes(eventType);
}

async function loadPreferencesForRecipient(input: {
  recipientUserId: string;
  recipientMemberId: string | null;
}): Promise<MemberPreferences> {
  const memberId =
    input.recipientMemberId ??
    (await findAuthUserById(input.recipientUserId))?.memberId ??
    null;

  if (!memberId) {
    return buildDefaultMemberPreferences({
      memberId: "unknown",
      userId: input.recipientUserId,
    });
  }

  const existing = await findPreferencesByMemberId(memberId);
  if (existing) {
    return existing;
  }

  return buildDefaultMemberPreferences({
    memberId,
    userId: input.recipientUserId,
  });
}

function buildSkippedRecord(input: {
  notification: MemberNotification;
  recipientMemberId: string | null;
  channel: MemberNotificationEmailDeliveryChannel;
  skipReason: MemberNotificationEmailDeliverySkipReason;
  destinationModeSnapshot?: MemberNotificationEmailDeliveryRecord["destinationModeSnapshot"];
  destinationHash?: string | null;
}): MemberNotificationEmailDeliveryRecord {
  const now = new Date().toISOString();
  return {
    deliveryId: randomUUID(),
    notificationId: input.notification.notificationId,
    recipientUserId: input.notification.recipientUserId,
    recipientMemberId: input.recipientMemberId,
    eventType: input.notification.eventType,
    channel: input.channel,
    status: "skipped",
    attemptCount: 0,
    maxAttempts: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS,
    nextAttemptAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    digestBucketKey: resolveMemberNotificationDigestBucketKey({
      recipientUserId: input.notification.recipientUserId,
      channel: input.channel,
      createdAt: input.notification.createdAt,
    }),
    digestPeriodEndsAt: resolveMemberNotificationDigestPeriodEndsAt({
      recipientUserId: input.notification.recipientUserId,
      channel: input.channel,
      createdAt: input.notification.createdAt,
    }),
    destinationModeSnapshot: input.destinationModeSnapshot ?? null,
    destinationHash: input.destinationHash ?? null,
    providerEmailId: null,
    skipReason: input.skipReason,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

function buildPendingRecord(input: {
  notification: MemberNotification;
  recipientMemberId: string | null;
  channel: MemberNotificationEmailDeliveryChannel;
  destinationModeSnapshot: MemberNotificationEmailDeliveryRecord["destinationModeSnapshot"];
  destinationHash: string;
}): MemberNotificationEmailDeliveryRecord {
  const now = new Date().toISOString();
  return {
    deliveryId: randomUUID(),
    notificationId: input.notification.notificationId,
    recipientUserId: input.notification.recipientUserId,
    recipientMemberId: input.recipientMemberId,
    eventType: input.notification.eventType,
    channel: input.channel,
    status: "pending",
    attemptCount: 0,
    maxAttempts: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS,
    nextAttemptAt: now,
    leaseOwner: null,
    leaseExpiresAt: null,
    digestBucketKey: resolveMemberNotificationDigestBucketKey({
      recipientUserId: input.notification.recipientUserId,
      channel: input.channel,
      createdAt: input.notification.createdAt,
    }),
    digestPeriodEndsAt: resolveMemberNotificationDigestPeriodEndsAt({
      recipientUserId: input.notification.recipientUserId,
      channel: input.channel,
      createdAt: input.notification.createdAt,
    }),
    destinationModeSnapshot: input.destinationModeSnapshot ?? null,
    destinationHash: input.destinationHash,
    providerEmailId: null,
    skipReason: null,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a durable delivery intent for a newly persisted member notification.
 * Never sends email. Idempotent on (notificationId, channel).
 */
export async function enqueueMemberNotificationEmailDelivery(
  notification: MemberNotification,
  options: {
    session?: ClientSession;
    recipientMemberId?: string | null;
    skipMongoIndexCheck?: boolean;
  } = {},
): Promise<EnqueueMemberNotificationEmailDeliveryResult> {
  if (!isMemberNotificationEmailDeliveryEnabled()) {
    return { outcome: "flag_off" };
  }

  if (!isMemberNotificationEmailEventAllowlisted(notification.eventType)) {
    return { outcome: "not_allowlisted" };
  }

  const ready = await assertMemberNotificationEmailDeliveryIndexesReady({
    skipMongo: options.skipMongoIndexCheck,
  });

  if (!ready) {
    await recordMemberNotificationEmailDeliveryGap({
      notificationId: notification.notificationId,
      recipientUserId: notification.recipientUserId,
      eventType: notification.eventType,
      reason: "index_not_ready",
    });
    return { outcome: "index_not_ready", gapRecorded: true };
  }

  const recipientMemberId =
    options.recipientMemberId ?? notification.recipientProfileId ?? null;

  const preferences = await loadPreferencesForRecipient({
    recipientUserId: notification.recipientUserId,
    recipientMemberId,
  });
  const communication = preferences.communicationPreferences;
  const channelOrPlatform = resolveChannel(communication.notificationFrequency);

  // platform_only: no sendable intent — record skipped metadata for diagnostics.
  const channel: MemberNotificationEmailDeliveryChannel =
    channelOrPlatform === "platform_only" ? "immediate" : channelOrPlatform;

  const existing = await findMemberNotificationEmailDeliveryByNotificationAndChannel({
    notificationId: notification.notificationId,
    channel,
  });
  if (existing) {
    return { outcome: "duplicate", record: existing };
  }

  if (channelOrPlatform === "platform_only") {
    const record = buildSkippedRecord({
      notification,
      recipientMemberId,
      channel: "immediate",
      skipReason: "platform_only",
    });
    const inserted = await insertMemberNotificationEmailDelivery(record, {
      session: options.session,
    });
    return {
      outcome: inserted.inserted ? "skipped" : "duplicate",
      record: inserted.record,
    };
  }

  if (!communication.notificationEmailCopiesOptIn) {
    const record = buildSkippedRecord({
      notification,
      recipientMemberId,
      channel,
      skipReason: "opt_out",
    });
    const inserted = await insertMemberNotificationEmailDelivery(record, {
      session: options.session,
    });
    return {
      outcome: inserted.inserted ? "skipped" : "duplicate",
      record: inserted.record,
    };
  }

  if (!communication.emailNotificationsEnabled) {
    const record = buildSkippedRecord({
      notification,
      recipientMemberId,
      channel,
      skipReason: "email_disabled",
    });
    const inserted = await insertMemberNotificationEmailDelivery(record, {
      session: options.session,
    });
    return {
      outcome: inserted.inserted ? "skipped" : "duplicate",
      record: inserted.record,
    };
  }

  if (categoryDisabled(preferences, notification.eventType)) {
    const record = buildSkippedRecord({
      notification,
      recipientMemberId,
      channel,
      skipReason: "disabled_category",
    });
    const inserted = await insertMemberNotificationEmailDelivery(record, {
      session: options.session,
    });
    return {
      outcome: inserted.inserted ? "skipped" : "duplicate",
      record: inserted.record,
    };
  }

  const user = await findAuthUserById(notification.recipientUserId);
  const destination = resolveNotificationEmailDestination({
    preferences,
    accountEmail: user?.email ?? null,
    accountEmailVerified: user?.emailVerificationStatus === "verified",
  });

  const destinationModeSnapshot =
    communication.notificationEmailDestinationMode === "alternative" &&
    communication.notificationAlternativeEmail
      ? "alternative"
      : "account";

  if (!destination) {
    const record = buildSkippedRecord({
      notification,
      recipientMemberId,
      channel,
      skipReason: "no_verified_destination",
      destinationModeSnapshot,
    });
    const inserted = await insertMemberNotificationEmailDelivery(record, {
      session: options.session,
    });
    return {
      outcome: inserted.inserted ? "skipped" : "duplicate",
      record: inserted.record,
    };
  }

  const record = buildPendingRecord({
    notification,
    recipientMemberId,
    channel,
    destinationModeSnapshot,
    destinationHash: hashDestination(destination),
  });

  const inserted = await insertMemberNotificationEmailDelivery(record, {
    session: options.session,
  });

  return {
    outcome: inserted.inserted ? "enqueued" : "duplicate",
    record: inserted.record,
  };
}

/**
 * Best-effort enqueue after notification persistence. Never throws.
 * Records a gap when intent creation fails after the notification exists.
 */
export async function enqueueMemberNotificationEmailDeliveryBestEffort(
  notification: MemberNotification,
  options: { recipientMemberId?: string | null; skipMongoIndexCheck?: boolean } = {},
): Promise<EnqueueMemberNotificationEmailDeliveryResult> {
  try {
    return await enqueueMemberNotificationEmailDelivery(notification, options);
  } catch (error) {
    try {
      await recordMemberNotificationEmailDeliveryGap({
        notificationId: notification.notificationId,
        recipientUserId: notification.recipientUserId,
        eventType: notification.eventType,
        reason: error instanceof Error ? error.message : "enqueue_failed",
      });
    } catch {
      // Gap recording must not surface either.
    }
    return { outcome: "flag_off" };
  }
}

/**
 * Bounded gap listing for future recovery — only after explicit activation boundary.
 * Does not backfill historical notifications and does not send email.
 */
export async function listRecoverableMemberNotificationEmailDeliveryGaps(): Promise<{
  activationAt: string | null;
  gaps: Awaited<ReturnType<typeof listMemberNotificationEmailDeliveryGaps>>;
}> {
  const activationAt = resolveMemberNotificationEmailDeliveryActivationAt();
  if (!activationAt) {
    return { activationAt: null, gaps: [] };
  }
  const gaps = await listMemberNotificationEmailDeliveryGaps({ sinceIso: activationAt });
  return { activationAt, gaps };
}

export type RecoverMemberNotificationEmailDeliveryGapResult =
  | { outcome: "activation_unset" }
  | { outcome: "historical_blocked" }
  | { outcome: "notification_missing" }
  | {
      outcome: "recovered";
      enqueue: EnqueueMemberNotificationEmailDeliveryResult;
    };

/**
 * Re-attempt ledger intent creation for a gap.
 * Always re-runs live allowlist + preference gates via enqueue (no gate bypass).
 * No SMTP. Rejects notifications created before the activation boundary.
 */
export async function recoverMemberNotificationEmailDeliveryGap(input: {
  notificationId: string;
  loadNotification: (notificationId: string) => Promise<MemberNotification | null>;
  skipMongoIndexCheck?: boolean;
}): Promise<RecoverMemberNotificationEmailDeliveryGapResult> {
  const activationAt = resolveMemberNotificationEmailDeliveryActivationAt();
  if (!activationAt) {
    return { outcome: "activation_unset" };
  }

  const notification = await input.loadNotification(input.notificationId);
  if (!notification) {
    return { outcome: "notification_missing" };
  }

  if (notification.createdAt < activationAt) {
    return { outcome: "historical_blocked" };
  }

  const enqueue = await enqueueMemberNotificationEmailDelivery(notification, {
    recipientMemberId: notification.recipientProfileId,
    skipMongoIndexCheck: input.skipMongoIndexCheck,
  });

  return { outcome: "recovered", enqueue };
}
