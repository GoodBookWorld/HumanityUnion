import type { Member, MemberPreferences, PublicParticipationProfile } from "@hu/types";

import type { PublicParticipationVisibility } from "./participation.visibility.js";

export function toPublicParticipationProfile(
  member: Member,
  preferences: MemberPreferences,
  visibility: PublicParticipationVisibility,
): PublicParticipationProfile {
  const projection: PublicParticipationProfile = {};

  if (visibility.displayName) {
    projection.displayName = member.profile.displayName;
  }

  if (visibility.languages) {
    projection.languages = member.profile.languages;
  }

  if (visibility.interestedTopics) {
    projection.interestedTopics = preferences.participationPreferences.interestedTopics;
  }

  if (visibility.volunteerInterests) {
    projection.volunteerInterests = preferences.participationPreferences.volunteerInterests;
  }

  if (visibility.preferredParticipationRegions) {
    projection.preferredParticipationRegions =
      preferences.participationPreferences.preferredRegions;
  }

  return projection;
}
