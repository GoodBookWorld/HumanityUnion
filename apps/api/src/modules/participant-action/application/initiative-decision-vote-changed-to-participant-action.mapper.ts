import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { DOMAIN_EVENT_SCHEMA_VERSION } from "../../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE } from "../../initiative-decision-vote/initiative-decision-vote-event-shared.js";
import type { InitiativeDecisionVoteChangedPayload } from "../../initiative-decision-vote/initiative-decision-vote-changed.event.js";
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

const EVENT_NAME = "InitiativeDecisionVoteChanged";

/**
 * Recovery Task 33 Part 6/8 — defensive validation of the durable
 * `InitiativeDecisionVoteChanged` contract, mirroring
 * `validateInitiativeDecisionVoteCastEnvelopeForParticipantAction`. Never
 * re-validates Vote/Decision/Initiative/Participant/Member existence or
 * eligibility (Part 15/16) — it only validates the shape of the envelope
 * that Recovery Task 32's producer already durably recorded. This
 * projection never requires the corresponding Cast Participant Action to
 * exist first (Part 14) — every field a Changed action needs travels in
 * this one envelope.
 */
export function validateInitiativeDecisionVoteChangedEnvelopeForParticipantAction(
  envelope: CanonicalDomainEventEnvelope,
): InitiativeDecisionVoteChangedPayload {
  if (envelope.eventName !== CATALOGUE_EVENTS.initiativeDecisionVoteChanged) {
    throw new ParticipantActionValidationError(
      `Participant Action projection requires event name "${CATALOGUE_EVENTS.initiativeDecisionVoteChanged}", got "${envelope.eventName}".`,
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
  const previousChoice = requireValidVoteChoiceField(payload.previousChoice, "previousChoice", EVENT_NAME);
  const newChoice = requireValidVoteChoiceField(payload.newChoice, "newChoice", EVENT_NAME);

  if (previousChoice === newChoice) {
    throw new ParticipantActionValidationError(
      `${EVENT_NAME} payload previousChoice and newChoice must differ.`,
    );
  }

  const changedAt = requireIsoTimestampField(payload.changedAt, "changedAt", EVENT_NAME);
  const previousVoteVersion = requireValidVoteVersionField(
    payload.previousVoteVersion,
    "previousVoteVersion",
    EVENT_NAME,
  );
  const newVoteVersion = requireValidVoteVersionField(payload.newVoteVersion, "newVoteVersion", EVENT_NAME);

  if (newVoteVersion !== previousVoteVersion + 1) {
    throw new ParticipantActionValidationError(
      `${EVENT_NAME} payload newVoteVersion must equal previousVoteVersion + 1.`,
    );
  }

  if (envelope.aggregateId !== voteId) {
    throw new ParticipantActionValidationError(
      `${EVENT_NAME} aggregateId must equal payload.voteId.`,
    );
  }

  if (envelope.metadata.occurredAt !== changedAt) {
    throw new ParticipantActionValidationError(
      `${EVENT_NAME} event metadata.occurredAt must be compatible with payload.changedAt.`,
    );
  }

  return {
    voteId,
    decisionId,
    participantId,
    initiativeId,
    previousChoice,
    newChoice,
    changedAt,
    previousVoteVersion,
    newVoteVersion,
  };
}

/**
 * Recovery Task 33 Part 6/8 — pure, Mongo-independent mapping from the
 * durable `InitiativeDecisionVoteChanged` envelope to a
 * `ParticipantActionRecord`. This action represents the completed change
 * fact; it never replaces the Cast action or an earlier Changed action
 * (Part 13 append-only enforcement lives in the repository/handler layer,
 * not here — this mapper never performs an insert, update, or lookup of any
 * kind).
 */
export function mapInitiativeDecisionVoteChangedToParticipantAction(
  envelope: CanonicalDomainEventEnvelope,
  recordedAt: string,
): ParticipantActionRecord {
  const payload = validateInitiativeDecisionVoteChangedEnvelopeForParticipantAction(envelope);

  return {
    participantActionId: buildParticipantActionId(envelope.eventId),
    participantId: payload.participantId,
    initiativeId: payload.initiativeId,
    actionType: "initiative_decision_vote_changed",
    sourceType: "initiative_decision_vote",
    sourceId: payload.voteId,
    sourceEventId: envelope.eventId,
    sourceEventName: "InitiativeDecisionVoteChanged",
    sourceEventSchemaVersion: envelope.metadata.schemaVersion,
    occurredAt: payload.changedAt,
    recordedAt,
    validityStatus: "valid",
    correlationId: envelope.metadata.correlationId ?? null,
    causationId: envelope.metadata.causationId ?? null,
    metadata: {
      kind: "initiative_decision_vote_changed",
      decisionId: payload.decisionId,
      previousChoice: payload.previousChoice,
      newChoice: payload.newChoice,
      previousVoteVersion: payload.previousVoteVersion,
      newVoteVersion: payload.newVoteVersion,
    },
  };
}
