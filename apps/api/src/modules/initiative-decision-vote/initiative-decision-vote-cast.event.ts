import type { InitiativeDecisionVoteChoiceExtended } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../infrastructure/events/domain-event.js";
import {
  INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE,
  assertNonEmptyEventField,
  assertValidEventChoice,
  assertValidEventTimestamp,
  assertValidEventVoteVersion,
} from "./initiative-decision-vote-event-shared.js";
import { InitiativeDecisionVoteEventValidationError } from "./initiative-decision-vote.errors.js";

const EVENT_NAME = "InitiativeDecisionVoteCast";

/**
 * Pack 02B — participantId optional for visitor casts (visitorKey never on
 * the event payload). choice may be SELECT_ONE `candidate`.
 */
export interface InitiativeDecisionVoteCastPayload extends Record<string, unknown> {
  voteId: string;
  decisionId: string;
  participantId?: string;
  initiativeId: string;
  choice: InitiativeDecisionVoteChoiceExtended;
  candidateId?: string;
  votedAt: string;
  voteVersion: number;
}

export function buildInitiativeDecisionVoteCastEventId(
  voteId: string,
  voteVersion = 1,
): string {
  // Version 1 keeps the historical eventId shape. Re-cast after Recall uses
  // version > 1 and must not collide with the prior cast outbox identity.
  if (voteVersion <= 1) {
    return `initiative-decision-vote-cast:${voteId}`;
  }
  return `initiative-decision-vote-cast:${voteId}:v${voteVersion}`;
}

export function assertValidInitiativeDecisionVoteCastPayload(
  payload: InitiativeDecisionVoteCastPayload,
): void {
  assertNonEmptyEventField(payload.voteId, "voteId", EVENT_NAME);
  assertNonEmptyEventField(payload.decisionId, "decisionId", EVENT_NAME);
  assertNonEmptyEventField(payload.initiativeId, "initiativeId", EVENT_NAME);
  assertValidEventChoice(payload.choice, "choice", EVENT_NAME);
  assertValidEventTimestamp(payload.votedAt, "votedAt", EVENT_NAME);
  assertValidEventVoteVersion(payload.voteVersion, "voteVersion", EVENT_NAME);

  const hasParticipant =
    typeof payload.participantId === "string" && payload.participantId.length > 0;
  if (!hasParticipant && payload.choice !== "candidate" && payload.choice !== "abstain" && payload.choice !== "support" && payload.choice !== "do_not_support") {
    throw new InitiativeDecisionVoteEventValidationError(
      `${EVENT_NAME} payload voter identity is incomplete.`,
    );
  }
}

export function createInitiativeDecisionVoteCastEvent(input: {
  voteId: string;
  decisionId: string;
  participantId?: string;
  initiativeId: string;
  choice: InitiativeDecisionVoteChoiceExtended;
  candidateId?: string;
  votedAt: string;
  voteVersion: number;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<InitiativeDecisionVoteCastPayload> {
  const payload: InitiativeDecisionVoteCastPayload = {
    voteId: input.voteId,
    decisionId: input.decisionId,
    initiativeId: input.initiativeId,
    choice: input.choice,
    votedAt: input.votedAt,
    voteVersion: input.voteVersion,
  };

  if (input.participantId) {
    payload.participantId = input.participantId;
  }
  if (input.candidateId) {
    payload.candidateId = input.candidateId;
  }

  assertValidInitiativeDecisionVoteCastPayload(payload);

  return createDomainEvent({
    eventId: buildInitiativeDecisionVoteCastEventId(input.voteId, input.voteVersion),
    eventName: CATALOGUE_EVENTS.initiativeDecisionVoteCast,
    aggregateType: INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE,
    aggregateId: input.voteId,
    payload,
    correlationId: input.correlationId,
    actorId: input.actorId ?? input.participantId ?? null,
    occurredAt: input.votedAt,
  });
}
