/**
 * HU-NOTIF-02C.2 / 02C.3 — isolated delivery adapter.
 * Dry-run: locale + template + safe-link validation; never SMTP.
 * Live: fail-closed until approved SMTP activation (still no MailDeliveryService send).
 */

import type { MemberNotificationEmailDeliveryMode } from "@hu/types";

import { resolveMemberNotificationEmailPresentation } from "./presentation.js";

export interface MemberNotificationEmailDeliveryAdapterInput {
  deliveryId: string;
  notificationId: string;
  eventType: string;
  destinationHash: string;
  mode: MemberNotificationEmailDeliveryMode;
  recipientMemberId?: string | null;
  relatedUrl?: string | null;
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
      outcome: "template_failed";
      errorCode: string;
      errorSummary: string;
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
 * Validates presentation + safe links. Never calls SMTP / MailDeliveryService send.
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

  // Live SMTP still disabled in this phase after successful template validation.
  return {
    outcome: "live_not_ready",
    errorCode: "live_not_ready",
    errorSummary: "Live member notification email delivery is not enabled in this phase.",
  };
}
