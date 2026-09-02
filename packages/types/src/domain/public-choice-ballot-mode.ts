/**
 * Public Choice Architecture Pack 02A / Pack 04 — ballot mode on a PUBLIC_CHOICE Initiative.
 *
 * Pack 04 product: one canonical candidate-election experience.
 * New writes use SELECT_ONE_CANDIDATE. SUPPORT_OPPOSE remains readable for
 * legacy non-candidate Public Choice questions (TEMPORARY_READ_COMPATIBILITY).
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

/** Pack 04 — canonical candidate election (new PUBLIC_CHOICE writes). */
export const DEFAULT_PUBLIC_CHOICE_BALLOT_MODE: PublicChoiceBallotMode = "SELECT_ONE_CANDIDATE";

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

/**
 * Pack 04 — candidate-election product surface (Select/Recall roster).
 * Legacy SUPPORT_OPPOSE remains a non-candidate civic question path.
 */
export function isPublicChoiceCandidateElectionBallot(
  value: PublicChoiceBallotMode | string | null | undefined,
): boolean {
  return resolvePublicChoiceBallotMode(value) === "SELECT_ONE_CANDIDATE";
}

/**
 * Community voting disclaimer — never official/government/polling claims.
 *
 * @deprecated 08G — English DOMAIN skew fallback for PDF/API transport.
 * Prefer Web catalog `publicChoice.results.disclaimerBody` and API
 * locale maps for presentation.
 */
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

/**
 * Pack 04 — single election voting status for Overview / CD / Election / Manage.
 * Consumed by all Public Choice presentation surfaces.
 */
export type PublicChoiceElectionVotingStatus =
  | "NOT_STARTED"
  | "OPEN"
  | "CLOSED"
  | "EXPIRED";

export function resolvePublicChoiceElectionVotingStatus(input: {
  decisionStatus?: string | null;
  openedAt?: string | null;
  closesAt?: string | null;
  closedAt?: string | null;
  resultsExpiredAt?: string | null;
  resultsRetentionStatus?: string | null;
  nowIso?: string;
}): PublicChoiceElectionVotingStatus {
  if (
    input.resultsExpiredAt?.trim() ||
    input.resultsRetentionStatus === "results_expired"
  ) {
    return "EXPIRED";
  }

  const now = Date.parse(input.nowIso ?? new Date().toISOString());
  if (Number.isNaN(now)) {
    return "NOT_STARTED";
  }

  if (input.closedAt?.trim() || input.decisionStatus === "closed") {
    return "CLOSED";
  }

  if (input.decisionStatus === "cancelled") {
    return "CLOSED";
  }

  const openedAt = input.openedAt ? Date.parse(input.openedAt) : Number.NaN;
  const closesAt = input.closesAt ? Date.parse(input.closesAt) : Number.NaN;

  if (input.decisionStatus === "opened") {
    if (!Number.isNaN(openedAt) && now < openedAt) {
      return "NOT_STARTED";
    }
    if (!Number.isNaN(closesAt) && now > closesAt) {
      return "CLOSED";
    }
    return "OPEN";
  }

  return "NOT_STARTED";
}

export function publicChoiceElectionVotingStatusLabel(
  status: PublicChoiceElectionVotingStatus,
): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "OPEN":
      return "Open";
    case "CLOSED":
      return "Closed";
    case "EXPIRED":
      return "Expired";
    default:
      return "Not started";
  }
}
