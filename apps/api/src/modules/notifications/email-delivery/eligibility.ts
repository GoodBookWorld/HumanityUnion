/**
 * HU-NOTIF-02C.2 — live eligibility recheck before delivery attempt.
 */

import { createHash } from "node:crypto";

import type {
  MemberNotificationEmailDeliveryRecord,
  MemberNotificationEmailDeliverySkipReason,
  MemberPreferences,
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

export type DeliveryEligibilityResult =
  | {
      eligible: true;
      destinationHash: string;
      destinationModeSnapshot: "account" | "alternative";
    }
  | {
      eligible: false;
      skipReason: MemberNotificationEmailDeliverySkipReason;
      terminalStatus: "cancelled" | "skipped";
    };

function hashDestination(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
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
 * Recheck all gates at claim/process time. Never treats pending alternative as destination.
 * Digest / platform_only → not eligible for immediate worker send.
 */
export async function evaluateMemberNotificationEmailDeliveryEligibility(
  record: MemberNotificationEmailDeliveryRecord,
): Promise<DeliveryEligibilityResult> {
  if (!isMemberNotificationEmailDeliveryEnabled()) {
    return { eligible: false, skipReason: "flag_off", terminalStatus: "cancelled" };
  }

  const mode = resolveMemberNotificationEmailDeliveryMode();
  if (mode === "off") {
    return { eligible: false, skipReason: "flag_off", terminalStatus: "cancelled" };
  }

  const activationAt = resolveMemberNotificationEmailDeliveryActivationAt();
  if (!activationAt || record.createdAt < activationAt) {
    return {
      eligible: false,
      skipReason: "activation_blocked",
      terminalStatus: "cancelled",
    };
  }

  if (record.channel !== "immediate") {
    return {
      eligible: false,
      skipReason: "frequency_not_immediate",
      terminalStatus: "cancelled",
    };
  }

  if (!isMemberNotificationEmailEventAllowlisted(record.eventType)) {
    return {
      eligible: false,
      skipReason: "not_allowlisted",
      terminalStatus: "cancelled",
    };
  }

  const user = await findAuthUserById(record.recipientUserId);
  if (!user || user.status !== "active" || isAccountDeletionSignInBlocked(user.accountDeletion)) {
    return {
      eligible: false,
      skipReason: "account_inactive",
      terminalStatus: "cancelled",
    };
  }

  const preferences = await loadPreferences({
    recipientUserId: record.recipientUserId,
    recipientMemberId: record.recipientMemberId,
  });
  const communication = preferences.communicationPreferences;

  if (communication.notificationFrequency === "platform_only") {
    return {
      eligible: false,
      skipReason: "platform_only",
      terminalStatus: "cancelled",
    };
  }

  if (communication.notificationFrequency !== "immediate") {
    return {
      eligible: false,
      skipReason: "frequency_not_immediate",
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

  const disabled = communication.disabledNotificationCategories ?? [];
  if (disabled.includes(record.eventType)) {
    return {
      eligible: false,
      skipReason: "disabled_category",
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
  };
}
