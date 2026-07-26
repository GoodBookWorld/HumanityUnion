import type {
  AccessibilityPreferences,
  CommunicationPreferences,
  ContributionWillingness,
  ExperiencePreferences,
  MemberPreferences,
  NotificationFrequency,
  ParticipationPreferences,
  VisibilityPreferences,
  WorkspacePreferences,
} from "@hu/types";

import { sanitizeParticipationGeography } from "@hu/geography";

import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "@hu/types/initiative-activity-areas";

import { PreferencesValidationError } from "./preferences.errors.js";

const CONTRIBUTION_OPTIONS = new Set<ContributionWillingness>([
  "analysis",
  "proposals",
  "implementation",
  "evidence",
  "translation",
  "coordination",
]);

const NOTIFICATION_FREQUENCIES = new Set<NotificationFrequency>([
  "immediate",
  "daily_digest",
  "weekly_digest",
  "platform_only",
]);

const VISIBILITY_OPTIONS = new Set(["public", "members_only", "private"]);

function normalizeStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new PreferencesValidationError(`${fieldName} must be an array.`);
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new PreferencesValidationError("Expected a string value.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new PreferencesValidationError(`${fieldName} must be a boolean.`);
  }

  return value;
}

export interface ValidatedPreferencesPatch {
  experiencePreferences?: Partial<ExperiencePreferences>;
  participationPreferences?: Partial<ParticipationPreferences>;
  communicationPreferences?: Partial<CommunicationPreferences>;
  accessibilityPreferences?: Partial<AccessibilityPreferences>;
  workspacePreferences?: Partial<WorkspacePreferences>;
  visibilityPreferences?: Partial<VisibilityPreferences>;
}

