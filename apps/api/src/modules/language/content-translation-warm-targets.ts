/**
 * Pack 02G Task 02 — automatic warm target locale eligibility.
 *
 * Automatic targets require:
 *   language.enabled === true
 *   AND language.contentTranslationEnabled === true
 *
 * Canonical Registry locales only (aliases collapse; no duplicate targets).
 * UI/search/SEO registry flags do NOT enable warming.
 * On-demand generate continues to use enabled-only selection elsewhere.
 */

import type { LanguageCode } from "@hu/types";

import {
  listLanguageRegistry,
  resolveLanguageRegistryLocale,
} from "./language-registry/index.js";
import { TranslationProviderError } from "./translation.config.js";

/**
 * Enabled + contentTranslationEnabled locales, deterministic locale order.
 * Optionally excludes the canonical source language (never translate to self).
 */
export async function listAutomaticContentTranslationTargetLocales(input?: {
  readonly excludeSourceLanguage?: LanguageCode | null;
}): Promise<readonly LanguageCode[]> {
  const records = await listLanguageRegistry();
  const exclude = input?.excludeSourceLanguage?.trim().toLowerCase() ?? null;
  const locales = new Set<string>();

  for (const record of records) {
    if (record.enabled !== true) {
      continue;
    }
    if (record.contentTranslationEnabled !== true) {
      continue;
    }
    const locale = record.locale.trim();
    if (!locale) {
      continue;
    }
    if (exclude && locale.toLowerCase() === exclude) {
      continue;
    }
    locales.add(locale);
  }

  return [...locales].sort((a, b) => a.localeCompare(b)) as LanguageCode[];
}

/**
 * Assert a locale is an automatic warm target (enabled + contentTranslationEnabled).
 * Aliases resolve to the canonical Registry locale.
 */
export async function assertAutomaticContentTranslationTargetLocale(
  input: string | null | undefined,
  fieldLabel = "warm target language",
): Promise<LanguageCode> {
  if (typeof input !== "string" || !input.trim()) {
    throw new TranslationProviderError(
      "unsupported_language",
      `Unsupported ${fieldLabel}.`,
    );
  }
  const record = await resolveLanguageRegistryLocale(input.trim());
  if (
    !record ||
    record.enabled !== true ||
    record.contentTranslationEnabled !== true
  ) {
    throw new TranslationProviderError(
      "unsupported_language",
      `Unsupported ${fieldLabel} for automatic content translation warming.`,
    );
  }
  return record.locale;
}
