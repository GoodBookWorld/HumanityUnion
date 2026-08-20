import type { InitiativeDecisionVoteChoiceExtended } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../infrastructure/events/domain-event.js";
import { InitiativeDecisionVoteEventValidationError } from "./initiative-decision-vote.errors.js";
import {
  INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE,
  assertNonEmptyEventField,
  assertValidEventChoice,
  assertValidEventTimestamp,
  assertValidEventVoteVersion,
} from "./initiative-decision-vote-event-shared.js";

const EVENT_NAME = "InitiativeDecisionVoteChanged";

export interface InitiativeDecisionVoteChangedPayload extends Record<string, unknown> {
  voteId: string;
  decisionId: string;
  participantId?: string;
  initiativeId: string;
  previousChoice: InitiativeDecisionVoteChoiceExtended;
  newChoice: InitiativeDecisionVoteChoiceExtended;
  previousCandidateId?: string;
  newCandidateId?: string;
  changedAt: string;
  previousVoteVersion: number;
  newVoteVersion: number;
}

export function buildInitiativeDecisionVoteChangedEventId(
  voteId: string,
  newVoteVersion: number,
): string {
  return `initiative-decision-vote-changed:${voteId}:v${newVoteVersion}`;
}

export function assertValidInitiativeDecisionVoteChangedPayload(
  payload: InitiativeDecisionVoteChangedPayload,
): void {
  assertNonEmptyEventField(payload.voteId, "voteId", EVENT_NAME);
  assertNonEmptyEventField(payload.decisionId, "decisionId", EVENT_NAME);
  assertNonEmptyEventField(payload.initiativeId, "initiativeId", EVENT_NAME);
  assertValidEventChoice(payload.previousChoice, "previousChoice", EVENT_NAME);
  assertValidEventChoice(payload.newChoice, "newChoice", EVENT_NAME);

  const sameChoice = payload.previousChoice === payload.newChoice;
  const sameCandidate =
    (payload.previousCandidateId ?? undefined) === (payload.newCandidateId ?? undefined);
  if (sameChoice && sameCandidate) {
    throw new InitiativeDecisionVoteEventValidationError(
      `${EVENT_NAME} payload previous and new ballot must differ.`,
    );
  }

  assertValidEventTimestamp(payload.changedAt, "changedAt", EVENT_NAME);
  assertValidEventVoteVersion(payload.previousVoteVersion, "previousVoteVersion", EVENT_NAME);
  assertValidEventVoteVersion(payload.newVoteVersion, "newVoteVersion", EVENT_NAME);

  if (payload.newVoteVersion !== payload.previousVoteVersion + 1) {
    throw new InitiativeDecisionVoteEventValidationError(
      `${EVENT_NAME} payload newVoteVersion must equal previousVoteVersion + 1.`,
    );
  }
}

export function createInitiativeDecisionVoteChangedEvent(input: {
  voteId: string;
  decisionId: string;
  participantId?: string;
  initiativeId: string;
  previousChoice: InitiativeDecisionVoteChoiceExtended;
  newChoice: InitiativeDecisionVoteChoiceExtended;
  previousCandidateId?: string;
  newCandidateId?: string;
  changedAt: string;
  previousVoteVersion: number;
  newVoteVersion: number;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<InitiativeDecisionVoteChangedPayload> {
  const payload: InitiativeDecisionVoteChangedPayload = {
    voteId: input.voteId,
    decisionId: input.decisionId,
    initiativeId: input.initiativeId,
    previousChoice: input.previousChoice,
    newChoice: input.newChoice,
    changedAt: input.changedAt,
    previousVoteVersion: input.previousVoteVersion,
    newVoteVersion: input.newVoteVersion,
  };

  if (input.participantId) {
    payload.participantId = input.participantId;
  }
  if (input.previousCandidateId) {
    payload.previousCandidateId = input.previousCandidateId;
  }
  if (input.newCandidateId) {
    payload.newCandidateId = input.newCandidateId;
  }

  assertValidInitiativeDecisionVoteChangedPayload(payload);

  return createDomainEvent({
    eventId: buildInitiativeDecisionVoteChangedEventId(input.voteId, input.newVoteVersion),
    eventName: CATALOGUE_EVENTS.initiativeDecisionVoteChanged,
    aggregateType: INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE,
    aggregateId: input.voteId,
    payload,
    correlationId: input.correlationId,
    actorId: input.actorId ?? input.participantId ?? null,
    occurredAt: input.changedAt,
  });
}
