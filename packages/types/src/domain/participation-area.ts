import type { MemberId } from "./member.js";

export type ParticipationAreaId = string;

export type ParticipationAreaTransitionId = string;

/** Declared civic geography slugs for eligibility matching. */
export interface ParticipationAreaSlugTriple {
  countrySlug: string;
  regionSlug?: string;
  communitySlug?: string;
}

export type ParticipationAreaVerificationStatus = "verified" | "unverified";

export type ParticipationAreaRecordStatus = "active" | "pending_change" | "archived";

/** Participant's declared Participation Area (TASK-025 / TASK-027). */
export interface ParticipationArea {
  participationAreaId: ParticipationAreaId;
  participantId: MemberId;
  countrySlug: string;
  regionSlug?: string;
  communitySlug?: string;
  verificationStatus: ParticipationAreaVerificationStatus;
  status: ParticipationAreaRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export type ParticipationAreaTransitionStatus = "pending" | "active" | "cancelled" | "expired";

/** Delayed Participation Area change request. */
export interface ParticipationAreaTransition {
  transitionId: ParticipationAreaTransitionId;
  participantId: MemberId;
  fromArea: ParticipationAreaSlugTriple;
  toArea: ParticipationAreaSlugTriple;
  requestedAt: string;
  effectiveAt: string;
  status: ParticipationAreaTransitionStatus;
}

export function participationAreaSlugTriple(
  countrySlug: string,
  regionSlug?: string,
  communitySlug?: string,
): ParticipationAreaSlugTriple {
  return {
    countrySlug,
    regionSlug,
    communitySlug,
  };
}

export function participationAreaToSlugTriple(
  area: Pick<ParticipationArea, "countrySlug" | "regionSlug" | "communitySlug">,
): ParticipationAreaSlugTriple {
  return {
    countrySlug: area.countrySlug,
    regionSlug: area.regionSlug,
    communitySlug: area.communitySlug,
  };
}
