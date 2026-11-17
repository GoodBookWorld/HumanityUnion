/**
 * HU-NOTIF-02C.5 — final pre-send gates + provider result classification.
 * One provider call per claim; ledger owns outer retry (SMTP inner retries stay inside provider).
 */

import { createHash } from "node:crypto";

import type { MemberNotificationEmailDeliverySkipReason } from "@hu/types";

import { findAuthUserById } from "../../auth/auth-user.repository.js";
import type { EmailDeliveryResult } from "../../email/email.service.js";
import { resolveNotificationEmailDestination } from "../../preferences/notification-alternative-email.service.js";
import { findPreferencesByMemberId } from "../../preferences/preferences.repository.js";
import { isMemberNotificationEmailEventAllowlisted } from "./allowlist.js";
import {
  isMemberNotificationEmailDeliveryEnabled,
  resolveMemberNotificationEmailDeliveryActivationAt,
  resolveMemberNotificationEmailDeliveryMode,
} from "./feature-flag.js";
import { isMemberNotificationEmailLiveSmtpPermitted } from "./live-gates.js";
import { isMemberNotificationEmailLiveRecipientAllowlisted } from "./recipient-allowlist.js";
import { consumeMemberNotificationEmailSendBudget } from "./send-rate-limit.js";

function hashDestination(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export type LiveSendGateFailure = {
  ok: false;
  skipReason: MemberNotificationEmailDeliverySkipReason;
  /** When false, ledger may retry with backoff (e.g. rate limit). */
  terminal: boolean;
};

export type LiveSendGateSuccess = {
  ok: true;
  destinationEmail: string;
  destinationHash: string;
};

export type LiveSendGateResult = LiveSendGateFailure | LiveSendGateSuccess;

/**
 * Recheck every live requirement immediately before provider send.
 */
export async function assertMemberNotificationEmailLiveSendGates(input: {
  recipientUserId: string;
  recipientMemberId: string | null;
  eventType?: string | null;
  createdAt?: string | null;
  /** Expected preference frequency for digest channels. */
  expectedFrequency?: "daily_digest" | "weekly_digest" | "immediate" | null;
  requireAllowlistedEvent?: boolean;
}): Promise<LiveSendGateResult> {
  if (!isMemberNotificationEmailLiveSmtpPermitted()) {
    if (!isMemberNotificationEmailDeliveryEnabled()) {
      return { ok: false, skipReason: "flag_off", terminal: true };
    }
    if (resolveMemberNotificationEmailDeliveryMode() !== "live") {
      return { ok: false, skipReason: "flag_off", terminal: true };
    }
    return { ok: false, skipReason: "live_not_approved", terminal: true };
  }

  if (!isMemberNotificationEmailLiveRecipientAllowlisted(input.recipientMemberId)) {
    return {
      ok: false,
      skipReason: "live_recipient_not_allowlisted",
      terminal: true,
    };
  }

  const activationAt = resolveMemberNotificationEmailDeliveryActivationAt();
  if (!activationAt || (input.createdAt && input.createdAt < activationAt)) {
    return { ok: false, skipReason: "activation_blocked", terminal: true };
  }

  if (
    input.requireAllowlistedEvent !== false &&
    input.eventType &&
    !isMemberNotificationEmailEventAllowlisted(input.eventType as never)
  ) {
    return { ok: false, skipReason: "not_allowlisted", terminal: true };
  }

  const user = await findAuthUserById(input.recipientUserId);
  if (!user || user.status !== "active") {
    return { ok: false, skipReason: "account_inactive", terminal: true };
  }

  if (!input.recipientMemberId) {
    return {
      ok: false,
      skipReason: "live_recipient_not_allowlisted",
      terminal: true,
    };
  }

  const preferences = await findPreferencesByMemberId(input.recipientMemberId);
  if (!preferences) {
    return { ok: false, skipReason: "opt_out", terminal: true };
  }

  const communication = preferences.communicationPreferences;
  if (!communication.notificationEmailCopiesOptIn) {
    return { ok: false, skipReason: "opt_out", terminal: true };
  }
  if (!communication.emailNotificationsEnabled) {
    return { ok: false, skipReason: "email_disabled", terminal: true };
  }
  if (communication.notificationFrequency === "platform_only") {
    return { ok: false, skipReason: "platform_only", terminal: true };
  }
  if (
    input.expectedFrequency &&
    communication.notificationFrequency !== input.expectedFrequency
  ) {
    return {
      ok: false,
      skipReason:
        input.expectedFrequency === "immediate"
          ? "frequency_not_immediate"
          : "frequency_mismatch",
      terminal: true,
    };
  }

  if (
    input.eventType &&
    (communication.disabledNotificationCategories ?? []).includes(input.eventType)
  ) {
    return { ok: false, skipReason: "disabled_category", terminal: true };
  }

  const destination = resolveNotificationEmailDestination({
    preferences,
    accountEmail: user.email,
    accountEmailVerified: user.emailVerificationStatus === "verified",
  });
  if (!destination) {
    return { ok: false, skipReason: "no_verified_destination", terminal: true };
  }

  const budget = await consumeMemberNotificationEmailSendBudget({
    recipientMemberId: input.recipientMemberId,
  });
  if (!budget.allowed) {
    if (budget.reason === "index_not_ready") {
      return { ok: false, skipReason: "index_not_ready", terminal: false };
    }
    if (budget.reason === "storage_unavailable") {
      // Fail closed — never send without shared multi-instance budgets.
      return { ok: false, skipReason: "rate_limited", terminal: false };
    }
    return { ok: false, skipReason: "rate_limited", terminal: false };
  }

  return {
    ok: true,
    destinationEmail: destination,
    destinationHash: hashDestination(destination),
  };
}

/**
 * Map MailDeliveryService results to ledger outcomes.
 *
 * SMTP acceptance ambiguity (documented):
 * - Provider may accept a message without a durable confirmation the worker can trust.
 * - Ambiguous / queued / unknown statuses are NEVER treated as confirmed delivery.
 * - Ledger may retry with bounded backoff; exactly-once external SMTP is not claimed.
 * - A later retry can produce a duplicate recipient email after an uncertain response.
 */
export function classifyProviderDeliveryResult(result: EmailDeliveryResult): {
  outcome:
    | "sent"
    | "provider_deferred"
    | "provider_failed"
    | "provider_blocked"
    | "provider_ambiguous";
  skipReason: MemberNotificationEmailDeliverySkipReason | null;
  terminal: boolean;
} {
  // Confirmed delivery only when both flags agree.
  if (result.emailSent === true && result.status === "sent") {
    return { outcome: "sent", skipReason: null, terminal: true };
  }
  if (result.status === "deferred") {
    return {
      outcome: "provider_deferred",
      skipReason: "provider_temporary",
      terminal: false,
    };
  }
  if (result.status === "blocked") {
    return {
      outcome: "provider_blocked",
      skipReason: "provider_blocked",
      terminal: true,
    };
  }
  if (result.status === "failed") {
    const permanent =
      result.emailDeliveryError === "email_provider_mock" ||
      result.emailDeliveryError === "invalid_recipient" ||
      result.emailDeliveryError === "configuration_error";
    return {
      outcome: "provider_failed",
      skipReason: permanent ? "provider_permanent" : "provider_temporary",
      terminal: permanent,
    };
  }
  // queued / mismatched emailSent / unknown — ambiguous, not confirmed sent.
  return {
    outcome: "provider_ambiguous",
    skipReason: "provider_ambiguous",
    terminal: false,
  };
}
