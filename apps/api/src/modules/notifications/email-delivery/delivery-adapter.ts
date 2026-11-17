/**
 * HU-NOTIF-02C.2 / 02C.3 / 02C.5 — immediate delivery adapter.
 * Dry-run: locale + template + safe-link validation; never SMTP.
 * Live: gated MailDeliveryService send (mock in tests; no Render env mutation).
 */

import type { MemberNotificationEmailDeliveryMode } from "@hu/types";
import type { MemberNotificationEmailDeliverySkipReason } from "@hu/types";

import { sendMemberNotificationCopyEmail } from "../../email/email.service.js";
import {
  recordMemberNotificationEmailMetric,
  logMemberNotificationEmailDeliveryEvent,
} from "./delivery-metrics.js";
import {
  assertMemberNotificationEmailLiveSendGates,
  classifyProviderDeliveryResult,
} from "./live-send.js";
import { resolveMemberNotificationEmailPresentation } from "./presentation.js";

export interface MemberNotificationEmailDeliveryAdapterInput {
  deliveryId: string;
  notificationId: string;
  eventType: string;
  destinationHash: string;
  mode: MemberNotificationEmailDeliveryMode;
  recipientUserId: string;
  recipientMemberId?: string | null;
  relatedUrl?: string | null;
  createdAt?: string | null;
}

export type MemberNotificationEmailDeliveryAdapterResult =
  | {
      outcome: "dry_run_validated";
      providerEmailId: null;
      diagnostics: {
        locale: string;
        localeFallback: boolean;
        dir: "ltr" | "rtl";
        category: string;
        deepLinkFallback: boolean;
        templateId: "member_notification_copy";
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
 * Validates presentation + safe links. Live mode may call MailDeliveryService once.
 */
export async function executeMemberNotificationEmailDeliveryAdapter(
  input: MemberNotificationEmailDeliveryAdapterInput,
): Promise<MemberNotificationEmailDeliveryAdapterResult> {
  if (!input.deliveryId || !input.notificationId || !input.eventType) {
    throw new Error("Delivery adapter payload is incomplete.");
  }
  if (!input.destinationHash || input.destinationHash.includes("@")) {
    throw new Error("Delivery adapter requires a hashed destination only.");
  }

  if (input.mode === "off") {
    return {
      outcome: "mode_off",
      errorCode: "mode_off",
      errorSummary: "Member notification email delivery mode is off.",
    };
  }

  const presentation = await resolveMemberNotificationEmailPresentation({
    eventType: input.eventType,
    relatedUrl: input.relatedUrl,
    recipientMemberId: input.recipientMemberId,
  });

  if (!presentation.ok) {
    return {
      outcome: "template_failed",
      errorCode: presentation.errorCode,
      errorSummary: "Notification email template resolution failed.",
    };
  }

  // Privacy: never return html/text to worker logs via this result.
  if (input.mode === "dry_run") {
    return {
      outcome: "dry_run_validated",
      providerEmailId: null,
      diagnostics: {
        locale: presentation.locale,
        localeFallback: presentation.localeFallback,
        dir: presentation.dir,
        category: presentation.category,
        deepLinkFallback: presentation.deepLinkFallback,
        templateId: presentation.templateId,
      },
    };
  }

  if (input.mode !== "live") {
    return {
      outcome: "live_not_ready",
      errorCode: "live_not_ready",
      errorSummary: "Member notification email delivery mode is not live.",
    };
  }

  recordMemberNotificationEmailMetric("attempted");
  const gates = await assertMemberNotificationEmailLiveSendGates({
    recipientUserId: input.recipientUserId,
    recipientMemberId: input.recipientMemberId ?? null,
    eventType: input.eventType,
    createdAt: input.createdAt,
    expectedFrequency: "immediate",
  });

  if (!gates.ok) {
    recordMemberNotificationEmailMetric(
      gates.skipReason === "rate_limited" ? "rate_limited" : "live_blocked",
    );
    logMemberNotificationEmailDeliveryEvent({
      channel: "immediate",
      outcome: "gate_failed",
      errorCode: gates.skipReason,
    });
    return {
      outcome: "live_gate_failed",
      errorCode: gates.skipReason,
      errorSummary: "Live notification email send gates failed.",
      terminal: gates.terminal,
    };
  }

  const delivery = await sendMemberNotificationCopyEmail({
    to: gates.destinationEmail,
    ...presentation.mailFields,
  });

  const classified = classifyProviderDeliveryResult(delivery);
  if (classified.outcome === "sent") {
    recordMemberNotificationEmailMetric("accepted");
    logMemberNotificationEmailDeliveryEvent({
      channel: "immediate",
      outcome: "accepted",
    });
    return {
      outcome: "sent",
      providerEmailId: delivery.emailId,
      destinationHash: gates.destinationHash,
    };
  }

  recordMemberNotificationEmailMetric(
    classified.terminal ? "failed" : "retried",
  );
  logMemberNotificationEmailDeliveryEvent({
    channel: "immediate",
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
