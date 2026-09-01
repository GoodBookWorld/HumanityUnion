/**
 * Pack 02G Task 07C — reject provider output that leaves all eligible prose unchanged
 * when sourceLanguage !== targetLanguage.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import { CONTENT_TRANSLATION_FIELD_ALLOWLIST } from "./content-translation-eligibility.js";
import { TranslationProviderError } from "./translation.config.js";

/**
 * After structured JSON parse, before persistence.
 * Individual fields may stay identical (URLs, proper nouns); rejecting only when
 * every eligible non-empty source field is byte-identical to the translation.
 */
export function assertTranslatedProseChangedFromSource(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceLanguage: LanguageCode;
  readonly targetLanguage: LanguageCode;
  readonly sourceFields: Readonly<Record<string, string>>;
  readonly translatedFields: Readonly<Record<string, string>>;
}): void {
  if (input.sourceLanguage === input.targetLanguage) {
    return;
  }

  const allowlist = CONTENT_TRANSLATION_FIELD_ALLOWLIST[input.sourceKind] as readonly string[];
  const eligibleKeys = allowlist.filter((key) => {
    const sourceValue = input.sourceFields[key];
    return typeof sourceValue === "string" && sourceValue.trim().length > 0;
  });

  if (eligibleKeys.length === 0) {
    return;
  }

  const anyChanged = eligibleKeys.some((key) => {
    const sourceValue = input.sourceFields[key]!.trim();
    const translatedValue =
      typeof input.translatedFields[key] === "string"
        ? input.translatedFields[key]!.trim()
        : "";
    return translatedValue !== sourceValue;
  });

  if (!anyChanged) {
    throw new TranslationProviderError(
      "malformed_response",
      "Translation provider returned unchanged source text for all eligible fields.",
    );
  }
}

/**
 * Keep only allowlisted keys that already exist on the source payload.
 * Prevents inventing fields; display merge already ignores unknown keys.
 */
export function filterTranslatedFieldsToSourceAllowlist(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceFields: Readonly<Record<string, string>>;
  readonly translatedFields: Readonly<Record<string, string>>;
}): Record<string, string> {
  const allowlist = new Set(
    CONTENT_TRANSLATION_FIELD_ALLOWLIST[input.sourceKind] as readonly string[],
  );
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.translatedFields)) {
    if (typeof value !== "string") {
      continue;
    }
    if (!allowlist.has(key)) {
      continue;
    }
    if (!(key in input.sourceFields)) {
      continue;
    }
    filtered[key] = value;
  }
  return filtered;
}
