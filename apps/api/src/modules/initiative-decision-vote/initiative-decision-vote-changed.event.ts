import type { InitiativeDecisionVoteChoice } from "@hu/types";

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

/**
 * Recovery Task 32 Part 6 — one committed Vote version transition = one
 * `InitiativeDecisionVoteChanged` fact. Sufficient for a consumer to act
 * without any source lookup (Part 6): both the previous and new choice, and
 * both the previous and new Vote version, travel in the payload. Does not
 * carry the entire Vote history — only this one completed transition.
 */
export interface InitiativeDecisionVoteChangedPayload extends Record<string, unknown> {
  voteId: string;
  decisionId: string;
  participantId: string;
  initiativeId: string;
  previousChoice: InitiativeDecisionVoteChoice;
  newChoice: InitiativeDecisionVoteChoice;
  changedAt: string;
  previousVoteVersion: number;
  newVoteVersion: number;
}

/**
 * Deterministic, replay-safe event identity (Part 7): each committed Vote
 * version represents one distinct choice-change fact, so identity is keyed
 * on `voteId` plus the resulting `newVoteVersion` — never on
 * `previousChoice`/`newChoice` alone, since a Participant may later return
 * to a prior choice (e.g. support -> abstain -> support), which must
 * produce two distinct events, not be treated as a duplicate of the first.
 * No timestamp, no randomness; stable across a `runMongoTransaction` retry
 * and across a command retry of the same logical transition, because
 * `newVoteVersion` is only ever assigned once per version by the
 * optimistic-concurrency-guarded update (Recovery Task 31 Part 11).
 */
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
  assertNonEmptyEventField(payload.participantId, "participantId", EVENT_NAME);
  assertNonEmptyEventField(payload.initiativeId, "initiativeId", EVENT_NAME);
  assertValidEventChoice(payload.previousChoice, "previousChoice", EVENT_NAME);
  assertValidEventChoice(payload.newChoice, "newChoice", EVENT_NAME);

  if (payload.previousChoice === payload.newChoice) {
    throw new InitiativeDecisionVoteEventValidationError(
      `${EVENT_NAME} payload previousChoice and newChoice must differ.`,
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

/**
 * Recovery Task 32 Part 16 — pure, deterministic factory: no Mongo calls, no
 * Decision/Initiative/Member lookup, no system clock call (the caller
 * supplies `changedAt`, the single mutation timestamp already shared with
 * the Vote update and its history row — Part 8), no random ID generation,
 * no outbox persistence.
 */
export function createInitiativeDecisionVoteChangedEvent(input: {
  voteId: string;
  decisionId: string;
  participantId: string;
  initiativeId: string;
  previousChoice: InitiativeDecisionVoteChoice;
  newChoice: InitiativeDecisionVoteChoice;
  changedAt: string;
  previousVoteVersion: number;
  newVoteVersion: number;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<InitiativeDecisionVoteChangedPayload> {
  const payload: InitiativeDecisionVoteChangedPayload = {
    voteId: input.voteId,
    decisionId: input.decisionId,
    participantId: input.participantId,
    initiativeId: input.initiativeId,
    previousChoice: input.previousChoice,
    newChoice: input.newChoice,
    changedAt: input.changedAt,
    previousVoteVersion: input.previousVoteVersion,
    newVoteVersion: input.newVoteVersion,
  };

  assertValidInitiativeDecisionVoteChangedPayload(payload);

  return createDomainEvent({
    eventId: buildInitiativeDecisionVoteChangedEventId(input.voteId, input.newVoteVersion),
    eventName: CATALOGUE_EVENTS.initiativeDecisionVoteChanged,
    aggregateType: INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE,
    aggregateId: input.voteId,
    payload,
    correlationId: input.correlationId,
    actorId: input.actorId ?? input.participantId,
    occurredAt: input.changedAt,
  });
}
