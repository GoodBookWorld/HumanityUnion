/** HU-RRP-03C — appointment uniqueness and indexing. */

export const RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_NAME =
  "rrp_appointment_one_active_per_participant_country" as const;

export const RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_DESCRIPTION = {
  key: { participantId: 1, representCountryCode: 1 },
  unique: true,
  partialFilterExpression: { status: "active" },
} as const;

/** Durable post-approval Messages intent (idempotent per appointment). */
export const RRP_APPOINTMENT_MESSAGE_INTENT_UNIQUE_INDEX_NAME =
  "rrp_appointment_message_intent_appointment_unique" as const;
