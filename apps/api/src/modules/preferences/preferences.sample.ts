import type { MemberPreferences } from "@hu/types";

export const samplePreferences: MemberPreferences = {
  memberId: "member-bootstrap-001",
  experiencePreferences: {
    interfaceLanguage: "en",
    readingLanguages: ["en"],
    writingLanguages: ["en"],
    translationPreference: "none",
    timeZone: "America/Vancouver",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "24h",
  },
  participationPreferences: {
    interestedTopics: ["Local Community"],
    preferredInitiativeTypes: ["Proposals"],
    volunteerInterests: ["Community Support"],
    preferredRegions: ["British Columbia"],
    participationAvailability: "30 minutes per day",
  },
  communicationPreferences: {
    announcementPreference: "enabled",
    invitationPreference: "enabled",
    digestFrequency: "weekly",
    messageCategories: ["Announcements"],
  },
  accessibilityPreferences: {
    fontSize: "medium",
    highContrast: false,
    reducedMotion: false,
    screenReaderSupport: false,
  },
  workspacePreferences: {
    defaultStartPage: "profile",
    navigationStyle: "standard",
    expandedSections: ["Basic Information"],
    cardDensity: "comfortable",
  },
};
