/**
 * Public Choice Results & Retention Pack 02C — temporary results retention.
 * Not a permanent archive. Future paid archive may replace this policy.
 */

export const PUBLIC_CHOICE_RESULTS_RETENTION_HOURS = 72;

export const PUBLIC_CHOICE_CANDIDATE_PRESENTATION_SLOT_MINIMUM = 6;

export type PublicChoiceResultsRetentionStatus =
  | "voting_open"
  | "results_available"
  | "results_expired"
  | "no_results";

/**
 * Canonical voting close instant for retention:
 * - Prefer closedAt when the decision was explicitly closed
 * - Else use closesAt once that scheduled close time has passed
 */
export function resolvePublicChoiceVotingCloseAt(input: {
  status: string;
  closedAt?: string | null;
  closesAt: string;
  nowIso?: string;
}): string | null {
  if (input.closedAt?.trim()) {
    return input.closedAt;
  }

  const now = Date.parse(input.nowIso ?? new Date().toISOString());
  const closesAt = Date.parse(input.closesAt);
  if (Number.isNaN(now) || Number.isNaN(closesAt)) {
    return null;
  }

  if (closesAt <= now || input.status === "closed") {
    return input.closesAt;
  }

  return null;
}

export function computePublicChoiceResultsExpireAt(
  votingCloseAtIso: string,
  retentionHours: number = PUBLIC_CHOICE_RESULTS_RETENTION_HOURS,
): string {
  const closeMs = Date.parse(votingCloseAtIso);
  if (Number.isNaN(closeMs)) {
    throw new Error("Invalid voting close timestamp.");
  }

  return new Date(closeMs + retentionHours * 60 * 60 * 1000).toISOString();
}

export function isPublicChoiceResultsWithinRetentionWindow(input: {
  votingCloseAt: string;
  nowIso?: string;
  retentionHours?: number;
}): boolean {
  const now = Date.parse(input.nowIso ?? new Date().toISOString());
  const closeMs = Date.parse(input.votingCloseAt);
  if (Number.isNaN(now) || Number.isNaN(closeMs)) {
    return false;
  }

  if (now < closeMs) {
    return false;
  }

  const expireMs = Date.parse(
    computePublicChoiceResultsExpireAt(
      input.votingCloseAt,
      input.retentionHours ?? PUBLIC_CHOICE_RESULTS_RETENTION_HOURS,
    ),
  );
  return now < expireMs;
}

export function isPublicChoiceResultsRetentionExpired(input: {
  votingCloseAt: string;
  nowIso?: string;
  retentionHours?: number;
}): boolean {
  const now = Date.parse(input.nowIso ?? new Date().toISOString());
  const closeMs = Date.parse(input.votingCloseAt);
  if (Number.isNaN(now) || Number.isNaN(closeMs)) {
    return false;
  }

  if (now < closeMs) {
    return false;
  }

  const expireMs = Date.parse(
    computePublicChoiceResultsExpireAt(
      input.votingCloseAt,
      input.retentionHours ?? PUBLIC_CHOICE_RESULTS_RETENTION_HOURS,
    ),
  );
  return now >= expireMs;
}

export function resolvePublicChoiceResultsRetentionStatus(input: {
  lifecycleProfile?: string | null;
  votingOpen: boolean;
  votingCloseAt: string | null;
  resultsExpiredAt?: string | null;
  hasElectionData: boolean;
  nowIso?: string;
}): PublicChoiceResultsRetentionStatus {
  if (input.resultsExpiredAt?.trim()) {
    return "results_expired";
  }

  if (input.votingOpen) {
    return "voting_open";
  }

  if (input.votingCloseAt) {
    if (
      isPublicChoiceResultsRetentionExpired({
        votingCloseAt: input.votingCloseAt,
        nowIso: input.nowIso,
      })
    ) {
      return "results_expired";
    }

    return "results_available";
  }

  return input.hasElectionData ? "results_available" : "no_results";
}

export function isPublicChoiceResultsDownloadAvailable(input: {
  votingOpen: boolean;
  votingCloseAt: string | null;
  resultsExpiredAt?: string | null;
  nowIso?: string;
}): boolean {
  if (input.votingOpen || input.resultsExpiredAt?.trim() || !input.votingCloseAt) {
    return false;
  }

  return isPublicChoiceResultsWithinRetentionWindow({
    votingCloseAt: input.votingCloseAt,
    nowIso: input.nowIso,
  });
}

/**
 * Presentation-only candidate slots. Never persisted.
 * placeholderCount = max(0, 6 - candidateCount); >6 shows all real rows, no placeholders.
 */
export function buildPublicChoiceCandidatePresentationSlotPlan(candidateCount: number): {
  realCount: number;
  placeholderCount: number;
  totalSlots: number;
} {
  const realCount = Math.max(0, Math.floor(candidateCount));
  const placeholderCount = Math.max(
    0,
    PUBLIC_CHOICE_CANDIDATE_PRESENTATION_SLOT_MINIMUM - realCount,
  );
  return {
    realCount,
    placeholderCount,
    totalSlots: realCount + placeholderCount,
  };
}
