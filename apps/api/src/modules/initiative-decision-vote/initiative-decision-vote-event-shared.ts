import type { InitiativeDecisionVoteChoice } from "@hu/types";

import { InitiativeDecisionVoteEventValidationError } from "./initiative-decision-vote.errors.js";

/**
 * Recovery Task 32 Part 4 — both `InitiativeDecisionVoteCast` and
 * `InitiativeDecisionVoteChanged` share the same owning Aggregate: the
 * `InitiativeDecisionVote` itself (never the parent Collective Decision, the
 * Participant, the history row, or the outbox document). `aggregateId` is
 * always the deterministic `voteId` recovered in Recovery Task 31.
 */
export const INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE = "InitiativeDecisionVote" as const;

const VALID_EVENT_CHOICES = new Set<InitiativeDecisionVoteChoice>([
  "support",
  "do_not_support",
  "abstain",
]);

/**
 * Recovery Task 32 Part 15 — narrow, pure, runtime payload validation shared
 * by both event factories. This intentionally does not become "a parallel
 * Vote-specific event framework" (Part 1): it validates only these two
 * payload shapes, reuses the existing `DomainEvent`/outbox/dispatcher
 * infrastructure unchanged, and does not introduce a generic schema
 * registry. The repository's established precedent (`PetitionSignedPayload`
 * in `petition-signed.event.ts`) relies on TypeScript compile-time typing
 * alone with no runtime payload validator; Part 15 explicitly requires more
 * for Vote, so this is an intentional, narrowly-scoped addition rather than
 * a divergence made silently — see the Task 32 readiness-doc addendum for
 * the documented difference from the Petition precedent.
 */
export function assertNonEmptyEventField(
  value: unknown,
  field: string,
  eventName: string,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new InitiativeDecisionVoteEventValidationError(
      `${eventName} payload is missing a valid ${field}.`,
    );
  }
}

export function assertValidEventChoice(
  value: unknown,
  field: string,
  eventName: string,
): asserts value is InitiativeDecisionVoteChoice {
  if (typeof value !== "string" || !VALID_EVENT_CHOICES.has(value as InitiativeDecisionVoteChoice)) {
    throw new InitiativeDecisionVoteEventValidationError(
      `${eventName} payload has an invalid ${field}.`,
    );
  }
}

export function assertValidEventTimestamp(
  value: unknown,
  field: string,
  eventName: string,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || Number.isNaN(Date.parse(value))) {
    throw new InitiativeDecisionVoteEventValidationError(
      `${eventName} payload has an invalid ${field}.`,
    );
  }
}

export function assertValidEventVoteVersion(
  value: unknown,
  field: string,
  eventName: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new InitiativeDecisionVoteEventValidationError(
      `${eventName} payload has an invalid ${field}.`,
    );
  }
}
