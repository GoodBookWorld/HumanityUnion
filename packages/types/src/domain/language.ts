/**
 * Language Architecture Pack 01 — canonical language concepts.
 *
 * Original Language, Interface Language, Preferred Reading Language, and
 * Translation Language are distinct. They are not necessarily identical.
 */

/** Priority languages the architecture must support (not all content is translated yet). */
export type PriorityLanguageCode =
  | "en"
  | "uk"
  | "ru"
  | "fr"
  | "es"
  | "zh"
  | "hi"
  | "ar"
  | "he";

/**
 * BCP 47-ish language tag used across the platform.
 * Priority codes are canonical; other tags remain valid for migration compatibility.
 */
export type LanguageCode = PriorityLanguageCode | (string & {});

export const PRIORITY_LANGUAGE_CODES: readonly PriorityLanguageCode[] = [
  "en",
  "uk",
  "ru",
  "fr",
  "es",
  "zh",
  "hi",
  "ar",
  "he",
] as const;

export const DEFAULT_PLATFORM_LANGUAGE: PriorityLanguageCode = "en";

/** Languages that require right-to-left layout preparation. */
export const RTL_LANGUAGE_CODES: readonly PriorityLanguageCode[] = ["ar", "he"] as const;

/**
 * How aggressively the platform should present translations to a Participant.
 * Stored today as ExperiencePreferences.translationPreference (string).
 */
export type TranslationDisplayPreference = "none" | "preferred" | "ask";

export const TRANSLATION_DISPLAY_PREFERENCES: readonly TranslationDisplayPreference[] = [
  "none",
  "preferred",
  "ask",
] as const;

/**
 * Distinct language roles for a session / reading context.
 * Do not collapse these into a single “locale” field.
 */
export interface ParticipantLanguageContext {
  /** Language of the UI chrome (menus, buttons, system labels). */
  readonly interfaceLanguage: LanguageCode;
  /** Preferred language for reading civic content when a translation exists. */
  readonly preferredReadingLanguage: LanguageCode;
  /** Language the Participant is currently writing in (drafts, comments). */
  readonly writingLanguage: LanguageCode;
  /**
   * Target language for an explicit translation action (e.g. Translate Draft).
   * May differ from preferred reading language for a one-off request.
   */
  readonly translationLanguage: LanguageCode | null;
  readonly translationDisplayPreference: TranslationDisplayPreference;
}

/**
 * Language metadata attached to an authored civic record.
 * Machine translation never replaces these fields.
 */
export interface OriginalContentLanguageMetadata {
  readonly originalLanguage: LanguageCode;
  /** When unknown (legacy records), treat as unspecified and fall back safely. */
  readonly originalLanguageKnown: boolean;
}

export function isPriorityLanguageCode(value: unknown): value is PriorityLanguageCode {
  return (
    typeof value === "string" &&
    (PRIORITY_LANGUAGE_CODES as readonly string[]).includes(value)
  );
}

export function isRtlLanguageCode(value: LanguageCode | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const base = value.toLowerCase().split("-")[0] ?? value;
  return (RTL_LANGUAGE_CODES as readonly string[]).includes(base);
}

export function normalizeLanguageCode(
  value: unknown,
  fallback: LanguageCode = DEFAULT_PLATFORM_LANGUAGE,
): LanguageCode {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return fallback;
  }
  // Accept en-US → en when the base is a priority language.
  const base = trimmed.split("-")[0] ?? trimmed;
  if (isPriorityLanguageCode(base)) {
    return base;
  }
  return trimmed;
}

export function isTranslationDisplayPreference(
  value: unknown,
): value is TranslationDisplayPreference {
  return (
    typeof value === "string" &&
    (TRANSLATION_DISPLAY_PREFERENCES as readonly string[]).includes(value)
  );
}
