import type { CreateDecisionCommandInput } from "./decision.types.js";
import { DecisionValidationError } from "./decision.errors.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
    throw new DecisionValidationError(`${fieldName} must be a valid identifier.`);
  }

  return value.trim();
}

export function validateCreateDecisionInput(
  input: Record<string, unknown>,
): CreateDecisionCommandInput {
  if (typeof input.proposalId !== "string") {
    throw new DecisionValidationError("proposalId is required.");
  }

  return {
    proposalId: parseUuid(input.proposalId, "proposalId"),
  };
}

export function assertNoTrustedCreateDecisionFields(input: Record<string, unknown>): void {
  for (const forbidden of [
    "decisionId",
    "creatorMemberId",
    "status",
    "visibility",
    "aggregateVersion",
    "createdAt",
    "updatedAt",
    "activityId",
    "title",
  ]) {
    if (forbidden in input) {
      throw new DecisionValidationError(`Client must not supply "${forbidden}".`);
    }
  }
}
