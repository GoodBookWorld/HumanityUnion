/** HU-RRP-03E — durable RRP Messages intents + bounded retry. */

export const RRP_MESSAGE_INTENT_KINDS = [
  "appointment_approval",
  "request_information",
] as const;

export type RrpMessageIntentKind = (typeof RRP_MESSAGE_INTENT_KINDS)[number];

export const RRP_MESSAGE_INTENT_MAX_DELIVERY_ATTEMPTS = 8;

/** Interval for the in-process reconcile scheduler. */
export const RRP_MESSAGE_INTENT_RECONCILE_INTERVAL_MS = 60_000;

/** Max pending intents claimed per tick. */
export const RRP_MESSAGE_INTENT_RECONCILE_LIMIT = 20;

/** Exclusive claim lease duration for multi-instance worker safety. */
export const RRP_MESSAGE_INTENT_CLAIM_LEASE_MS = 60_000;

/**
 * Backoff delays (ms) indexed by completed deliveryAttempts before the next try.
 * Attempt 0 → immediate; then 30s, 1m, 2m, 5m, 15m, 30m, 60m.
 */
export const RRP_MESSAGE_INTENT_RETRY_BACKOFF_MS: readonly number[] = [
  0,
  30_000,
  60_000,
  120_000,
  300_000,
  900_000,
  1_800_000,
  3_600_000,
] as const;

export function computeRrpMessageIntentNextRetryAt(input: {
  deliveryAttempts: number;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const index = Math.min(
    Math.max(input.deliveryAttempts, 0),
    RRP_MESSAGE_INTENT_RETRY_BACKOFF_MS.length - 1,
  );
  const delay = RRP_MESSAGE_INTENT_RETRY_BACKOFF_MS[index] ?? 3_600_000;
  return new Date(now.getTime() + delay).toISOString();
}

/** Unique clientMessageId — also the DM idempotency key. */
export function buildRrpAppointmentApprovalClientMessageId(appointmentId: string): string {
  return `rrp-appointment:${appointmentId}`;
}

export function buildRrpRequestInformationClientMessageId(input: {
  applicationId: string;
  applicationRevision: number;
}): string {
  return `rrp-request-info:${input.applicationId}:r${input.applicationRevision}`;
}

export const RRP_MESSAGE_INTENT_CLIENT_MESSAGE_ID_UNIQUE_INDEX_NAME =
  "rrp_message_intent_client_message_id_unique" as const;

/** Sparse unique: only appointment_approval rows with a string appointmentId. */
export const RRP_APPOINTMENT_MESSAGE_INTENT_APPOINTMENT_SPARSE_UNIQUE_INDEX_NAME =
  "rrp_appointment_message_intent_appointment_sparse_unique" as const;
