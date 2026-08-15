import type { InitiativeDecisionVoteChoice } from "@hu/types";

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

const EVENT_NAME = "InitiativeDecisionVoteCast";

/**
 * Recovery Task 32 Part 5 — thin, privacy-safe, completed-fact payload for
 * the first valid cast on a given (`decisionId`, `participantId`) pair.
 *
 * Deliberately excluded (Part 5): Member ID as a separate actor field,
 * Member status, display name, email, profile data, Decision title,
 * Initiative title, mutable Vote totals, transparency cohort, full Decision
 * or Initiative objects, Fair, Journey, Activity, notification
 * instructions, request metadata, IP address, user agent.
 *
 * `participantId` (Part 18, mirroring the Recovery Task 26 correction
 * already applied to `PetitionSignedPayload`): the platform is
 * participant-first — Voting never requires, checks, or depends on Member
 * status, so the payload never carries `memberId`.
 *
 * `initiativeId` (Part 19) is read directly from the already-committed Vote
 * record (persisted at first cast by Recovery Task 31) — zero post-commit
 * Initiative/Decision lookup is performed to build this payload.
 */
export interface InitiativeDecisionVoteCastPayload extends Record<string, unknown> {
  voteId: string;
  decisionId: string;
  participantId: string;
  initiativeId: string;
  choice: InitiativeDecisionVoteChoice;
  votedAt: string;
  voteVersion: number;
}

/**
 * Deterministic, replay-safe event identity (Part 7): one logical Vote has
 * exactly one first-cast fact, so the event ID is derived from the
 * already-deterministic, already-uniquely-enforced `voteId`
 * (`initiative-decision-vote:${decisionId}:${participantId}`, Recovery Task
 * 31) — stable across a `runMongoTransaction` retry and across a command
 * retry of the same logical first cast, with no timestamp or randomness.
 */
export function buildInitiativeDecisionVoteCastEventId(voteId: string): string {
  return `initiative-decision-vote-cast:${voteId}`;
}

export function assertValidInitiativeDecisionVoteCastPayload(
  payload: InitiativeDecisionVoteCastPayload,
): void {
  assertNonEmptyEventField(payload.voteId, "voteId", EVENT_NAME);
  assertNonEmptyEventField(payload.decisionId, "decisionId", EVENT_NAME);
  assertNonEmptyEventField(payload.participantId, "participantId", EVENT_NAME);
  assertNonEmptyEventField(payload.initiativeId, "initiativeId", EVENT_NAME);
  assertValidEventChoice(payload.choice, "choice", EVENT_NAME);
  assertValidEventTimestamp(payload.votedAt, "votedAt", EVENT_NAME);
  assertValidEventVoteVersion(payload.voteVersion, "voteVersion", EVENT_NAME);
}

/**
 * Recovery Task 32 Part 16 — pure, deterministic factory: no Mongo calls, no
 * Decision/Initiative/Member lookup, no system clock call (the caller
 * supplies `votedAt`, the single mutation timestamp already used for the
 * Vote document and its history row — Part 8), no random ID generation, and
 * no outbox persistence. The caller (`castOrChangeInitiativeDecisionVote`)
 * is solely responsible for enqueueing the returned event inside the same
 * `ClientSession` as the Vote/history writes (Part 17 producer boundary).
 */
export function createInitiativeDecisionVoteCastEvent(input: {
  voteId: string;
  decisionId: string;
  participantId: string;
  initiativeId: string;
  choice: InitiativeDecisionVoteChoice;
  votedAt: string;
  voteVersion: number;
  correlationId?: string;
  actorId?: string | null;
}): DomainEvent<InitiativeDecisionVoteCastPayload> {
  const payload: InitiativeDecisionVoteCastPayload = {
    voteId: input.voteId,
    decisionId: input.decisionId,
    participantId: input.participantId,
    initiativeId: input.initiativeId,
    choice: input.choice,
    votedAt: input.votedAt,
    voteVersion: input.voteVersion,
  };

  assertValidInitiativeDecisionVoteCastPayload(payload);

  return createDomainEvent({
    eventId: buildInitiativeDecisionVoteCastEventId(input.voteId),
    eventName: CATALOGUE_EVENTS.initiativeDecisionVoteCast,
    aggregateType: INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE,
    aggregateId: input.voteId,
    payload,
    correlationId: input.correlationId,
    actorId: input.actorId ?? input.participantId,
    occurredAt: input.votedAt,
  });
}
