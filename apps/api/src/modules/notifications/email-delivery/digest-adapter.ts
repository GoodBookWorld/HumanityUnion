/**
 * HU-NOTIF-02C.4 / 02C.5 — digest delivery adapter.
 * Dry-run validates template only. Live uses gated MailDeliveryService send.
 */

import type { MemberNotificationEmailDeliveryMode } from "@hu/types";
import type {
  MemberNotificationEmailDeliveryRecord,
  MemberNotificationEmailDeliverySkipReason,
} from "@hu/types";

import { sendMemberNotificationDigestEmail } from "../../email/email.service.js";
import {
  logMemberNotificationEmailDeliveryEvent,
  recordMemberNotificationEmailMetric,
} from "./delivery-metrics.js";
import { resolveMemberNotificationEmailDigestPresentation } from "./digest-presentation.js";
import {
  assertMemberNotificationEmailLiveSendGates,
  classifyProviderDeliveryResult,
} from "./live-send.js";

export interface MemberNotificationEmailDigestAdapterInput {
  digestId: string;
  frequency: "daily" | "weekly";
  destinationHash: string;
  mode: MemberNotificationEmailDeliveryMode;
  recipientUserId: string;
  recipientMemberId?: string | null;
  eligibleRecords: MemberNotificationEmailDeliveryRecord[];
  createdAt?: string | null;
}

export type MemberNotificationEmailDigestAdapterResult =
  | {
      outcome: "dry_run_validated";
      providerEmailId: null;
      diagnostics: {
        locale: string;
        localeFallback: boolean;
        dir: "ltr" | "rtl";
        frequency: "daily" | "weekly";
        categoryCount: number;
        templateId: "member_notification_digest";
      };
    }
  | {
      outcome: "sent";
      providerEmailId: string;
      destinationHash: string;
    }
  | {
      outcome: "template_failed";
      errorCode: string;
      errorSummary: string;
    }
  | {
      outcome: "live_gate_failed";
      errorCode: MemberNotificationEmailDeliverySkipReason;
      errorSummary: string;
      terminal: boolean;
    }
  | {
      outcome: "provider_deferred" | "provider_failed" | "provider_blocked" | "provider_ambiguous";
      errorCode: MemberNotificationEmailDeliverySkipReason;
      errorSummary: string;
      terminal: boolean;
      providerEmailId: string | null;
    }
  | {
      outcome: "live_not_ready";
      errorCode: "live_not_ready";
      errorSummary: string;
    }
  | {
      outcome: "mode_off";
      errorCode: "mode_off";
      errorSummary: string;
    };

/**
 * Validates digest presentation. Live mode may call MailDeliveryService once.
 */
export async function executeMemberNotificationEmailDigestAdapter(
  input: MemberNotificationEmailDigestAdapterInput,
): Promise<MemberNotificationEmailDigestAdapterResult> {
  if (!input.digestId || !input.destinationHash || input.destinationHash.includes("@")) {
    throw new Error("Digest adapter requires digestId and hashed destination only.");
  }

  if (input.mode === "off") {
    return {
      outcome: "mode_off",
      errorCode: "mode_off",
      errorSummary: "Member notification email delivery mode is off.",
    };
  }

  if (input.eligibleRecords.length === 0) {
    return {
      outcome: "template_failed",
      errorCode: "empty_digest",
      errorSummary: "Digest has no eligible notification intents.",
    };
  }

  const presentation = await resolveMemberNotificationEmailDigestPresentation({
    frequency: input.frequency,
    eligibleRecords: input.eligibleRecords,
    recipientMemberId: input.recipientMemberId,
  });

  if (!presentation.ok) {
    return {
      outcome: "template_failed",
      errorCode: presentation.errorCode,
      errorSummary: "Notification digest template resolution failed.",
    };
  }

  if (input.mode === "dry_run") {
    return {
      outcome: "dry_run_validated",
      providerEmailId: null,
      diagnostics: {
        locale: presentation.locale,
        localeFallback: presentation.localeFallback,
        dir: presentation.dir,
        frequency: presentation.frequency,
        categoryCount: presentation.categoryCounts.length,
        templateId: presentation.templateId,
      },
    };
  }

  if (input.mode !== "live") {
    return {
      outcome: "live_not_ready",
      errorCode: "live_not_ready",
      errorSummary: "Member notification digest mode is not live.",
    };
  }

  const channel = input.frequency === "daily" ? "digest_daily" : "digest_weekly";
  recordMemberNotificationEmailMetric("attempted");

  const gates = await assertMemberNotificationEmailLiveSendGates({
    recipientUserId: input.recipientUserId,
    recipientMemberId: input.recipientMemberId ?? null,
    createdAt: input.createdAt,
    expectedFrequency: input.frequency === "daily" ? "daily_digest" : "weekly_digest",
    requireAllowlistedEvent: false,
  });

  if (!gates.ok) {
    recordMemberNotificationEmailMetric(
      gates.skipReason === "rate_limited" ? "rate_limited" : "live_blocked",
    );
    logMemberNotificationEmailDeliveryEvent({
      channel,
      outcome: "gate_failed",
      errorCode: gates.skipReason,
    });
    return {
      outcome: "live_gate_failed",
      errorCode: gates.skipReason,
      errorSummary: "Live digest email send gates failed.",
      terminal: gates.terminal,
    };
  }

  const delivery = await sendMemberNotificationDigestEmail({
    to: gates.destinationEmail,
    ...presentation.mailFields,
  });

  const classified = classifyProviderDeliveryResult(delivery);
  if (classified.outcome === "sent") {
    recordMemberNotificationEmailMetric("accepted");
    logMemberNotificationEmailDeliveryEvent({
      channel,
      outcome: "accepted",
    });
    return {
      outcome: "sent",
      providerEmailId: delivery.emailId,
      destinationHash: gates.destinationHash,
    };
  }

  recordMemberNotificationEmailMetric(classified.terminal ? "failed" : "retried");
  logMemberNotificationEmailDeliveryEvent({
    channel,
    outcome: classified.outcome,
    errorCode: classified.skipReason,
  });

  return {
    outcome: classified.outcome,
    errorCode: classified.skipReason ?? "provider_ambiguous",
    errorSummary: delivery.emailDeliveryError ?? classified.outcome,
    terminal: classified.terminal,
    providerEmailId: delivery.emailId,
  };
}
