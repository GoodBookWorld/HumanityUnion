import type { CivicNominationVoteChoice } from "@hu/types";

const VALID_CHOICES = new Set<CivicNominationVoteChoice>(["support", "do_not_support", "abstain"]);

const FORBIDDEN_MANUAL_FIELDS = ["transparencyCohort", "participantId", "profileId", "voteId"];

export function validateCastCivicNominationVoteInput(input: unknown): {
  choice: CivicNominationVoteChoice;
} {
  if (!input || typeof input !== "object") {
    throw new Error("Vote payload is required.");
  }

  const record = input as Record<string, unknown>;

  for (const field of FORBIDDEN_MANUAL_FIELDS) {
    if (field in record) {
      throw new Error(`Vote field "${field}" cannot be supplied manually.`);
    }
  }

  if (
    typeof record.choice !== "string" ||
    !VALID_CHOICES.has(record.choice as CivicNominationVoteChoice)
  ) {
    throw new Error('Vote choice must be "support", "do_not_support", or "abstain".');
  }

  return {
    choice: record.choice as CivicNominationVoteChoice,
  };
}

export function validateOpenCivicNominationVotingInput(input: unknown): { closesAt: string } {
  if (!input || typeof input !== "object") {
    throw new Error("Voting session payload is required.");
  }

  const record = input as { closesAt?: unknown };

  if (typeof record.closesAt !== "string" || record.closesAt.trim().length === 0) {
    throw new Error("closesAt is required to open civic nomination voting.");
  }

  return { closesAt: record.closesAt.trim() };
}
