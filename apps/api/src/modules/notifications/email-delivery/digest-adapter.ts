/**
 * HU-NOTIF-02C.4 — digest delivery adapter.
 * Dry-run validates template only. Live remains fail-closed (no SMTP).
 */

import type { MemberNotificationEmailDeliveryMode } from "@hu/types";
import type { MemberNotificationEmailDeliveryRecord } from "@hu/types";

import { resolveMemberNotificationEmailDigestPresentation } from "./digest-presentation.js";

export interface MemberNotificationEmailDigestAdapterInput {
  digestId: string;
  frequency: "daily" | "weekly";
  destinationHash: string;
  mode: MemberNotificationEmailDeliveryMode;
  recipientMemberId?: string | null;
  eligibleRecords: MemberNotificationEmailDeliveryRecord[];
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
 * Validates digest presentation. Never calls SMTP / MailDeliveryService send.
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

  return {
    outcome: "live_not_ready",
    errorCode: "live_not_ready",
    errorSummary: "Live member notification digest delivery is not enabled in this phase.",
  };
}
