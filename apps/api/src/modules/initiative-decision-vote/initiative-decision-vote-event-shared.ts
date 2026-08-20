import type { InitiativeDecisionVoteChoiceExtended } from "@hu/types";

import { InitiativeDecisionVoteEventValidationError } from "./initiative-decision-vote.errors.js";

/**
 * Recovery Task 32 Part 4 — both cast and changed events share Aggregate
 * `InitiativeDecisionVote`; aggregateId is always the deterministic voteId.
 */
export const INITIATIVE_DECISION_VOTE_AGGREGATE_TYPE = "InitiativeDecisionVote" as const;

const VALID_EVENT_CHOICES = new Set<string>([
  "support",
  "do_not_support",
  "abstain",
  "candidate",
]);

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
): asserts value is InitiativeDecisionVoteChoiceExtended {
  if (typeof value !== "string" || !VALID_EVENT_CHOICES.has(value)) {
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
