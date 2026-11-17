/**
 * HU-NOTIF-02C.2 — isolated delivery adapter.
 * Dry-run validates payload without SMTP.
 * Live mode fail-closed until approved templates/privacy review (no MailDeliveryService call).
 */

import type { MemberNotificationEmailDeliveryMode } from "@hu/types";

export interface MemberNotificationEmailDeliveryAdapterInput {
  deliveryId: string;
  notificationId: string;
  eventType: string;
  destinationHash: string;
  mode: MemberNotificationEmailDeliveryMode;
}

export type MemberNotificationEmailDeliveryAdapterResult =
  | {
      outcome: "dry_run_validated";
      /** Never a real provider id. */
      providerEmailId: null;
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
 * Validates a safe metadata-only payload. Never calls SMTP / MailDeliveryService.
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

  if (input.mode === "dry_run") {
    return { outcome: "dry_run_validated", providerEmailId: null };
  }

  if (input.mode === "live") {
    // Fail closed: templates/privacy review not approved in this phase.
    return {
      outcome: "live_not_ready",
      errorCode: "live_not_ready",
      errorSummary: "Live member notification email delivery is not enabled in this phase.",
    };
  }

  return {
    outcome: "mode_off",
    errorCode: "mode_off",
    errorSummary: "Member notification email delivery mode is off.",
  };
}
