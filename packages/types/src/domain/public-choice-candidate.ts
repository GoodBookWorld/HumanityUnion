/**
 * Public Choice Architecture Pack 02A — Initiative-owned Candidate.
 * Not a civic root. Ancestry: Candidate → Initiative (PUBLIC_CHOICE only).
 */

export type PublicChoiceCandidateId = string;

/** Fix 08A — hard cap per PUBLIC_CHOICE election (active candidates). */
export const PUBLIC_CHOICE_MAX_CANDIDATES = 20;

export interface PublicChoiceCandidate {
  readonly candidateId: PublicChoiceCandidateId;
  readonly initiativeId: string;
  readonly name: string;
  /** Platform media URL or approved cover-media image URL for the candidate photo. */
  readonly photoUrl?: string;
  /** Optional official campaign / election information page (http/https). */
  readonly campaignPageUrl?: string;
  readonly sortOrder: number;
  /**
   * Pack 02D — authenticated Participant who submitted this candidate.
   * Steward-created candidates also record the steward Participant id.
   * Legacy rows may omit this field (steward may still manage).
   */
  readonly submittedByParticipantId?: string;
  /**
   * Fix 08B — admin moderation soft-block. Missing/false = not blocked (legacy safe).
   * Does not delete the candidate or clear existing votes.
   */
  readonly administrativelyBlocked?: boolean;
  readonly administrativelyBlockedAt?: string;
  /** Admin member/participant id — internal only; not projected publicly. */
  readonly administrativelyBlockedByParticipantId?: string;
  /** Optional admin-facing reason — internal only; not projected publicly. */
  readonly administrativeBlockReason?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicChoiceCandidatePublicProjection {
  readonly candidateId: PublicChoiceCandidateId;
  readonly initiativeId: string;
  readonly name: string;
  readonly photoUrl?: string;
  readonly campaignPageUrl?: string;
  readonly sortOrder: number;
  /**
   * Fix 08A — set only when the list request has an authenticated viewer.
   * Never exposes submittedByParticipantId. True for steward (all candidates,
   * including legacy without submitter) or the submitting Participant.
   * Fix 08B — always false while administratively blocked (Edit/Delete locked).
   */
  readonly viewerCanManage?: boolean;
  /**
   * Fix 08B — safe public moderation flag. True only when admin-blocked.
   * Never exposes admin identity, reason, or internal timestamps.
   */
  readonly isBlocked?: boolean;
}

/** Fix 08B — legacy rows without the field resolve as not blocked. */
export function isPublicChoiceCandidateAdministrativelyBlocked(
  candidate: Pick<PublicChoiceCandidate, "administrativelyBlocked">,
): boolean {
  return candidate.administrativelyBlocked === true;
}

/**
 * Fix 08B / 08C — whether a new Select may target this candidate.
 * Requires candidate not admin-blocked AND (when provided) parent election interactive.
 * Parent election interactivity includes Decision open window + Initiative not admin-blocked.
 */
export function isPublicChoiceCandidateAvailableForNewSelect(
  candidate: Pick<PublicChoiceCandidate, "administrativelyBlocked">,
  options?: {
    parentElectionAcceptsVotes?: boolean;
    parentElectionAdministrativelyBlocked?: boolean;
  },
): boolean {
  if (isPublicChoiceCandidateAdministrativelyBlocked(candidate)) {
    return false;
  }
  if (options?.parentElectionAdministrativelyBlocked === true) {
    return false;
  }
  if (options?.parentElectionAcceptsVotes === false) {
    return false;
  }
  return true;
}

/**
 * Fix 08C — election-wide freeze: no Select/Recall/candidate mutation while Initiative blocked.
 */
export function isPublicChoiceElectionAdministrativelyFrozen(
  initiative: Pick<{ administrativelyBlocked?: boolean }, "administrativelyBlocked">,
): boolean {
  return initiative.administrativelyBlocked === true;
}

export function toPublicChoiceCandidatePublicProjection(
  candidate: PublicChoiceCandidate,
  options?: { viewerCanManage?: boolean },
): PublicChoiceCandidatePublicProjection {
  const isBlocked = isPublicChoiceCandidateAdministrativelyBlocked(candidate);
  return {
    candidateId: candidate.candidateId,
    initiativeId: candidate.initiativeId,
    name: candidate.name,
    photoUrl: candidate.photoUrl,
    campaignPageUrl: candidate.campaignPageUrl,
    sortOrder: candidate.sortOrder,
    ...(isBlocked ? { isBlocked: true } : {}),
    ...(options?.viewerCanManage && !isBlocked ? { viewerCanManage: true } : {}),
  };
}
