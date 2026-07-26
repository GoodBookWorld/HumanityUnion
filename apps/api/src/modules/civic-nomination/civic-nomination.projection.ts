import type {
  CivicNomination,
  CivicSearchMetadata,
  PublicCivicNominationListItem,
  PublicCivicNominationProjection,
} from "@hu/types";

import { findMemberProfileByProfileId } from "../member-profile/member-profile.repository.js";

import { assertPublicCivicNominationProjectionIsSafe } from "./civic-nomination.validation.js";

export const CIVIC_NOMINATION_LEGAL_NOTICE =
  "This nomination process expresses civic support and public evaluation. It does not create legal appointment, employment, office, or institutional authority." as const;

export const CIVIC_NOMINATION_TRANSPARENCY_NOTE =
  "Verified and unverified votes will be shown separately for transparency when voting is implemented. Vote counts do not change vote weight." as const;

const INSTITUTION_ROLE_LABELS: Record<CivicNomination["institutionRole"], string> = {
  humanity_council: "Humanity Council",
  chamber_of_intellectual_analysis: "Chamber of Intellectual Analysis",
  expert_analysis_team: "Expert Analysis Team",
  state_collaboration_department: "State Collaboration Department",
};

async function resolveDisplayName(
  profileId: string | undefined,
  fallback: string,
): Promise<string> {
  if (!profileId) {
    return fallback;
  }

  const profile = await findMemberProfileByProfileId(profileId);

  if (!profile) {
    return fallback;
  }

  if (profile.profileVisibility === "private") {
    return "Platform participant";
  }

  return profile.publicName || profile.displayName || fallback;
}

export function publicUrlForCivicNomination(nominationId: string): string {
  return `/institutions/nominations/${encodeURIComponent(nominationId)}`;
}

export async function toPublicCivicNominationProjection(
  nomination: CivicNomination,
): Promise<PublicCivicNominationProjection | null> {
  if (nomination.status !== "published") {
    return null;
  }

  const projection: PublicCivicNominationProjection = {
    nominationId: nomination.nominationId,
    institutionRole: nomination.institutionRole,
    nominationType: nomination.nominationType,
    nomineeName: nomination.nomineeName,
    nomineeDisplayName: nomination.nomineeProfileId
      ? await resolveDisplayName(nomination.nomineeProfileId, nomination.nomineeName)
      : undefined,
    nominatedByDisplayName: await resolveDisplayName(
      nomination.nominatedByProfileId,
      "Platform participant",
    ),
    countrySlug: nomination.countrySlug,
    regionSlug: nomination.regionSlug,
    communitySlug: nomination.communitySlug,
    expertiseAreas: nomination.expertiseAreas,
    experienceSummary: nomination.experienceSummary,
    confirmedAchievements: nomination.confirmedAchievements,
    evidenceLinks: nomination.evidenceLinks,
    visionStatement: nomination.visionStatement,
    conflictOfInterest: {
      status: nomination.conflictOfInterest.status,
      summary:
        nomination.conflictOfInterest.status === "disclosed"
          ? nomination.conflictOfInterest.summary
          : undefined,
    },
    declarationStatus: {
      supportsUdhr: nomination.declarations.supportsUdhr,
      supportsHumanityUnionPrinciples: nomination.declarations.supportsHumanityUnionPrinciples,
      understandsNoAutomaticAppointment: nomination.declarations.understandsNoAutomaticAppointment,
      confirmsAccuracy: nomination.declarations.confirmsAccuracy,
    },
    status: nomination.status,
    publishedAt: nomination.publishedAt,
    updatedAt: nomination.updatedAt,
    nominationVersion: nomination.nominationVersion,
    legalNotice: CIVIC_NOMINATION_LEGAL_NOTICE,
    transparencyNote: CIVIC_NOMINATION_TRANSPARENCY_NOTE,
  };

  assertPublicCivicNominationProjectionIsSafe(projection as unknown as Record<string, unknown>);

  return projection;
}

export async function toPublicCivicNominationListItem(
  nomination: CivicNomination,
): Promise<PublicCivicNominationListItem | null> {
  if (nomination.status !== "published") {
    return null;
  }

  return {
    nominationId: nomination.nominationId,
    institutionRole: nomination.institutionRole,
    nominationType: nomination.nominationType,
    nomineeName: nomination.nomineeName,
    nomineeDisplayName: nomination.nomineeProfileId
      ? await resolveDisplayName(nomination.nomineeProfileId, nomination.nomineeName)
      : undefined,
    countrySlug: nomination.countrySlug,
    expertiseAreas: nomination.expertiseAreas,
    status: nomination.status,
    publishedAt: nomination.publishedAt,
    updatedAt: nomination.updatedAt,
    publicUrl: publicUrlForCivicNomination(nomination.nominationId),
  };
}

export function civicNominationToSearchMetadata(
  nomination: CivicNomination,
): CivicSearchMetadata | null {
  if (nomination.status !== "published") {
    return null;
  }

  const roleLabel = INSTITUTION_ROLE_LABELS[nomination.institutionRole];

  return {
    entityType: "civic_nomination",
    entityId: nomination.nominationId,
    title: `${nomination.nomineeName} — ${roleLabel}`,
    summary: nomination.visionStatement,
    country: nomination.countrySlug?.replace(/-/g, " ") ?? "",
    region: nomination.regionSlug?.replace(/-/g, " ") ?? "",
    community: nomination.communitySlug?.replace(/-/g, " ") ?? "",
    activityArea: roleLabel,
    status: nomination.status,
    publicUrl: publicUrlForCivicNomination(nomination.nominationId),
    updatedAt: nomination.updatedAt,
  };
}
