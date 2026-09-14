/**
 * Pack 02G Task 07B — derive content reading language from preferences.
 * Pure helper (no React / auth) so surfaces and tests share one rule.
 */

import type { LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

/**
 * Authenticated: readingLanguages[0] only.
 * Empty / missing → platform default. Never interfaceLanguage.
 */
export function deriveAuthenticatedReadingLanguage(
  readingLanguages: readonly string[] | undefined,
): LanguageCode {
  const first = readingLanguages?.[0]?.trim();
  if (!first) {
    return DEFAULT_PLATFORM_LANGUAGE;
  }
  return first as LanguageCode;
}
