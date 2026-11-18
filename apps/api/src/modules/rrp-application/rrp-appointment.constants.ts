/** HU-RRP-03C — appointment uniqueness and indexing. */

export const RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_NAME =
  "rrp_appointment_one_active_per_participant_country" as const;

export const RRP_APPOINTMENT_ACTIVE_UNIQUE_INDEX_DESCRIPTION = {
  key: { participantId: 1, representCountryCode: 1 },
  unique: true,
  partialFilterExpression: { status: "active" },
} as const;

/**
 * Sparse unique appointmentId for approval intents only.
 * Prefer clientMessageId uniqueness for all intent kinds (see rrp-message-intent.constants).
 */
export const RRP_APPOINTMENT_MESSAGE_INTENT_UNIQUE_INDEX_NAME =
  "rrp_appointment_message_intent_appointment_sparse_unique" as const;

export {
  RRP_MESSAGE_INTENT_CLIENT_MESSAGE_ID_UNIQUE_INDEX_NAME,
  RRP_APPOINTMENT_MESSAGE_INTENT_APPOINTMENT_SPARSE_UNIQUE_INDEX_NAME,
} from "./rrp-message-intent.constants.js";
