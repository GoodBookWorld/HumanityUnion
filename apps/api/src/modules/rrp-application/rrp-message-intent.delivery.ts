/**
 * HU-RRP-03E — best-effort DM delivery for durable RRP message intents.
 * Never rolls back application/appointment decisions.
 */

import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import {
  openOrCreateDirectConversation,
  sendDirectMessage,
} from "../direct-messaging/direct-messaging.service.js";
import { resolveLocaleWithEnglishFallback } from "../language/language-registry-runtime.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { findPreferencesByMemberId } from "../preferences/preferences.repository.js";
import type { RrpAppointmentMessageIntentRecord } from "./rrp-appointment-message-intent.repository.js";
import {
  findRrpAppointmentMessageIntentByAppointmentId,
  findRrpMessageIntentById,
  markRrpMessageIntentDelivered,
  recordRrpMessageIntentDeliveryAttempt,
} from "./rrp-appointment-message-intent.repository.js";
import {
  renderAppointmentWelcomeMessage,
  selectWelcomeDisplayName,
} from "./rrp-appointment-welcome-message.js";
import { resolveRrpMessageBrandSiteName } from "./rrp-message-brand.js";
import { renderRequestInformationMessage } from "./rrp-request-information-message.js";
import { isRrpApplicationWritesEnabled } from "./rrp-application-writes.activation.js";

/** Stable codes. The admin dialog localizes these; logs keep the diagnostic error. */
export const RRP_DELIVERY_WARNING = {
  pendingRetry: "rrp_delivery_pending_retry",
  failedTerminal: "rrp_delivery_failed_terminal",
  previouslyFailed: "rrp_delivery_previously_failed",
  paused: "rrp_delivery_paused",
  intentMissing: "rrp_delivery_intent_missing",
  appointmentMissing: "rrp_delivery_appointment_missing",
} as const;

export function isTerminalRrpDeliveryWarning(warning: string): boolean {
  return (
    warning === RRP_DELIVERY_WARNING.failedTerminal ||
    warning === RRP_DELIVERY_WARNING.previouslyFailed ||
    warning.includes("maximum retries") ||
    warning.includes("permanently")
  );
}

export function buildSafeApprovalMessageText(
  representCountryCode: string,
  input?: { displayName?: string | null; locale?: string | null },
): string {
  return renderAppointmentWelcomeMessage({
    displayName: input?.displayName,
    countryCode: representCountryCode,
    locale: input?.locale ?? "en",
  });
}

/**
 * Public display name and interface language, read when the message is sent.
 * A missing profile or an unavailable store becomes a nameless English greeting.
 * The rendered text is not written back onto the intent.
 */
export async function resolveAppointmentWelcomeContext(recipientParticipantId: string): Promise<{
  displayName: string | null;
  locale: string;
}> {
  let displayName: string | null = null;
  try {
    const authUser = await findAuthUserByMemberId(recipientParticipantId);
    let profileDisplayName: string | null = null;
    if (authUser?.userId) {
      try {
        const profile = await findMemberProfileByUserId(authUser.userId);
        profileDisplayName = profile?.displayName ?? null;
      } catch {
        profileDisplayName = null;
      }
    }
    displayName = selectWelcomeDisplayName({
      profileDisplayName,
      authDisplayName: authUser?.displayName ?? null,
    });
  } catch {
    displayName = null;
  }

  try {
    const preferences = await findPreferencesByMemberId(recipientParticipantId);
    const locale = await resolveLocaleWithEnglishFallback(
      preferences?.experiencePreferences.interfaceLanguage ?? null,
    );
    return { displayName, locale };
  } catch {
    return { displayName, locale: "en" };
  }
}

export function buildSafeRequestInformationMessageText(input: {
  representCountryCode: string;
  requestExplanation?: string | null;
  locale?: string | null;
}): string {
  return renderRequestInformationMessage({
    countryCode: input.representCountryCode,
    requestExplanation: input.requestExplanation,
    locale: input.locale,
  });
}

