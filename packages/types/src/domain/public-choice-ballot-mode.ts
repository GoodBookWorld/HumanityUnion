/**
 * Public Choice Architecture Pack 02A — ballot mode on a PUBLIC_CHOICE Initiative.
 */

export type PublicChoiceBallotMode = "SUPPORT_OPPOSE" | "SELECT_ONE_CANDIDATE";

/**
 * Voter participation / presentation category for Public Choice results.
 * Mutually exclusive: a Member vote counts only as Member, never also Participant.
 * Not a ballot choice — ballot choices remain candidateId | abstain (or ternary).
 */
export type PublicChoiceVoterCategory = "visitor" | "participant" | "member";

export const PUBLIC_CHOICE_VOTER_CATEGORIES = ["visitor", "participant", "member"] as const;

export const PUBLIC_CHOICE_BALLOT_MODES = ["SUPPORT_OPPOSE", "SELECT_ONE_CANDIDATE"] as const;

export const DEFAULT_PUBLIC_CHOICE_BALLOT_MODE: PublicChoiceBallotMode = "SUPPORT_OPPOSE";

export function isPublicChoiceBallotMode(value: unknown): value is PublicChoiceBallotMode {
  return value === "SUPPORT_OPPOSE" || value === "SELECT_ONE_CANDIDATE";
}

export function isPublicChoiceVoterCategory(value: unknown): value is PublicChoiceVoterCategory {
  return value === "visitor" || value === "participant" || value === "member";
}

export function resolvePublicChoiceBallotMode(
  value: PublicChoiceBallotMode | string | null | undefined,
): PublicChoiceBallotMode {
  if (isPublicChoiceBallotMode(value)) {
    return value;
  }

  return DEFAULT_PUBLIC_CHOICE_BALLOT_MODE;
}

/** Community voting disclaimer — never official/government/polling claims. */
export const PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER =
  "These are Humanity Union community voting results. They are not official election results, statistically representative polling, or government-certified results.";

export interface PublicChoiceVoterCategoryBreakdown {
  visitors: number;
  participants: number;
  members: number;
  /** Derived: visitors + participants + members === totalEffectiveVoters. */
  totalEffectiveVoters: number;
  visitorPercentage: number;
  participantPercentage: number;
  memberPercentage: number;
}

export function createEmptyPublicChoiceVoterCategoryBreakdown(): PublicChoiceVoterCategoryBreakdown {
  return {
    visitors: 0,
    participants: 0,
    members: 0,
    totalEffectiveVoters: 0,
    visitorPercentage: 0,
    participantPercentage: 0,
    memberPercentage: 0,
  };
}

export function percentageOfTotal(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}
