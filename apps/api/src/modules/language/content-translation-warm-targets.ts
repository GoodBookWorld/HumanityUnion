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

import type { ContentTranslationWarmRegistryCandidateDiagnostic } from "./content-translation-warm-diagnostic.js";
import {
  listLanguageRegistry,
  resolveLanguageRegistryLocale,
} from "./language-registry/index.js";
import { TranslationProviderError } from "./translation.config.js";

export interface AutomaticContentTranslationWarmTargetResolution {
  readonly registryCandidates: readonly ContentTranslationWarmRegistryCandidateDiagnostic[];
  readonly warmTargetLocales: readonly LanguageCode[];
}

/**
 * One Registry list: non-sensitive candidate snapshot + eligibility-filtered targets.
 * Eligibility rules unchanged from Task 02.
 */
export async function resolveAutomaticContentTranslationWarmTargets(input?: {
  readonly excludeSourceLanguage?: LanguageCode | null;
}): Promise<AutomaticContentTranslationWarmTargetResolution> {
  const records = await listLanguageRegistry();
  const exclude = input?.excludeSourceLanguage?.trim().toLowerCase() ?? null;

  const registryCandidates: ContentTranslationWarmRegistryCandidateDiagnostic[] = records
    .map((record) => ({
      locale: record.locale.trim(),
      enabled: record.enabled === true,
      contentTranslationEnabled: record.contentTranslationEnabled === true,
    }))
    .filter((row) => row.locale.length > 0)
    .sort((a, b) => a.locale.localeCompare(b.locale));

  const locales = new Set<string>();
  for (const candidate of registryCandidates) {
    if (candidate.enabled !== true) {
      continue;
    }
    if (candidate.contentTranslationEnabled !== true) {
      continue;
    }
    if (exclude && candidate.locale.toLowerCase() === exclude) {
      continue;
    }
    locales.add(candidate.locale);
  }

  return {
    registryCandidates,
    warmTargetLocales: [...locales].sort((a, b) => a.localeCompare(b)) as LanguageCode[],
  };
}

/**
 * Enabled + contentTranslationEnabled locales, deterministic locale order.
 * Optionally excludes the canonical source language (never translate to self).
 */
export async function listAutomaticContentTranslationTargetLocales(input?: {
  readonly excludeSourceLanguage?: LanguageCode | null;
}): Promise<readonly LanguageCode[]> {
  const resolved = await resolveAutomaticContentTranslationWarmTargets(input);
  return resolved.warmTargetLocales;
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
