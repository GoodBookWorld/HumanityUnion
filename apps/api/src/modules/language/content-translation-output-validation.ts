/**
 * Pack 02G Task 07C / 07E.1 / 08J — post-provider structured translation validation
 * before persistence.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import {
  CONTENT_TRANSLATION_CIVIC_TITLE_FIELDS,
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
} from "./content-translation-eligibility.js";
import {
  isNonTranslatableFieldKey,
  resolveAutomaticTranslationFieldKeys,
} from "./non-translatable-policy.js";
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

  const eligibleKeys = resolveAutomaticTranslationFieldKeys({
    sourceFields: input.sourceFields,
    compatibilityAllowlist:
      CONTENT_TRANSLATION_FIELD_ALLOWLIST[input.sourceKind] as readonly string[],
  }).filter((key) => {
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
 * Pack 02G Task 07E.1 — designated civic title/heading fields must differ
 * from source for cross-language machine translation. Additive to 07C.
 * No acronym/shape exemptions; field map is authoritative.
 */
export function assertCivicTitleFieldsTranslatedFromSource(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceLanguage: LanguageCode;
  readonly targetLanguage: LanguageCode;
  readonly sourceFields: Readonly<Record<string, string>>;
  readonly translatedFields: Readonly<Record<string, string>>;
}): void {
  if (input.sourceLanguage === input.targetLanguage) {
    return;
  }

  const titleKeys = CONTENT_TRANSLATION_CIVIC_TITLE_FIELDS[input.sourceKind] as readonly string[];
  for (const key of titleKeys) {
    const sourceValue = input.sourceFields[key];
    if (typeof sourceValue !== "string" || sourceValue.trim().length === 0) {
      continue;
    }
    const translatedValue =
      typeof input.translatedFields[key] === "string"
        ? input.translatedFields[key]!.trim()
        : "";
    if (translatedValue === sourceValue.trim()) {
      throw new TranslationProviderError(
        "malformed_response",
        `Translation provider left civic title/heading field "${key}" unchanged.`,
      );
    }
  }
}

/**
 * Keep only source projection keys that are AUTO_TRANSLATABLE.
 * Pack 08J — unknown semantic keys on the source bag are kept without a
 * central allowlist edit; NON_TRANSLATABLE keys and invented keys are dropped.
 */
export function filterTranslatedFieldsToSourceAllowlist(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceFields: Readonly<Record<string, string>>;
  readonly translatedFields: Readonly<Record<string, string>>;
}): Record<string, string> {
  const eligible = new Set(
    resolveAutomaticTranslationFieldKeys({
      sourceFields: input.sourceFields,
      compatibilityAllowlist:
        CONTENT_TRANSLATION_FIELD_ALLOWLIST[input.sourceKind] as readonly string[],
    }),
  );
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.translatedFields)) {
    if (typeof value !== "string") {
      continue;
    }
    if (isNonTranslatableFieldKey(key)) {
      continue;
    }
    if (!(key in input.sourceFields)) {
      continue;
    }
    if (!eligible.has(key)) {
      continue;
    }
    filtered[key] = value;
  }
  return filtered;
}
