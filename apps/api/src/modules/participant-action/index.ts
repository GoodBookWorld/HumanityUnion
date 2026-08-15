import { registerDomainEventHandler } from "../../infrastructure/integration/event-handler-registry.js";
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import {
  handlePetitionSignedForParticipantAction,
  PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
} from "./application/petition-signed.participant-action-handler.js";
import {
  handleInitiativeDecisionVoteCastForParticipantAction,
  PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
} from "./application/initiative-decision-vote-cast.participant-action-handler.js";
import {
  handleInitiativeDecisionVoteChangedForParticipantAction,
  PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
} from "./application/initiative-decision-vote-changed.participant-action-handler.js";

let participantActionHandlersRegistered = false;

export function resetParticipantActionHandlersForTests(): void {
  participantActionHandlersRegistered = false;
}

/**
 * Recovery Task 27 Part 8 — registers the `PetitionSigned` consumer,
 * following the existing `registerWorkspaceProjectionHandlers` convention.
 *
 * Recovery Task 33 Part 9/10 adds the second durable Participant Action
 * source: `InitiativeDecisionVoteCast` and `InitiativeDecisionVoteChanged`
 * each get their own dedicated handler and stable, non-colliding consumer
 * ID, registered exactly like `PetitionSigned` — no generic Vote-projection
 * consumer, no custom polling, no direct outbox-collection read outside the
 * dispatcher.
 */
export function registerParticipantActionHandlers(): void {
  if (participantActionHandlersRegistered) {
    return;
  }

  registerDomainEventHandler({
    consumerId: PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.petitionSigned,
    handle: handlePetitionSignedForParticipantAction,
  });

  registerDomainEventHandler({
    consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.initiativeDecisionVoteCast,
    handle: handleInitiativeDecisionVoteCastForParticipantAction,
  });

  registerDomainEventHandler({
    consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.initiativeDecisionVoteChanged,
    handle: handleInitiativeDecisionVoteChangedForParticipantAction,
  });

  participantActionHandlersRegistered = true;
}

export {
  handlePetitionSignedForParticipantAction,
  PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
} from "./application/petition-signed.participant-action-handler.js";
export {
  mapPetitionSignedToParticipantAction,
  validatePetitionSignedEnvelopeForParticipantAction,
} from "./application/petition-signed-to-participant-action.mapper.js";
export {
  handleInitiativeDecisionVoteCastForParticipantAction,
  PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
} from "./application/initiative-decision-vote-cast.participant-action-handler.js";
export {
  mapInitiativeDecisionVoteCastToParticipantAction,
  validateInitiativeDecisionVoteCastEnvelopeForParticipantAction,
} from "./application/initiative-decision-vote-cast-to-participant-action.mapper.js";
export {
  handleInitiativeDecisionVoteChangedForParticipantAction,
  PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
} from "./application/initiative-decision-vote-changed.participant-action-handler.js";
export {
  mapInitiativeDecisionVoteChangedToParticipantAction,
  validateInitiativeDecisionVoteChangedEnvelopeForParticipantAction,
} from "./application/initiative-decision-vote-changed-to-participant-action.mapper.js";
export type {
  InitiativeDecisionVoteCastParticipantActionMetadata,
  InitiativeDecisionVoteChangedParticipantActionMetadata,
  ParticipantActionMetadata,
  ParticipantActionRecord,
  ParticipantActionSourceType,
  ParticipantActionType,
  ParticipantActionValidityStatus,
} from "./domain/participant-action.types.js";
export { buildParticipantActionId } from "./domain/participant-action.types.js";
export {
  ParticipantActionConflictError,
  ParticipantActionPersistenceError,
  ParticipantActionValidationError,
} from "./participant-action.errors.js";
export {
  countParticipantActionsBySourceEventId,
  deleteParticipantActionsByInitiativeIdForTests,
  deleteParticipantActionsByParticipantIdForTests,
  deleteParticipantActionsBySourceEventIdForTests,
  findParticipantActionById,
  findParticipantActionBySourceEventId,
  insertParticipantActionIfAbsent,
  listParticipantActionsByInitiativeId,
  listParticipantActionsByParticipantId,
  setForceParticipantActionInsertFailureForTests,
} from "./infrastructure/participant-action.repository.js";
export type { ParticipantActionInsertOutcome } from "./infrastructure/participant-action.repository.js";
