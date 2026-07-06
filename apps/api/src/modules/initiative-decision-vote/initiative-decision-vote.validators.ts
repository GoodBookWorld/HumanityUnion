import type { InitiativeDecisionVoteChoice } from "@hu/types";

const VALID_CHOICES = new Set<InitiativeDecisionVoteChoice>([
  "support",
  "do_not_support",
  "abstain",
]);

export function validateCastInitiativeDecisionVoteInput(input: unknown): {
  choice: InitiativeDecisionVoteChoice;
} {
  if (!input || typeof input !== "object") {
    throw new Error("Vote payload is required.");
  }

  const record = input as { choice?: unknown };

  if (
    typeof record.choice !== "string" ||
    !VALID_CHOICES.has(record.choice as InitiativeDecisionVoteChoice)
  ) {
    throw new Error('Vote choice must be "support", "do_not_support", or "abstain".');
  }

  return {
    choice: record.choice as InitiativeDecisionVoteChoice,
  };
}
