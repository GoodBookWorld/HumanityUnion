import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { DOMAIN_EVENT_SCHEMA_VERSION } from "../../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import {
  PETITION_SIGNATURE_AGGREGATE_TYPE,
  type PetitionSignedPayload,
} from "../../petition/petition-signed.event.js";
import {
  buildParticipantActionId,
  type ParticipantActionRecord,
} from "../domain/participant-action.types.js";
import { ParticipantActionValidationError } from "../participant-action.errors.js";

const VALID_PARTICIPATION_MODES = new Set(["Public", "Anonymous"]);

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParticipantActionValidationError(
      `PetitionSigned payload field "${field}" must be a non-empty string.`,
    );
  }

  return value;
}

function requireIsoTimestamp(value: unknown, field: string): string {
  const raw = requireNonEmptyString(value, field);

  if (Number.isNaN(Date.parse(raw))) {
    throw new ParticipantActionValidationError(
      `PetitionSigned payload field "${field}" must be a valid ISO timestamp.`,
    );
  }

  return raw;
}

/**
 * Recovery Task 27 Part 9 — defensive validation of the durable `PetitionSigned`
 * contract. This never re-validates Petition/Signature/Participant/Initiative
 * existence or earned Member status (Part 9, Part 14) — it only validates the
 * shape of the envelope that was already durably recorded by the producer.
 */
export function validatePetitionSignedEnvelopeForParticipantAction(
  envelope: CanonicalDomainEventEnvelope,
): PetitionSignedPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.petitionSigned) {
    throw new ParticipantActionValidationError(
      `Participant Action projection requires event name "${CATALOGUE_EVENTS.petitionSigned}", got "${envelope.eventName}".`,
    );
  }

  if (envelope.metadata.schemaVersion !== DOMAIN_EVENT_SCHEMA_VERSION) {
    throw new ParticipantActionValidationError(
      `Unsupported PetitionSigned schema version "${String(envelope.metadata.schemaVersion)}".`,
    );
  }

  requireNonEmptyString(envelope.eventId, "eventId");

  if (envelope.aggregateType !== PETITION_SIGNATURE_AGGREGATE_TYPE) {
    throw new ParticipantActionValidationError(
      `Participant Action projection requires aggregateType "${PETITION_SIGNATURE_AGGREGATE_TYPE}", got "${envelope.aggregateType}".`,
    );
  }

  const payload = envelope.payload;

  // Recovery Task 26 corrected the provisional `memberId` field name to
  // `participantId` before any consumer existed. This consumer is the first
  // consumer of the contract, so an obsolete `memberId`-only payload must be
  // explicitly rejected rather than silently accepted or guessed at — no
  // deployed producer or consumer requires `memberId` compatibility.
  if (
    "memberId" in payload &&
    typeof payload.memberId === "string" &&
    typeof payload.participantId !== "string"
  ) {
    throw new ParticipantActionValidationError(
      'PetitionSigned payload uses the obsolete "memberId" field; the canonical field is "participantId".',
    );
  }

  const petitionId = requireNonEmptyString(payload.petitionId, "petitionId");
  const signatureId = requireNonEmptyString(payload.signatureId, "signatureId");
  const participantId = requireNonEmptyString(payload.participantId, "participantId");
  const initiativeId = requireNonEmptyString(payload.initiativeId, "initiativeId");
  const signedAt = requireIsoTimestamp(payload.signedAt, "signedAt");

  if (envelope.aggregateId !== signatureId) {
    throw new ParticipantActionValidationError(
      "PetitionSigned aggregateId must equal payload.signatureId.",
    );
  }

  if (
    payload.participationMode !== null &&
    payload.participationMode !== undefined &&
    !VALID_PARTICIPATION_MODES.has(payload.participationMode as string)
  ) {
    throw new ParticipantActionValidationError(
      `PetitionSigned payload field "participationMode" must be null or a valid participation mode, got "${String(
        payload.participationMode,
      )}".`,
    );
  }

  if (envelope.metadata.occurredAt !== signedAt) {
    throw new ParticipantActionValidationError(
      "PetitionSigned event metadata.occurredAt must be compatible with payload.signedAt.",
    );
  }

  return {
    petitionId,
    signatureId,
    participantId,
    initiativeId,
    participationMode:
      (payload.participationMode as PetitionSignedPayload["participationMode"]) ?? null,
    signedAt,
  };
}

/**
 * Recovery Task 27 Part 10 — pure, Mongo-independent mapping from the
 * durable `PetitionSigned` envelope to a `ParticipantActionRecord`. Reads
 * only fields already present on the envelope; never loads the Petition,
 * Signature, Participant, Initiative, or Member status.
 */
export function mapPetitionSignedToParticipantAction(
  envelope: CanonicalDomainEventEnvelope,
  recordedAt: string,
): ParticipantActionRecord {
  const payload = validatePetitionSignedEnvelopeForParticipantAction(envelope);

  return {
    participantActionId: buildParticipantActionId(envelope.eventId),
    participantId: payload.participantId,
    initiativeId: payload.initiativeId,
    actionType: "petition_signed",
    sourceType: "petition_signature",
    sourceId: payload.signatureId,
    sourceEventId: envelope.eventId,
    sourceEventName: "PetitionSigned",
    sourceEventSchemaVersion: envelope.metadata.schemaVersion,
    occurredAt: payload.signedAt,
    recordedAt,
    validityStatus: "valid",
    correlationId: envelope.metadata.correlationId ?? null,
    causationId: envelope.metadata.causationId ?? null,
    // Recovery Task 33 Part 7 — `metadata` is `null` for `petition_signed`;
    // Petition's mapper needs no per-action metadata beyond the normalized
    // identity fields above, exactly as before this task.
    metadata: null,
  };
}
