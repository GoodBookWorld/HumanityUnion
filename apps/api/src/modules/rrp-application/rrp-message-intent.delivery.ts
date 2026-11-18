/**
 * HU-RRP-03E — best-effort DM delivery for durable RRP message intents.
 * Never rolls back application/appointment decisions.
 */

import {
  openOrCreateDirectConversation,
  sendDirectMessage,
} from "../direct-messaging/direct-messaging.service.js";
import type { RrpAppointmentMessageIntentRecord } from "./rrp-appointment-message-intent.repository.js";
import {
  findRrpAppointmentMessageIntentByAppointmentId,
  findRrpMessageIntentById,
  markRrpMessageIntentDelivered,
  recordRrpMessageIntentDeliveryAttempt,
} from "./rrp-appointment-message-intent.repository.js";

function sanitizeExplanation(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  // Bound length; do not attempt to parse application PII fields into the body.
  return trimmed.slice(0, 1200);
}

export function buildSafeApprovalMessageText(representCountryCode: string): string {
  return [
    "Your Regional Representative application has been approved.",
    `You are designated as a Representative for ${representCountryCode} on the platform.`,
    "This is an internal platform designation only — not legal authority, employment, or funding entitlement.",
    "This decision does not grant administrator privileges and creates no funding commitment.",
    "Open Workspace → My Regional Applications to view status. Reply in Workspace → Messages if needed.",
  ].join(" ");
}

export function buildSafeRequestInformationMessageText(input: {
  representCountryCode: string;
  applicationId: string;
  requestExplanation: string;
}): string {
  const explanation = sanitizeExplanation(input.requestExplanation);
  return [
    `An administrator has requested more information about your Regional Representative application for ${input.representCountryCode}.`,
    `Application reference: ${input.applicationId}.`,
    `What is needed: ${explanation}`,
    "Update your application in Workspace → My Regional Applications, and reply in Workspace → Messages.",
    "This message does not change your account role or grant legal authority.",
  ].join(" ");
}

function buildMessageText(intent: RrpAppointmentMessageIntentRecord): string {
  if (intent.kind === "request_information") {
    return buildSafeRequestInformationMessageText({
      representCountryCode: intent.representCountryCode,
      applicationId: intent.applicationId,
      requestExplanation: intent.requestExplanation ?? "Please provide the requested information.",
    });
  }
  return buildSafeApprovalMessageText(intent.representCountryCode);
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
    return "Messages notification previously failed permanently. Use Messages to contact the participant if needed.";
  }

  try {
    const conversation = await openOrCreateDirectConversation(intent.adminParticipantId, {
      participantId: intent.recipientParticipantId,
    });
    await sendDirectMessage({
      conversationId: conversation.conversationId,
      senderParticipantId: intent.adminParticipantId,
      text: buildMessageText(intent),
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
      return "Decision succeeded, but the Messages notification failed after maximum retries. Contact the participant from Messages if needed.";
    }
    return "Decision succeeded, but the Messages notification could not be delivered. Intent remains pending for automatic retry.";
  }
}

export async function retryRrpMessageIntentDeliveryById(
  intentId: string,
): Promise<{ delivered: boolean; warning?: string; status?: string }> {
  const intent = await findRrpMessageIntentById(intentId);
  if (!intent) {
    return { delivered: false, warning: "No message intent found." };
  }
  if (intent.status === "delivered") {
    return { delivered: true, status: "delivered" };
  }
  if (intent.status === "failed") {
    return {
      delivered: false,
      status: "failed",
      warning:
        "Messages notification previously failed permanently. Use Messages to contact the participant if needed.",
    };
  }
  const warning = await deliverRrpMessageIntentBestEffort(intent);
  if (warning) {
    return { delivered: false, warning, status: "pending" };
  }
  return { delivered: true, status: "delivered" };
}

/** Manual retry for appointment approval intents (stable clientMessageId). */
export async function retryRrpAppointmentMessageIntentDelivery(
  appointmentId: string,
): Promise<{ delivered: boolean; warning?: string }> {
  const intent = await findRrpAppointmentMessageIntentByAppointmentId(appointmentId);
  if (!intent) {
    return { delivered: false, warning: "No message intent found for this appointment." };
  }
  const result = await retryRrpMessageIntentDeliveryById(intent.intentId);
  return { delivered: result.delivered, warning: result.warning };
}
