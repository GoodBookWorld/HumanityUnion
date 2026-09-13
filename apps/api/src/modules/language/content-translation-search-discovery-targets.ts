/**
 * Step 06C.1 — Search discovery CT target locale eligibility.
 *
 * Discovery targets require:
 *   language.enabled === true
 *   AND language.searchEnabled === true
 *
 * Independent of contentTranslationEnabled, WEB_UI, PLP, SEO, languageDataReady.
 * Does not weaken automatic_warm (enabled + contentTranslationEnabled).
 */

import type { LanguageCode } from "@hu/types";

import {
  listLanguageRegistry,
  resolveLanguageRegistryLocale,
} from "./language-registry/language-registry.repository.js";
import { TranslationProviderError } from "./translation.config.js";

export interface SearchDiscoveryContentTranslationWarmTargetResolution {
  readonly registryCandidates: readonly {
    readonly locale: string;
    readonly enabled: boolean;
    readonly searchEnabled: boolean;
  }[];
  readonly warmTargetLocales: readonly LanguageCode[];
}

/**
 * Enabled + searchEnabled locales, deterministic locale order.
 * Optionally excludes the canonical source language (never translate to self).
 */
export async function resolveSearchDiscoveryContentTranslationWarmTargets(input?: {
  readonly excludeSourceLanguage?: LanguageCode | null;
}): Promise<SearchDiscoveryContentTranslationWarmTargetResolution> {
  const records = await listLanguageRegistry();
  const exclude = input?.excludeSourceLanguage?.trim().toLowerCase() ?? null;

  const registryCandidates = records
    .map((record) => ({
      locale: record.locale.trim(),
      enabled: record.enabled === true,
      searchEnabled: record.searchEnabled === true,
    }))
    .filter((row) => row.locale.length > 0)
    .sort((a, b) => a.locale.localeCompare(b.locale));

  const locales = new Set<string>();
  for (const candidate of registryCandidates) {
    if (candidate.enabled !== true) {
      continue;
    }
    if (candidate.searchEnabled !== true) {
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

export async function listSearchDiscoveryContentTranslationTargetLocales(input?: {
  readonly excludeSourceLanguage?: LanguageCode | null;
}): Promise<readonly LanguageCode[]> {
  const resolved = await resolveSearchDiscoveryContentTranslationWarmTargets(input);
  return resolved.warmTargetLocales;
}

/**
 * Assert a locale is a Search discovery target (enabled + searchEnabled).
 * Aliases resolve to the canonical Registry locale.
 */
export async function assertSearchDiscoveryTargetLocale(
  input: string | null | undefined,
  fieldLabel = "search discovery target language",
): Promise<LanguageCode> {
  if (typeof input !== "string" || !input.trim()) {
    throw new TranslationProviderError(
      "unsupported_language",
      `Unsupported ${fieldLabel}.`,
    );
  }
  const record = await resolveLanguageRegistryLocale(input.trim());
  if (!record || record.enabled !== true || record.searchEnabled !== true) {
    throw new TranslationProviderError(
      "unsupported_language",
      `Unsupported ${fieldLabel} for Search discovery content translation.`,
    );
  }
  return record.locale;
}
