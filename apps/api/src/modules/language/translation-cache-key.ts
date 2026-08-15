import type { LanguageCode } from "@hu/types";

/**
 * Version-aware cache key — identical sourceVersion + targetLanguage must not
 * re-call the provider unnecessarily (Pack 01 Part 21).
 */
export function buildTranslationCacheKey(input: {
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly targetLanguage: LanguageCode;
}): string {
  return [
    input.sourceRecordId.trim(),
    input.sourceVersion.trim(),
    input.targetLanguage.trim().toLowerCase(),
  ].join("::");
}
