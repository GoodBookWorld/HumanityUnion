import type { Initiative, MemberPreferences } from "@hu/types";
import { INITIATIVE_ACTIVITY_AREA_OTHER } from "@hu/types";

import { publicUrlForEntity } from "../capability02-integration/capability02-integration.service.js";
import {
  findPreferredGeographyMatchReason,
  hasPreferredGeographySelections,
} from "../preferences/preferences-geography-match.js";
import { listAllPreferencesRecords } from "../preferences/preferences.repository.js";
import { createNotification } from "./notification.service.js";
import { resolveRecipientIdentity } from "./notification.recipients.js";

function resolveInitiativeActivityArea(initiative: Initiative): string {
  const area = initiative.metadata.activityArea;

  if (area === INITIATIVE_ACTIVITY_AREA_OTHER && initiative.metadata.activityAreaOther) {
    return initiative.metadata.activityAreaOther;
  }

  return area;
}

function hasInterestSelections(preferences: MemberPreferences): boolean {
  const participation = preferences.participationPreferences;

  return (
    participation.preferredActivityAreas.length > 0 ||
    participation.interestedTopics.length > 0 ||
    participation.preferredGeographicScopes.length > 0 ||
    hasPreferredGeographySelections(preferences) ||
    participation.initiativeParticipationInterests.length > 0
  );
}

function findInterestMatchReason(
  preferences: MemberPreferences,
  initiative: Initiative,
): string | null {
  const participation = preferences.participationPreferences;
  const activityArea = resolveInitiativeActivityArea(initiative);
  const scope = initiative.metadata.participationScope ?? "community";

  if (
    participation.preferredActivityAreas.some(
      (area) => area.toLowerCase() === activityArea.toLowerCase(),
    )
  ) {
    return activityArea;
  }

  if (participation.preferredGeographicScopes.some((entry) => entry.toLowerCase() === scope)) {
    return `${scope} participation`;
  }

  const initiativeTopics = [
    activityArea,
    initiative.metadata.communityAssociation,
    initiative.metadata.communitySlug,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.toLowerCase());

  for (const topic of participation.interestedTopics) {
    if (initiativeTopics.some((candidate) => candidate.includes(topic.toLowerCase()))) {
      return topic;
    }
  }

  const geographyMatch = findPreferredGeographyMatchReason(preferences, initiative);

  if (geographyMatch) {
    return geographyMatch;
  }

  for (const region of participation.preferredRegions) {
    if (
      initiative.metadata.communitySlug?.toLowerCase().includes(region.toLowerCase()) ||
      initiative.metadata.communityAssociation?.toLowerCase().includes(region.toLowerCase())
    ) {
      return region;
    }
  }

  for (const interest of participation.initiativeParticipationInterests) {
    if (initiative.title.toLowerCase().includes(interest.toLowerCase())) {
      return interest;
    }
  }

  return null;
}

export async function notifyInterestedParticipantsOfPublishedInitiative(
  initiative: Initiative,
  stewardMemberId: string,
): Promise<void> {
  const preferencesRecords = await listAllPreferencesRecords();

  for (const preferences of preferencesRecords) {
    if (preferences.memberId === stewardMemberId) {
      continue;
    }

    if (!preferences.communicationPreferences.interestMatchNotificationsEnabled) {
      continue;
    }

    if (
      preferences.communicationPreferences.disabledNotificationCategories.includes(
        "initiative_interest_match",
      )
    ) {
      continue;
    }

    if (!hasInterestSelections(preferences)) {
      continue;
    }

    const matchReason = findInterestMatchReason(preferences, initiative);

    if (!matchReason) {
      continue;
    }

    const recipient = await resolveRecipientIdentity(preferences.memberId);

    if (!recipient) {
      continue;
    }

    await createNotification({
      recipientUserId: recipient.userId,
      recipientProfileId: recipient.profileId,
      eventType: "initiative_interest_match",
      title: "New initiative matches your interests",
      message: `A new initiative matches your selected interest in ${matchReason}. You received this because your saved preferences include this topic or scope.`,
      relatedEntityType: "initiative",
      relatedEntityId: initiative.initiativeId,
      relatedUrl: publicUrlForEntity("initiative", initiative.initiativeId),
      priority: "informational",
    });
  }
}
