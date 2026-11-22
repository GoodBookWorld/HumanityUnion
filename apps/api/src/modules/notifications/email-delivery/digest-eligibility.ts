/**
 * HU-NOTIF-02C.4 — live eligibility for digest aggregate + child intents.
 * Never converts digest rows to immediate delivery.
 */

import { createHash } from "node:crypto";

import type {
  MemberNotificationEmailDeliveryChannel,
  MemberNotificationEmailDeliveryRecord,
  MemberNotificationEmailDeliverySkipReason,
  MemberNotificationEmailDigestRunRecord,
  MemberPreferences,
  NotificationFrequency,
} from "@hu/types";

import { findAuthUserById } from "../../auth/auth-user.repository.js";
import { isAccountDeletionSignInBlocked } from "../../account-deletion/account-deletion.state.js";
import { resolveNotificationEmailDestination } from "../../preferences/notification-alternative-email.service.js";
import { buildDefaultMemberPreferences } from "../../preferences/preferences.defaults.js";
import { findPreferencesByMemberId } from "../../preferences/preferences.repository.js";
import { isMemberNotificationEmailEventAllowlisted } from "./allowlist.js";
import {
  isMemberNotificationEmailDeliveryEnabled,
  resolveMemberNotificationEmailDeliveryActivationAt,
  resolveMemberNotificationEmailDeliveryMode,
} from "./feature-flag.js";

export type DigestRecipientEligibilityResult =
  | {
      eligible: true;
      destinationHash: string;
      destinationModeSnapshot: "account" | "alternative";
      preferences: MemberPreferences;
    }
  | {
      eligible: false;
      skipReason: MemberNotificationEmailDeliverySkipReason;
      terminalStatus: "cancelled" | "skipped";
    };

export type DigestChildEligibilityResult =
  | { eligible: true }
  | {
      eligible: false;
      skipReason: MemberNotificationEmailDeliverySkipReason;
      terminalStatus: "cancelled" | "skipped";
    };

function hashDestination(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function expectedFrequencyForChannel(
  channel: MemberNotificationEmailDeliveryChannel,
): NotificationFrequency | null {
  if (channel === "digest_daily") {
    return "daily_digest";
  }
  if (channel === "digest_weekly") {
    return "weekly_digest";
  }
  return null;
}

async function loadPreferences(input: {
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
  return (
    (await findPreferencesByMemberId(memberId)) ??
    buildDefaultMemberPreferences({ memberId, userId: input.recipientUserId })
  );
}

/**
 * Recipient-level gates for a digest run (flags, opt-in, matching frequency, destination).
 */
export async function evaluateMemberNotificationEmailDigestRecipientEligibility(
  run: MemberNotificationEmailDigestRunRecord,
): Promise<DigestRecipientEligibilityResult> {
  if (!isMemberNotificationEmailDeliveryEnabled()) {
    return { eligible: false, skipReason: "flag_off", terminalStatus: "cancelled" };
  }

  const mode = resolveMemberNotificationEmailDeliveryMode();
  if (mode === "off") {
    return { eligible: false, skipReason: "flag_off", terminalStatus: "cancelled" };
  }

  const activationAt = resolveMemberNotificationEmailDeliveryActivationAt();
  if (!activationAt || run.createdAt < activationAt) {
    return {
      eligible: false,
      skipReason: "activation_blocked",
      terminalStatus: "cancelled",
    };
  }

  const expectedFrequency = expectedFrequencyForChannel(run.channel);
  if (!expectedFrequency) {
    return {
      eligible: false,
      skipReason: "frequency_mismatch",
      terminalStatus: "cancelled",
    };
  }

  const user = await findAuthUserById(run.recipientUserId);
  if (!user || user.status !== "active" || isAccountDeletionSignInBlocked(user.accountDeletion)) {
    return {
      eligible: false,
      skipReason: "account_inactive",
      terminalStatus: "cancelled",
    };
  }

  const preferences = await loadPreferences({
    recipientUserId: run.recipientUserId,
    recipientMemberId: run.recipientMemberId,
  });
  const communication = preferences.communicationPreferences;

  if (communication.notificationFrequency === "platform_only") {
    return {
      eligible: false,
      skipReason: "platform_only",
      terminalStatus: "cancelled",
    };
  }

  if (communication.notificationFrequency !== expectedFrequency) {
    return {
      eligible: false,
      skipReason: "frequency_mismatch",
      terminalStatus: "cancelled",
    };
  }

  if (!communication.notificationEmailCopiesOptIn) {
    return { eligible: false, skipReason: "opt_out", terminalStatus: "cancelled" };
  }

  if (!communication.emailNotificationsEnabled) {
    return {
      eligible: false,
      skipReason: "email_disabled",
      terminalStatus: "cancelled",
    };
  }

  const destination = resolveNotificationEmailDestination({
    preferences,
    accountEmail: user.email,
    accountEmailVerified: user.emailVerificationStatus === "verified",
  });

  if (!destination) {
    return {
      eligible: false,
      skipReason: "no_verified_destination",
      terminalStatus: "cancelled",
    };
  }

  const destinationModeSnapshot =
    communication.notificationEmailDestinationMode === "alternative" &&
    communication.notificationAlternativeEmail
      ? "alternative"
      : "account";

  return {
    eligible: true,
    destinationHash: hashDestination(destination),
    destinationModeSnapshot,
    preferences,
  };
}

/**
 * Per-child gates after recipient eligibility succeeds.
 */
export function evaluateMemberNotificationEmailDigestChildEligibility(
  record: MemberNotificationEmailDeliveryRecord,
  preferences: MemberPreferences,
): DigestChildEligibilityResult {
  if (!isMemberNotificationEmailEventAllowlisted(record.eventType)) {
    return {
      eligible: false,
      skipReason: "not_allowlisted",
      terminalStatus: "cancelled",
    };
  }

  const disabled = preferences.communicationPreferences.disabledNotificationCategories ?? [];
  if (disabled.includes(record.eventType)) {
    return {
      eligible: false,
      skipReason: "disabled_category",
      terminalStatus: "cancelled",
    };
  }

  const expectedFrequency = expectedFrequencyForChannel(record.channel);
  if (
    !expectedFrequency ||
    preferences.communicationPreferences.notificationFrequency !== expectedFrequency
  ) {
    return {
      eligible: false,
      skipReason: "frequency_mismatch",
      terminalStatus: "cancelled",
    };
  }

  return { eligible: true };
}
