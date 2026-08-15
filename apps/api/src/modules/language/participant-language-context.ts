import type {
  ExperiencePreferences,
  ParticipantLanguageContext,
  TranslationDisplayPreference,
} from "@hu/types";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  isTranslationDisplayPreference,
  normalizeLanguageCode,
} from "@hu/types";

import { getPreferencesByMemberId } from "../preferences/preferences.store.js";

function resolveDisplayPreference(value: string | undefined): TranslationDisplayPreference {
  if (isTranslationDisplayPreference(value)) {
    return value;
  }
  return "none";
}

export function buildParticipantLanguageContextFromExperience(
  experience: ExperiencePreferences | null | undefined,
): ParticipantLanguageContext {
  const interfaceLanguage = normalizeLanguageCode(
    experience?.interfaceLanguage,
    DEFAULT_PLATFORM_LANGUAGE,
  );
  const preferredReadingLanguage = normalizeLanguageCode(
    experience?.readingLanguages?.[0],
    interfaceLanguage,
  );
  const writingLanguage = normalizeLanguageCode(
    experience?.writingLanguages?.[0],
    interfaceLanguage,
  );

  return {
    interfaceLanguage,
    preferredReadingLanguage,
    writingLanguage,
    translationLanguage: null,
    translationDisplayPreference: resolveDisplayPreference(experience?.translationPreference),
  };
}

export function resolveParticipantLanguageContext(
  participantId: string | undefined,
): ParticipantLanguageContext {
  if (!participantId) {
    return buildParticipantLanguageContextFromExperience(null);
  }

  const preferences = getPreferencesByMemberId(participantId);
  return buildParticipantLanguageContextFromExperience(preferences?.experiencePreferences);
}
