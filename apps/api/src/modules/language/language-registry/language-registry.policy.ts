/**
 * Production Completion Pack 02B Task 04 — Language Registry Admin policy invariants.
 */

import type { LanguageRegistryRecord } from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import { LanguageRegistryConflictError, LanguageRegistryValidationError } from "./language-registry.errors.js";

export function isCanonicalEnglishLocale(locale: string): boolean {
  return normalizeLanguageRegistryLocaleKey(locale) === "en";
}

function findByCanonicalLocale(
  records: readonly LanguageRegistryRecord[],
  locale: string,
): LanguageRegistryRecord | undefined {
  const key = normalizeLanguageRegistryLocaleKey(locale);
  return records.find((row) => normalizeLanguageRegistryLocaleKey(row.locale) === key);
}

/**
 * Enforce Admin write safety invariants for a create or update candidate.
 * `allRecords` must be the post-change registry view (candidate included; previous version excluded).
 */
export function assertLanguageRegistryAdminPolicy(
  allRecords: readonly LanguageRegistryRecord[],
  candidate: LanguageRegistryRecord,
  previous: LanguageRegistryRecord | null,
): void {
  const enabled = candidate.enabled === true;

  if (candidate.searchEnabled && !enabled) {
    throw new LanguageRegistryValidationError("searchEnabled requires enabled=true.");
  }
  if (candidate.seoIndexingEnabled && !enabled) {
    throw new LanguageRegistryValidationError("seoIndexingEnabled requires enabled=true.");
  }
  if (candidate.contentTranslationEnabled && !enabled) {
    throw new LanguageRegistryValidationError("contentTranslationEnabled requires enabled=true.");
  }

  if (isCanonicalEnglishLocale(candidate.locale)) {
    if (!enabled) {
      throw new LanguageRegistryValidationError("English (en) cannot be disabled.");
    }
    if (!isCanonicalEnglishLocale(candidate.fallbackLocale)) {
      throw new LanguageRegistryValidationError(
        "English (en) fallbackLocale must remain English (en).",
      );
    }
  }

  const fallbackKey = normalizeLanguageRegistryLocaleKey(candidate.fallbackLocale);
  const selfKey = normalizeLanguageRegistryLocaleKey(candidate.locale);

  if (fallbackKey === selfKey) {
    if (!isCanonicalEnglishLocale(candidate.locale)) {
      throw new LanguageRegistryValidationError(
        "A language may only fall back to itself when it is canonical English (en).",
      );
    }
  } else {
    const fallbackRecord = findByCanonicalLocale(allRecords, candidate.fallbackLocale);
    if (!fallbackRecord) {
      throw new LanguageRegistryValidationError(
        `fallbackLocale "${candidate.fallbackLocale}" must reference an existing registry language.`,
      );
    }
    if (fallbackRecord.enabled !== true) {
      throw new LanguageRegistryValidationError(
        `fallbackLocale "${candidate.fallbackLocale}" must reference an enabled language.`,
      );
    }
  }

  const disabling =
    previous !== null && previous.enabled === true && candidate.enabled !== true;
  if (disabling) {
    if (isCanonicalEnglishLocale(candidate.locale)) {
      throw new LanguageRegistryValidationError("English (en) cannot be disabled.");
    }
    const dependents = allRecords.filter(
      (row) =>
        row.languageId !== candidate.languageId &&
        row.enabled === true &&
        normalizeLanguageRegistryLocaleKey(row.fallbackLocale) === selfKey,
    );
    if (dependents.length > 0) {
      const locales = dependents.map((row) => row.locale).join(", ");
      throw new LanguageRegistryConflictError(
        `Cannot disable "${candidate.locale}" while enabled languages depend on it as fallback: ${locales}.`,
      );
    }
  }
}

export function applyDisabledFeatureFlagClearance(
  candidate: LanguageRegistryRecord,
): LanguageRegistryRecord {
  if (candidate.enabled === true) {
    return candidate;
  }
  if (
    !candidate.contentTranslationEnabled &&
    !candidate.searchEnabled &&
    !candidate.seoIndexingEnabled
  ) {
    return candidate;
  }
  return {
    ...candidate,
    contentTranslationEnabled: false,
    searchEnabled: false,
    seoIndexingEnabled: false,
  };
}
