/**
 * HU-RRP-07F.7 — map API delivery warning codes to admin catalog keys.
 * Unknown text is shown unchanged so older responses remain readable.
 */

const RRP_DELIVERY_WARNING_MESSAGE_KEYS = {
  rrp_delivery_pending_retry: "messages.deliveryPendingRetry",
  rrp_delivery_failed_terminal: "messages.deliveryFailedTerminal",
  rrp_delivery_previously_failed: "messages.deliveryPreviouslyFailed",
  rrp_delivery_paused: "messages.deliveryPaused",
  rrp_delivery_intent_missing: "messages.deliveryIntentMissing",
  rrp_delivery_appointment_missing: "messages.deliveryAppointmentMissing",
} as const;

export type RrpDeliveryWarningMessageKey =
  (typeof RRP_DELIVERY_WARNING_MESSAGE_KEYS)[keyof typeof RRP_DELIVERY_WARNING_MESSAGE_KEYS];

export function rrpDeliveryWarningMessageKey(
  warning: string,
): RrpDeliveryWarningMessageKey | null {
  if (Object.prototype.hasOwnProperty.call(RRP_DELIVERY_WARNING_MESSAGE_KEYS, warning)) {
    return RRP_DELIVERY_WARNING_MESSAGE_KEYS[warning as keyof typeof RRP_DELIVERY_WARNING_MESSAGE_KEYS];
  }
  return null;
}
