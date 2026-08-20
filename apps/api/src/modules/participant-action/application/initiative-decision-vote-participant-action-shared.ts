import type { InitiativeDecisionVoteChoiceExtended } from "@hu/types";

import { ParticipantActionValidationError } from "../participant-action.errors.js";

/**
 * Recovery Task 33 Part 8 — narrow validation for Vote→ParticipantAction mappers.
 * Pack 02B: `candidate` allowed for SELECT_ONE Participant/Member votes.
 * Visitor casts are skipped in handlers (no Participant Action for Visitors).
 */
const VALID_INITIATIVE_DECISION_VOTE_CHOICES = new Set<string>([
  "support",
  "do_not_support",
  "abstain",
  "candidate",
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
): InitiativeDecisionVoteChoiceExtended {
  if (typeof value !== "string" || !VALID_INITIATIVE_DECISION_VOTE_CHOICES.has(value)) {
    throw new ParticipantActionValidationError(
      `${eventName} payload field "${field}" must be a valid Initiative Decision Vote choice.`,
    );
  }

  return value as InitiativeDecisionVoteChoiceExtended;
}

export function requireValidVoteVersionField(value: unknown, field: string, eventName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ParticipantActionValidationError(
      `${eventName} payload field "${field}" must be a positive integer.`,
    );
  }

  return value;
}
