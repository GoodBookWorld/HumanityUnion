import type { InitiativeDecisionVoteChoice } from "@hu/types";

import { ParticipantActionValidationError } from "../participant-action.errors.js";

/**
 * Recovery Task 33 Part 8 — narrow, pure, runtime validation shared by the
 * two Vote-to-Participant-Action mappers only (`initiative-decision-vote-
 * cast-to-participant-action.mapper.ts` and `initiative-decision-vote-
 * changed-to-participant-action.mapper.ts`). This mirrors the producer's own
 * `initiative-decision-vote-event-shared.ts` precedent — a narrowly-scoped,
 * two-consumer shared helper file, not a generic cross-module validation
 * framework — and never re-validates Vote/Decision/Initiative/Participant/
 * Member existence: it only checks the shape of an envelope that was
 * already durably recorded by the Recovery Task 32 producer.
 */
const VALID_INITIATIVE_DECISION_VOTE_CHOICES = new Set<InitiativeDecisionVoteChoice>([
  "support",
  "do_not_support",
  "abstain",
]);

export function requireNonEmptyStringField(value: unknown, field: string, eventName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParticipantActionValidationError(
      `${eventName} payload field "${field}" must be a non-empty string.`,
    );
  }

  return value;
}

export function requireIsoTimestampField(value: unknown, field: string, eventName: string): string {
  const raw = requireNonEmptyStringField(value, field, eventName);

  if (Number.isNaN(Date.parse(raw))) {
    throw new ParticipantActionValidationError(
      `${eventName} payload field "${field}" must be a valid ISO timestamp.`,
    );
  }

  return raw;
}

export function requireValidVoteChoiceField(
  value: unknown,
  field: string,
  eventName: string,
): InitiativeDecisionVoteChoice {
  if (
    typeof value !== "string" ||
    !VALID_INITIATIVE_DECISION_VOTE_CHOICES.has(value as InitiativeDecisionVoteChoice)
  ) {
    throw new ParticipantActionValidationError(
      `${eventName} payload field "${field}" must be a valid Initiative Decision Vote choice.`,
    );
  }

  return value as InitiativeDecisionVoteChoice;
}

export function requireValidVoteVersionField(value: unknown, field: string, eventName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ParticipantActionValidationError(
      `${eventName} payload field "${field}" must be a positive integer.`,
    );
  }

  return value;
}
