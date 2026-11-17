import type { MemberId } from "./member.js";
import type { MemberProfileVisibility } from "./member-profile.js";

export type NotificationFrequency =
  "immediate" | "daily_digest" | "weekly_digest" | "platform_only";

/** Where future Notification Center email copies would be sent. */
export type NotificationEmailDestinationMode = "account" | "alternative";

export type ContributionWillingness =
  "analysis" | "proposals" | "implementation" | "evidence" | "translation" | "coordination";

/**
 * Experience preferences include the Language Architecture foundations:
 * - interfaceLanguage → Interface Language
 * - readingLanguages[0] → Preferred Reading Language (when set)
 * - writingLanguages[0] → writing language
 * - translationPreference → TranslationDisplayPreference ("none" | "preferred" | "ask")
 *
 * Values remain strings for migration compatibility; prefer LanguageCode /
 * TranslationDisplayPreference at call sites (see packages/types language.ts).
 */
export interface ExperiencePreferences {
  interfaceLanguage: string;
  readingLanguages: string[];
  writingLanguages: string[];
  translationPreference: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: string;
  expertiseAreas: string[];
  skills: string[];
  experienceLevel?: string;
}

export interface ParticipationPreferences {
  interestedTopics: string[];
  preferredInitiativeTypes: string[];
  volunteerInterests: string[];
  /** Canonical ISO country codes selected for civic relevance. */
  preferredCountryIds: string[];
  /** Canonical region identifiers, typically `{countryCode}::{regionCode}`. */
  preferredRegions: string[];
  /** Canonical city/community identifiers, typically `{countryCode}::{regionCode}::{communityCode}`. */
  preferredCityCommunityIds: string[];
  participationAvailability: string;
  preferredActivityAreas: string[];
  preferredGeographicScopes: string[];
  initiativeParticipationInterests: string[];
  contributionWillingness: ContributionWillingness[];
}

export interface CommunicationPreferences {
  announcementPreference: string;
  invitationPreference: string;
  digestFrequency: string;
  messageCategories: string[];
  notificationFrequency: NotificationFrequency;
  /**
   * Historical feature-email preference (default true).
   * Does not authorize universal Notification Center email copies.
   */
  emailNotificationsEnabled: boolean;
  /**
   * Explicit opt-in for future universal notification email copies.
   * Defaults to false; independent of emailNotificationsEnabled.
   * Does not activate delivery until a later projector ships.
   */
  notificationEmailCopiesOptIn: boolean;
  /**
   * HU-NOTIF-02B — destination for future notification copies.
   * `alternative` is valid only when notificationAlternativeEmail is verified.
   */
  notificationEmailDestinationMode: NotificationEmailDestinationMode;
  /** Verified alternative notification email only — never login/auth email. */
  notificationAlternativeEmail: string | null;
  notificationAlternativeEmailVerifiedAt: string | null;
  /** Pending address awaiting ownership proof; never used as delivery destination. */
  notificationAlternativeEmailPending: string | null;
  interestMatchNotificationsEnabled: boolean;
  disabledNotificationCategories: string[];
}

export interface AccessibilityPreferences {
  fontSize: string;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderSupport: boolean;
  simplifiedExplanations: boolean;
  contentDensity: "compact" | "comfortable" | "spacious";
}

export interface WorkspacePreferences {
  defaultStartPage: string;
  navigationStyle: string;
  expandedSections: string[];
  cardDensity: string;
}

export interface VisibilityPreferences {
  profileVisibility: MemberProfileVisibility;
  skillsVisibility: MemberProfileVisibility;
  interestsVisibility: MemberProfileVisibility;
  participationVisibility: MemberProfileVisibility;
}

export interface MemberPreferences {
  memberId: MemberId;
  userId?: string;
  experiencePreferences: ExperiencePreferences;
  participationPreferences: ParticipationPreferences;
  communicationPreferences: CommunicationPreferences;
  accessibilityPreferences: AccessibilityPreferences;
  workspacePreferences: WorkspacePreferences;
  visibilityPreferences: VisibilityPreferences;
  updatedAt?: string;
}