export function validatePreferencesPatch(body: unknown): ValidatedPreferencesPatch {
  if (!body || typeof body !== "object") {
    throw new PreferencesValidationError("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const patch: ValidatedPreferencesPatch = {};

  if ("experiencePreferences" in record) {
    const source = record.experiencePreferences;

    if (!source || typeof source !== "object") {
      throw new PreferencesValidationError("experiencePreferences must be an object.");
    }

    const experience = source as Record<string, unknown>;
    patch.experiencePreferences = {};

    if ("interfaceLanguage" in experience) {
      patch.experiencePreferences.interfaceLanguage =
        normalizeOptionalString(experience.interfaceLanguage) ?? "en";
    }

    if ("readingLanguages" in experience) {
      patch.experiencePreferences.readingLanguages = normalizeStringArray(
        experience.readingLanguages,
        "readingLanguages",
      );
    }

    if ("writingLanguages" in experience) {
      patch.experiencePreferences.writingLanguages = normalizeStringArray(
        experience.writingLanguages,
        "writingLanguages",
      );
    }

    if ("translationPreference" in experience) {
      patch.experiencePreferences.translationPreference =
        normalizeOptionalString(experience.translationPreference) ?? "none";
    }

    if ("timeZone" in experience) {
      patch.experiencePreferences.timeZone = normalizeOptionalString(experience.timeZone) ?? "UTC";
    }

    if ("dateFormat" in experience) {
      patch.experiencePreferences.dateFormat =
        normalizeOptionalString(experience.dateFormat) ?? "YYYY-MM-DD";
    }

    if ("timeFormat" in experience) {
      patch.experiencePreferences.timeFormat =
        normalizeOptionalString(experience.timeFormat) ?? "24h";
    }

    if ("expertiseAreas" in experience) {
      patch.experiencePreferences.expertiseAreas = normalizeStringArray(
        experience.expertiseAreas,
        "expertiseAreas",
      );
    }

    if ("skills" in experience) {
      patch.experiencePreferences.skills = normalizeStringArray(experience.skills, "skills");
    }

    if ("experienceLevel" in experience) {
      patch.experiencePreferences.experienceLevel = normalizeOptionalString(
        experience.experienceLevel,
      );
    }
  }

  if ("participationPreferences" in record) {
    const source = record.participationPreferences;

    if (!source || typeof source !== "object") {
      throw new PreferencesValidationError("participationPreferences must be an object.");
    }

    const participation = source as Record<string, unknown>;
    patch.participationPreferences = {};

    if ("interestedTopics" in participation) {
      patch.participationPreferences.interestedTopics = normalizeStringArray(
        participation.interestedTopics,
        "interestedTopics",
      );
    }

    if ("preferredInitiativeTypes" in participation) {
      patch.participationPreferences.preferredInitiativeTypes = normalizeStringArray(
        participation.preferredInitiativeTypes,
        "preferredInitiativeTypes",
      );
    }

    if ("volunteerInterests" in participation) {
      patch.participationPreferences.volunteerInterests = normalizeStringArray(
        participation.volunteerInterests,
        "volunteerInterests",
      );
    }

    if ("preferredRegions" in participation) {
      patch.participationPreferences.preferredRegions = normalizeStringArray(
        participation.preferredRegions,
        "preferredRegions",
      );
    }

    if ("preferredCountryIds" in participation) {
      patch.participationPreferences.preferredCountryIds = normalizeStringArray(
        participation.preferredCountryIds,
        "preferredCountryIds",
      );
    }

    if ("preferredCityCommunityIds" in participation) {
      patch.participationPreferences.preferredCityCommunityIds = normalizeStringArray(
        participation.preferredCityCommunityIds,
        "preferredCityCommunityIds",
      );
    }

    if ("participationAvailability" in participation) {
      patch.participationPreferences.participationAvailability =
        normalizeOptionalString(participation.participationAvailability) ?? "";
    }

    if ("preferredActivityAreas" in participation) {
      const areas = normalizeStringArray(
        participation.preferredActivityAreas,
        "preferredActivityAreas",
      );

      for (const area of areas) {
        if (
          !INITIATIVE_ACTIVITY_AREA_OPTIONS.includes(
            area as (typeof INITIATIVE_ACTIVITY_AREA_OPTIONS)[number],
          )
        ) {
          throw new PreferencesValidationError(`Unknown activity area: ${area}`);
        }
      }

      patch.participationPreferences.preferredActivityAreas = areas;
    }

    if ("preferredGeographicScopes" in participation) {
      patch.participationPreferences.preferredGeographicScopes = normalizeStringArray(
        participation.preferredGeographicScopes,
        "preferredGeographicScopes",
      );
    }

    if ("initiativeParticipationInterests" in participation) {
      patch.participationPreferences.initiativeParticipationInterests = normalizeStringArray(
        participation.initiativeParticipationInterests,
        "initiativeParticipationInterests",
      );
    }

    if ("contributionWillingness" in participation) {
      const values = normalizeStringArray(
        participation.contributionWillingness,
        "contributionWillingness",
      );

      for (const value of values) {
        if (!CONTRIBUTION_OPTIONS.has(value as ContributionWillingness)) {
          throw new PreferencesValidationError(`Unknown contribution willingness: ${value}`);
        }
      }

      patch.participationPreferences.contributionWillingness = values as ContributionWillingness[];
    }
  }

  if ("communicationPreferences" in record) {
    const source = record.communicationPreferences;

    if (!source || typeof source !== "object") {
      throw new PreferencesValidationError("communicationPreferences must be an object.");
    }

    const communication = source as Record<string, unknown>;
    patch.communicationPreferences = {};

    if ("announcementPreference" in communication) {
      patch.communicationPreferences.announcementPreference =
        normalizeOptionalString(communication.announcementPreference) ?? "enabled";
    }

    if ("invitationPreference" in communication) {
      patch.communicationPreferences.invitationPreference =
        normalizeOptionalString(communication.invitationPreference) ?? "enabled";
    }

    if ("digestFrequency" in communication) {
      patch.communicationPreferences.digestFrequency =
        normalizeOptionalString(communication.digestFrequency) ?? "weekly";
    }

    if ("messageCategories" in communication) {
      patch.communicationPreferences.messageCategories = normalizeStringArray(
        communication.messageCategories,
        "messageCategories",
      );
    }

    if ("notificationFrequency" in communication) {
      const frequency = normalizeOptionalString(communication.notificationFrequency);

      if (!frequency || !NOTIFICATION_FREQUENCIES.has(frequency as NotificationFrequency)) {
        throw new PreferencesValidationError("notificationFrequency is invalid.");
      }

      patch.communicationPreferences.notificationFrequency = frequency as NotificationFrequency;
    }

    if ("emailNotificationsEnabled" in communication) {
      patch.communicationPreferences.emailNotificationsEnabled = normalizeBoolean(
        communication.emailNotificationsEnabled,
        "emailNotificationsEnabled",
      );
    }

    if ("interestMatchNotificationsEnabled" in communication) {
      patch.communicationPreferences.interestMatchNotificationsEnabled = normalizeBoolean(
        communication.interestMatchNotificationsEnabled,
        "interestMatchNotificationsEnabled",
      );
    }

    if ("disabledNotificationCategories" in communication) {
      patch.communicationPreferences.disabledNotificationCategories = normalizeStringArray(
        communication.disabledNotificationCategories,
        "disabledNotificationCategories",
      );
    }
  }

  if ("accessibilityPreferences" in record) {
    const source = record.accessibilityPreferences;

    if (!source || typeof source !== "object") {
      throw new PreferencesValidationError("accessibilityPreferences must be an object.");
    }

    const accessibility = source as Record<string, unknown>;
    patch.accessibilityPreferences = {};

    if ("fontSize" in accessibility) {
      patch.accessibilityPreferences.fontSize =
        normalizeOptionalString(accessibility.fontSize) ?? "medium";
    }

    if ("highContrast" in accessibility) {
      patch.accessibilityPreferences.highContrast = normalizeBoolean(
        accessibility.highContrast,
        "highContrast",
      );
    }

    if ("reducedMotion" in accessibility) {
      patch.accessibilityPreferences.reducedMotion = normalizeBoolean(
        accessibility.reducedMotion,
        "reducedMotion",
      );
    }

    if ("screenReaderSupport" in accessibility) {
      patch.accessibilityPreferences.screenReaderSupport = normalizeBoolean(
        accessibility.screenReaderSupport,
        "screenReaderSupport",
      );
    }

    if ("simplifiedExplanations" in accessibility) {
      patch.accessibilityPreferences.simplifiedExplanations = normalizeBoolean(
        accessibility.simplifiedExplanations,
        "simplifiedExplanations",
      );
    }

    if ("contentDensity" in accessibility) {
      const density = normalizeOptionalString(accessibility.contentDensity);

      if (density !== "compact" && density !== "comfortable" && density !== "spacious") {
        throw new PreferencesValidationError("contentDensity is invalid.");
      }

      patch.accessibilityPreferences.contentDensity = density;
    }
  }

  if ("workspacePreferences" in record) {
    const source = record.workspacePreferences;

    if (!source || typeof source !== "object") {
      throw new PreferencesValidationError("workspacePreferences must be an object.");
    }

    const workspace = source as Record<string, unknown>;
    patch.workspacePreferences = {};

    if ("defaultStartPage" in workspace) {
      patch.workspacePreferences.defaultStartPage =
        normalizeOptionalString(workspace.defaultStartPage) ?? "workspace";
    }

    if ("navigationStyle" in workspace) {
      patch.workspacePreferences.navigationStyle =
        normalizeOptionalString(workspace.navigationStyle) ?? "standard";
    }

    if ("expandedSections" in workspace) {
      patch.workspacePreferences.expandedSections = normalizeStringArray(
        workspace.expandedSections,
        "expandedSections",
      );
    }

    if ("cardDensity" in workspace) {
      patch.workspacePreferences.cardDensity =
        normalizeOptionalString(workspace.cardDensity) ?? "comfortable";
    }
  }

  if ("visibilityPreferences" in record) {
    const source = record.visibilityPreferences;

    if (!source || typeof source !== "object") {
      throw new PreferencesValidationError("visibilityPreferences must be an object.");
    }

    const visibility = source as Record<string, unknown>;
    patch.visibilityPreferences = {};

    for (const field of [
      "profileVisibility",
      "skillsVisibility",
      "interestsVisibility",
      "participationVisibility",
    ] as const) {
      if (!(field in visibility)) {
        continue;
      }

      const value = visibility[field];

      if (typeof value !== "string" || !VISIBILITY_OPTIONS.has(value)) {
        throw new PreferencesValidationError(`${field} must be public, members_only, or private.`);
      }

      patch.visibilityPreferences[field] = value as VisibilityPreferences[typeof field];
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new PreferencesValidationError("No valid preference fields were provided.");
  }

  return patch;
}

export function mergePreferencesPatch(
  current: MemberPreferences,
  patch: ValidatedPreferencesPatch,
): MemberPreferences {
  const mergedParticipationPreferences: ParticipationPreferences = {
    ...current.participationPreferences,
    ...patch.participationPreferences,
  };

  const sanitizedParticipation = patch.participationPreferences
    ? sanitizeParticipationGeography(mergedParticipationPreferences).participationPreferences
    : current.participationPreferences;

  return {
    ...current,
    experiencePreferences: {
      ...current.experiencePreferences,
      ...patch.experiencePreferences,
    },
    participationPreferences: sanitizedParticipation,
    communicationPreferences: {
      ...current.communicationPreferences,
      ...patch.communicationPreferences,
    },
    accessibilityPreferences: {
      ...current.accessibilityPreferences,
      ...patch.accessibilityPreferences,
    },
    workspacePreferences: {
      ...current.workspacePreferences,
      ...patch.workspacePreferences,
    },
    visibilityPreferences: {
      ...current.visibilityPreferences,
      ...patch.visibilityPreferences,
    },
    updatedAt: new Date().toISOString(),
  };
}