async function buildMessageText(intent: RrpAppointmentMessageIntentRecord): Promise<string> {
  if (intent.kind === "request_information") {
    const context = await resolveAppointmentWelcomeContext(intent.recipientParticipantId);
    const siteName = await resolveRrpMessageBrandSiteName(context.locale);
    return renderRequestInformationMessage({
      countryCode: intent.representCountryCode,
      requestExplanation: intent.requestExplanation,
      locale: context.locale,
      siteName,
    });
  }
  const welcome = await resolveAppointmentWelcomeContext(intent.recipientParticipantId);
  const siteName = await resolveRrpMessageBrandSiteName(welcome.locale);
  return renderAppointmentWelcomeMessage({
    displayName: welcome.displayName,
    countryCode: intent.representCountryCode,
    locale: welcome.locale,
    siteName,
  });
}

/**
 * Deliver one intent. Returns warning when delivery did not complete.
 * Appointment/application decisions are never rolled back here.
 */
export async function deliverRrpMessageIntentBestEffort(
  intent: RrpAppointmentMessageIntentRecord,
): Promise<string | undefined> {
  if (intent.status === "delivered") {
    return undefined;
  }
  if (intent.status === "failed") {
    return RRP_DELIVERY_WARNING.previouslyFailed;
  }

  // HU-RRP-03L.2 — with writes OFF, do not open/create DMs or mutate intent rows.
  if (!isRrpApplicationWritesEnabled()) {
    return RRP_DELIVERY_WARNING.paused;
  }

  try {
    const conversation = await openOrCreateDirectConversation(intent.adminParticipantId, {
      participantId: intent.recipientParticipantId,
    });
    await sendDirectMessage({
      conversationId: conversation.conversationId,
      senderParticipantId: intent.adminParticipantId,
      text: await buildMessageText(intent),
      clientMessageId: intent.clientMessageId,
    });
    await markRrpMessageIntentDelivered(intent.intentId);
    return undefined;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to deliver RRP notification message.";
    // Log only safe diagnostics — no DOB, funding, or narrative payloads.
    console.warn(
      JSON.stringify({
        event: "rrp_message_intent_delivery_failed",
        intentId: intent.intentId,
        kind: intent.kind,
        applicationId: intent.applicationId,
        appointmentId: intent.appointmentId,
        deliveryAttempts: intent.deliveryAttempts + 1,
        // Truncated safe error class only.
        error: message.slice(0, 200),
      }),
    );
    const updated = await recordRrpMessageIntentDeliveryAttempt(intent.intentId, message);
    if (updated?.status === "failed") {
      return RRP_DELIVERY_WARNING.failedTerminal;
    }
    return RRP_DELIVERY_WARNING.pendingRetry;
  }
}

export async function retryRrpMessageIntentDeliveryById(
  intentId: string,
): Promise<{ delivered: boolean; warning?: string; status?: string }> {
  const intent = await findRrpMessageIntentById(intentId);
  if (!intent) {
    return { delivered: false, warning: RRP_DELIVERY_WARNING.intentMissing };
  }
  if (intent.status === "delivered") {
    return { delivered: true, status: "delivered" };
  }
  if (intent.status === "failed") {
    return {
      delivered: false,
      status: "failed",
      warning: RRP_DELIVERY_WARNING.previouslyFailed,
    };
  }
  const warning = await deliverRrpMessageIntentBestEffort(intent);
  if (warning) {
    return {
      delivered: false,
      warning,
      status: isTerminalRrpDeliveryWarning(warning) ? "failed" : "pending",
    };
  }
  return { delivered: true, status: "delivered" };
}

/** Manual retry for appointment approval intents (stable clientMessageId). */
export async function retryRrpAppointmentMessageIntentDelivery(
  appointmentId: string,
): Promise<{ delivered: boolean; warning?: string }> {
  const intent = await findRrpAppointmentMessageIntentByAppointmentId(appointmentId);
  if (!intent) {
    return { delivered: false, warning: RRP_DELIVERY_WARNING.appointmentMissing };
  }
  const result = await retryRrpMessageIntentDeliveryById(intent.intentId);
  return { delivered: result.delivered, warning: result.warning };
}
