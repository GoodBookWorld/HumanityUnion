import type {
  ExperiencePreferences,
  ParticipantLanguageContext,
  TranslationDisplayPreference,
} from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE, isTranslationDisplayPreference } from "@hu/types";

import { findPreferencesByMemberId } from "../preferences/preferences.repository.js";
import { resolveLocaleWithEnglishFallback } from "./language-registry-runtime.js";

function resolveDisplayPreference(value: string | undefined): TranslationDisplayPreference {
  if (isTranslationDisplayPreference(value)) {
    return value;
  }
  return "none";
}

/**
 * Build language roles from experience preferences.
 * Disabled or unknown stored codes fall back to English — they are not treated as selectable.
 * Interface / reading / writing remain distinct fields.
 */
export async function buildParticipantLanguageContextFromExperience(
  experience: ExperiencePreferences | null | undefined,
): Promise<ParticipantLanguageContext> {
  const interfaceLanguage = await resolveLocaleWithEnglishFallback(
    experience?.interfaceLanguage ?? DEFAULT_PLATFORM_LANGUAGE,
  );
  const preferredReadingLanguage = await resolveLocaleWithEnglishFallback(
    experience?.readingLanguages?.[0] ?? interfaceLanguage,
  );
  const writingLanguage = await resolveLocaleWithEnglishFallback(
    experience?.writingLanguages?.[0] ?? interfaceLanguage,
  );

  return {
    interfaceLanguage,
    preferredReadingLanguage,
    writingLanguage,
    translationLanguage: null,
    translationDisplayPreference: resolveDisplayPreference(experience?.translationPreference),
  };
}

/**
 * Load language roles for a participant from the canonical Preferences repository
 * (same Mongo/memory path as Preferences Save / getMyPreferences).
 *
 * Pack 08I.7 — unauthenticated public callers default to `preferred` so a warm
 * `content_translations` row for the requested `?language=` is displayed.
 * Authenticated missing prefs remain English + `none` (explicit opt-in).
 */
export async function resolveParticipantLanguageContext(
  participantId: string | undefined,
): Promise<ParticipantLanguageContext> {
  if (!participantId) {
    const guest = await buildParticipantLanguageContextFromExperience(null);
    return {
      ...guest,
      translationDisplayPreference: "preferred",
    };
  }

  const preferences = await findPreferencesByMemberId(participantId);
  return buildParticipantLanguageContextFromExperience(preferences?.experiencePreferences);
}
