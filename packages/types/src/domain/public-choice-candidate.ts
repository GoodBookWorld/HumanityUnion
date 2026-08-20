/**
 * Public Choice Architecture Pack 02A — Initiative-owned Candidate.
 * Not a civic root. Ancestry: Candidate → Initiative (PUBLIC_CHOICE only).
 */

export type PublicChoiceCandidateId = string;

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
   */
  readonly submittedByParticipantId?: string;
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
}

export function toPublicChoiceCandidatePublicProjection(
  candidate: PublicChoiceCandidate,
): PublicChoiceCandidatePublicProjection {
  return {
    candidateId: candidate.candidateId,
    initiativeId: candidate.initiativeId,
    name: candidate.name,
    photoUrl: candidate.photoUrl,
    campaignPageUrl: candidate.campaignPageUrl,
    sortOrder: candidate.sortOrder,
  };
}
