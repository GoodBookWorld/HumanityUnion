import type {
  CastInitiativeDecisionVotePayload,
  InitiativeDecisionVoteChoiceExtended,
} from "@hu/types";
import {
  INITIATIVE_DECISION_VOTE_CHOICES_EXTENDED,
  validateVotePayloadForBallotMode,
  type PublicChoiceBallotMode,
} from "@hu/types";

const VALID_EXTENDED = new Set<string>(INITIATIVE_DECISION_VOTE_CHOICES_EXTENDED);

export function validateCastInitiativeDecisionVoteInput(input: unknown): {
  choice: InitiativeDecisionVoteChoiceExtended;
  candidateId?: string;
} {
  if (!input || typeof input !== "object") {
    throw new Error("Vote payload is required.");
  }

  const record = input as { choice?: unknown; candidateId?: unknown };

  if (typeof record.choice !== "string" || !VALID_EXTENDED.has(record.choice)) {
    throw new Error(
      'Vote choice must be "support", "do_not_support", "abstain", or "candidate".',
    );
  }

  const candidateId =
    typeof record.candidateId === "string" && record.candidateId.trim()
      ? record.candidateId.trim()
      : undefined;

  return {
    choice: record.choice as InitiativeDecisionVoteChoiceExtended,
    candidateId,
  };
}

export function assertVotePayloadMatchesBallotMode(
  ballotMode: PublicChoiceBallotMode,
  payload: CastInitiativeDecisionVotePayload,
): void {
  const result = validateVotePayloadForBallotMode(ballotMode, payload);
  if (!result.ok) {
    throw new Error(result.reason);
  }
}
