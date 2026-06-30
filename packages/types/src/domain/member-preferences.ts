import type { MemberId } from "./member.js";

export interface ExperiencePreferences {
  interfaceLanguage: string;
  readingLanguages: string[];
  writingLanguages: string[];
  translationPreference: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: string;
}

export interface ParticipationPreferences {
  interestedTopics: string[];
  preferredInitiativeTypes: string[];
  volunteerInterests: string[];
  preferredRegions: string[];
  participationAvailability: string;
}

export interface CommunicationPreferences {
  announcementPreference: string;
  invitationPreference: string;
  digestFrequency: string;
  messageCategories: string[];
}

export interface AccessibilityPreferences {
  fontSize: string;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderSupport: boolean;
}

export interface WorkspacePreferences {
  defaultStartPage: string;
  navigationStyle: string;
  expandedSections: string[];
  cardDensity: string;
}

export interface MemberPreferences {
  memberId: MemberId;
  experiencePreferences: ExperiencePreferences;
  participationPreferences: ParticipationPreferences;
  communicationPreferences: CommunicationPreferences;
  accessibilityPreferences: AccessibilityPreferences;
  workspacePreferences: WorkspacePreferences;
}
