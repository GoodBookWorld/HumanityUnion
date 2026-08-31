/**
 * Production Completion Pack 02B Task 03 — canonical Language Registry runtime resolver.
 *
 * Single source of truth for selectable languages across translations catalog,
 * preference validation, and Translate Draft. Enabled registry rows only.
 */

import {
  DEFAULT_PLATFORM_LANGUAGE,
  type LanguageCode,
  type LanguageRegistryRecord,
} from "@hu/types";

import { PreferencesValidationError } from "../preferences/preferences.errors.js";
import {
  listLanguageRegistry,
  resolveLanguageRegistryLocale,
} from "./language-registry/index.js";
import { TranslationProviderError } from "./translation.config.js";

/**
 * Legacy-compatible picker descriptor (code / englishName / nativeName / rtl).
 * `code` is the canonical registry locale (e.g. `en`, later `zh-Hant`).
 */
export interface SelectableLanguageDescriptor {
  readonly code: LanguageCode;
  readonly englishName: string;
  readonly nativeName: string;
  readonly rtl: boolean;
}

function toSelectableDescriptor(record: LanguageRegistryRecord): SelectableLanguageDescriptor {
  return {
    code: record.locale,
    englishName: record.englishName,
    nativeName: record.nativeName,
    rtl: record.textDirection === "rtl",
  };
}

/**
 * Enabled languages only, deterministic order (locale, then languageId).
 */
export async function listEnabledSelectableLanguages(): Promise<
  readonly SelectableLanguageDescriptor[]
> {
  const records = await listLanguageRegistry();
  return records.filter((row) => row.enabled === true).map(toSelectableDescriptor);
}

/**
 * Resolve input (canonical locale or alias) to an enabled registry locale.
 * Returns null when unknown or when the matched record is disabled.
 */
export async function resolveEnabledCanonicalLocale(
  input: string | null | undefined,
): Promise<LanguageCode | null> {
  if (typeof input !== "string") {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const record = await resolveLanguageRegistryLocale(trimmed);
  if (!record || record.enabled !== true) {
    return null;
  }
  return record.locale;
}

/**
 * Assert a user-selectable language for Translate Draft / translation generate.
 */
export async function assertEnabledSelectableLocale(
  input: string | null | undefined,
  fieldLabel = "target language",
): Promise<LanguageCode> {
  const resolved = await resolveEnabledCanonicalLocale(input);
  if (!resolved) {
    throw new TranslationProviderError(
      "unsupported_language",
      `Unsupported ${fieldLabel}.`,
    );
  }
  return resolved;
}

/**
 * Assert + canonicalize a preference language field (throws PreferencesValidationError).
 */
export async function assertEnabledPreferenceLocale(
  input: string | null | undefined,
  fieldName: string,
): Promise<LanguageCode> {
  const resolved = await resolveEnabledCanonicalLocale(input);
  if (!resolved) {
    throw new PreferencesValidationError(
      `${fieldName} must be an enabled platform language.`,
    );
  }
  return resolved;
}

/**
 * Resolve for runtime reading context: enabled canonical locale, else English fallback.
 * Does not enable disabled languages.
 */
export async function resolveLocaleWithEnglishFallback(
  input: string | null | undefined,
): Promise<LanguageCode> {
  const resolved = await resolveEnabledCanonicalLocale(input);
  return resolved ?? DEFAULT_PLATFORM_LANGUAGE;
}
