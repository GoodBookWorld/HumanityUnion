import type { CivicNomination, CivicNominationInstitutionRole } from "@hu/types";
import {
  CIVIC_NOMINATION_VOTING_ELIGIBLE_ROLES,
  resolveCivicNominationVotingScope,
} from "@hu/types";
import type { InitiativeParticipationScopeMetadata } from "@hu/types";

export function assertInstitutionRoleSupportsVoting(
  institutionRole: CivicNominationInstitutionRole,
): void {
  if (!CIVIC_NOMINATION_VOTING_ELIGIBLE_ROLES.includes(institutionRole)) {
    throw new Error("This institution role is not eligible for civic nomination voting.");
  }
}

export function buildNominationScopeMetadata(
  nomination: CivicNomination,
): InitiativeParticipationScopeMetadata {
  const scope = resolveCivicNominationVotingScope(nomination.institutionRole);

  if (scope === "world") {
    return {
      countrySlug: "",
      regionSlug: "",
      communitySlug: "",
      isGlobal: true,
    };
  }

  return {
    countrySlug: nomination.countrySlug ?? "",
    regionSlug: nomination.regionSlug ?? "",
    communitySlug: nomination.communitySlug ?? "",
    isGlobal: false,
  };
}

export function assertPublishedNomination(nomination: CivicNomination | null): CivicNomination {
  if (!nomination) {
    throw new Error("Civic nomination not found.");
  }

  if (nomination.status !== "published") {
    throw new Error("Civic nomination voting is only available for published nominations.");
  }

  assertInstitutionRoleSupportsVoting(nomination.institutionRole);

  return nomination;
}
