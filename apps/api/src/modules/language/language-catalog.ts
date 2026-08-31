/**
 * Legacy priority catalog — seed / migration compatibility only (Pack 02B Task 03).
 *
 * Runtime selectable languages come from Language Registry via
 * `listEnabledSelectableLanguages` / `language-registry-runtime.ts`.
 * Do not wire new user-facing pickers or validators to this catalog.
 */

import {
  DEFAULT_PLATFORM_LANGUAGE,
  PRIORITY_LANGUAGE_CODES,
  type LanguageCode,
  type PriorityLanguageCode,
} from "@hu/types";

export interface PriorityLanguageDescriptor {
  readonly code: PriorityLanguageCode;
  readonly englishName: string;
  readonly nativeName: string;
  readonly rtl: boolean;
}

/**
 * Historical hardcoded catalog retained for reference / bootstrap docs.
 * Not used by migrated runtime consumers after Pack 02B Task 03.
 */
export const PRIORITY_LANGUAGE_CATALOG: readonly PriorityLanguageDescriptor[] = [
  { code: "en", englishName: "English", nativeName: "English", rtl: false },
  { code: "uk", englishName: "Ukrainian", nativeName: "Українська", rtl: false },
  { code: "ru", englishName: "Russian", nativeName: "Русский", rtl: false },
  { code: "fr", englishName: "French", nativeName: "Français", rtl: false },
  { code: "es", englishName: "Spanish", nativeName: "Español", rtl: false },
  { code: "zh", englishName: "Chinese", nativeName: "中文", rtl: false },
  { code: "hi", englishName: "Hindi", nativeName: "हिन्दी", rtl: false },
  { code: "ar", englishName: "Arabic", nativeName: "العربية", rtl: true },
  { code: "he", englishName: "Hebrew", nativeName: "עברית", rtl: true },
];

export function listPriorityLanguageCodes(): readonly PriorityLanguageCode[] {
  return PRIORITY_LANGUAGE_CODES;
}

export function resolveSafeDefaultLanguage(
  explicit?: LanguageCode | null,
): LanguageCode {
  return explicit?.trim() ? explicit : DEFAULT_PLATFORM_LANGUAGE;
}
