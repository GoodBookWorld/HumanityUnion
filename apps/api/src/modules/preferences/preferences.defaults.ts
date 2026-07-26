import type { MemberPreferences } from "@hu/types";

export function buildDefaultMemberPreferences(input: {
  memberId: string;
  userId?: string;
}): MemberPreferences {
  const timestamp = new Date().toISOString();

  return {
    memberId: input.memberId,
    userId: input.userId,
    updatedAt: timestamp,
    experiencePreferences: {
      interfaceLanguage: "en",
      readingLanguages: ["en"],
      writingLanguages: ["en"],
      translationPreference: "none",
      timeZone: "UTC",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      expertiseAreas: [],
      skills: [],
      experienceLevel: undefined,
    },
    participationPreferences: {
      interestedTopics: [],
      preferredInitiativeTypes: [],
      volunteerInterests: [],
      preferredCountryIds: [],
      preferredRegions: [],
      preferredCityCommunityIds: [],
      participationAvailability: "",
      preferredActivityAreas: [],
      preferredGeographicScopes: [],
      initiativeParticipationInterests: [],
      contributionWillingness: [],
    },
    communicationPreferences: {
      announcementPreference: "enabled",
      invitationPreference: "enabled",
      digestFrequency: "weekly",
      messageCategories: [],
      notificationFrequency: "daily_digest",
      emailNotificationsEnabled: true,
      interestMatchNotificationsEnabled: true,
      disabledNotificationCategories: [],
    },
    accessibilityPreferences: {
      fontSize: "medium",
      highContrast: false,
      reducedMotion: false,
      screenReaderSupport: false,
      simplifiedExplanations: false,
      contentDensity: "comfortable",
    },
    workspacePreferences: {
      defaultStartPage: "workspace",
      navigationStyle: "standard",
      expandedSections: [],
      cardDensity: "comfortable",
    },
    visibilityPreferences: {
      profileVisibility: "members_only",
      skillsVisibility: "members_only",
      interestsVisibility: "members_only",
      participationVisibility: "members_only",
    },
  };
}
