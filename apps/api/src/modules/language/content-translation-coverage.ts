/**
 * Step 06C.2A — derived CT coverage / completeness for discovery vs full bags.
 *
 * Coverage is derived from required source fields + translatedContent.
 * No persisted coverage column.
 */

import type { ContentTranslationSourceKind, TranslatedContentRecord } from "@hu/types";

import { CONTENT_TRANSLATION_FIELD_ALLOWLIST } from "./content-translation-eligibility.js";
import { resolveAutomaticTranslationFieldKeys } from "./non-translatable-policy.js";

function asTranslatedStringBag(
  translatedContent: TranslatedContentRecord["translatedContent"],
): Record<string, string> | null {
  if (!translatedContent || typeof translatedContent !== "object" || Array.isArray(translatedContent)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(translatedContent as Record<string, unknown>)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

/**
 * True when every eligible non-empty source field has a non-empty translated value.
 * Mirrors assertEligibleSourceFieldsFullyTranslated as a boolean predicate.
 */
export function contentTranslationCoversRequiredSourceFields(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceFields: Readonly<Record<string, string>>;
  readonly translatedContent: TranslatedContentRecord["translatedContent"];
}): boolean {
  const translated = asTranslatedStringBag(input.translatedContent);
  if (!translated) {
    return false;
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
    return false;
  }

  for (const key of eligibleKeys) {
    const translatedValue =
      typeof translated[key] === "string" ? translated[key]!.trim() : "";
    if (!translatedValue) {
      return false;
    }
  }
  return true;
}
