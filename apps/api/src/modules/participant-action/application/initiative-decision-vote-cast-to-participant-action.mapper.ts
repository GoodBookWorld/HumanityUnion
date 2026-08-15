import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { DOMAIN_EVENT_SCHEMA_VERSION } from "../../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE } from "../../initiative-decision-vote/initiative-decision-vote-event-shared.js";
import type { InitiativeDecisionVoteCastPayload } from "../../initiative-decision-vote/initiative-decision-vote-cast.event.js";
import {
  buildParticipantActionId,
  type ParticipantActionRecord,
} from "../domain/participant-action.types.js";
import { ParticipantActionValidationError } from "../participant-action.errors.js";
import {
  requireIsoTimestampField,
  requireNonEmptyStringField,
  requireValidVoteChoiceField,
  requireValidVoteVersionField,
} from "./initiative-decision-vote-participant-action-shared.js";

const EVENT_NAME = "InitiativeDecisionVoteCast";

/**
 * Recovery Task 33 Part 5/8 — defensive validation of the durable
 * `InitiativeDecisionVoteCast` contract, mirroring
 * `validatePetitionSignedEnvelopeForParticipantAction`. Never re-validates
 * Vote/Decision/Initiative/Participant/Member existence or eligibility
 * (Part 15/16) — it only validates the shape of the envelope that Recovery
 * Task 32's producer already durably recorded.
 */
export function validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(
  envelope: CanonicalDomainEventEnvelope,
): InitiativeDecisionVoteCastPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.initiativeDecisionVoteCast) {
    throw new ParticipantActionValidationError(
      `Participant Action projection requires event name "${CATALOGUE_EVENTS.initiativeDecisionVoteCast}", got "${envelope.eventName}".`,
    );
  }

  if (envelope.metadata.schemaVersion !== DOMAIN_EVENT_SCHEMA_VERSION) {
    throw new ParticipantActionValidationError(
      `Unsupported ${EVENT_NAME} schema version "${String(envelope.metadata.schemaVersion)}".`,
    );
  }

  requireNonEmptyStringField(envelope.eventId, "eventId", EVENT_NAME);

  if (envelope.aggregateType !== INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE) {
    throw new ParticipantActionValidationError(
      `Participant Action projection requires aggregateType "${INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE}", got "${envelope.aggregateType}".`,
    );
  }

  const payload = envelope.payload;

  const voteId = requireNonEmptyStringField(payload.voteId, "voteId", EVENT_NAME);
  const decisionId = requireNonEmptyStringField(payload.decisionId, "decisionId", EVENT_NAME);
  const participantId = requireNonEmptyStringField(payload.participantId, "participantId", EVENT_NAME);
  const initiativeId = requireNonEmptyStringField(payload.initiativeId, "initiativeId", EVENT_NAME);
  const choice = requireValidVoteChoiceField(payload.choice, "choice", EVENT_NAME);
  const votedAt = requireIsoTimestampField(payload.votedAt, "votedAt", EVENT_NAME);
  const voteVersion = requireValidVoteVersionField(payload.voteVersion, "voteVersion", EVENT_NAME);

  if (envelope.aggregateId !== voteId) {
    throw new ParticipantActionValidationError(
      `${EVENT_NAME} aggregateId must equal payload.voteId.`,
    );
  }

  if (envelope.metadata.occurredAt !== votedAt) {
    throw new ParticipantActionValidationError(
      `${EVENT_NAME} event metadata.occurredAt must be compatible with payload.votedAt.`,
    );
  }

  return {
    voteId,
    decisionId,
    participantId,
    initiativeId,
    choice,
    votedAt,
    voteVersion,
  };
}

/**
 * Recovery Task 33 Part 5/8 — pure, Mongo-independent mapping from the
 * durable `InitiativeDecisionVoteCast` envelope to a `ParticipantActionRecord`.
 * Reads only fields already present on the envelope; never loads the Vote,
 * Collective Decision, Initiative, Participant, or Member status.
 */
export function mapInitiativeDecisionVoteCastToParticipantAction(
  envelope: CanonicalDomainEventEnvelope,
  recordedAt: string,
): ParticipantActionRecord {
  const payload = validateInitiativeDecisionVoteCastEnvelopeForParticipantAction(envelope);

  return {
    participantActionId: buildParticipantActionId(envelope.eventId),
    participantId: payload.participantId,
    initiativeId: payload.initiativeId,
    actionType: "initiative_decision_vote_cast",
    sourceType: "initiative_decision_vote",
    sourceId: payload.voteId,
    sourceEventId: envelope.eventId,
    sourceEventName: "InitiativeDecisionVoteCast",
    sourceEventSchemaVersion: envelope.metadata.schemaVersion,
    occurredAt: payload.votedAt,
    recordedAt,
    validityStatus: "valid",
    correlationId: envelope.metadata.correlationId ?? null,
    causationId: envelope.metadata.causationId ?? null,
    metadata: {
      kind: "initiative_decision_vote_cast",
      decisionId: payload.decisionId,
      choice: payload.choice,
      voteVersion: payload.voteVersion,
    },
  };
}
