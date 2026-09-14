/**
 * Production Completion Pack 02B Task 01 — Language Registry seed catalog.
 * Idempotent bootstrap only; does not overwrite existing Admin-modified rows.
 */

import type { LanguageRegistryRecord } from "@hu/types";
import {
  LANGUAGE_REGISTRY_DEFAULT_FALLBACK_LOCALE,
  deriveLanguageCodeFromLocale,
} from "@hu/types";

const SEED_TIMESTAMP = "2026-08-30T00:00:00.000Z";

export interface LanguageRegistrySeedDefinition {
  readonly languageId: string;
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: "ltr" | "rtl";
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly uiTranslationStatus: LanguageRegistryRecord["uiTranslationStatus"];
  readonly contentTranslationEnabled: boolean;
  readonly searchEnabled: boolean;
  readonly seoIndexingEnabled: boolean;
}

/**
 * Exact Task 01 verification seeds.
 * Enabling flags are initial policy defaults — Admin may change them later.
 */
export const LANGUAGE_REGISTRY_SEED_DEFINITIONS: readonly LanguageRegistrySeedDefinition[] = [
  {
    languageId: "lang-en",
    locale: "en",
    englishName: "English",
    nativeName: "English",
    textDirection: "ltr",
    aliases: [],
    enabled: true,
    uiTranslationStatus: "complete",
    contentTranslationEnabled: false,
    searchEnabled: true,
    seoIndexingEnabled: true,
  },
  {
    languageId: "lang-uk",
    locale: "uk",
    englishName: "Ukrainian",
    nativeName: "Українська",
    textDirection: "ltr",
    aliases: [],
    enabled: false,
    uiTranslationStatus: "none",
    contentTranslationEnabled: false,
    searchEnabled: false,
    seoIndexingEnabled: false,
  },
  {
    languageId: "lang-zh-Hant",
    locale: "zh-Hant",
    englishName: "Chinese (Traditional)",
    nativeName: "繁體中文",
    textDirection: "ltr",
    aliases: ["zh-TW", "zh-HK"],
    enabled: false,
    uiTranslationStatus: "none",
    contentTranslationEnabled: false,
    searchEnabled: false,
    seoIndexingEnabled: false,
  },
  {
    languageId: "lang-ar",
    locale: "ar",
    englishName: "Arabic",
    nativeName: "العربية",
    textDirection: "rtl",
    aliases: [],
    enabled: false,
    uiTranslationStatus: "none",
    contentTranslationEnabled: false,
    searchEnabled: false,
    seoIndexingEnabled: false,
  },
] as const;

export function buildLanguageRegistrySeedRecord(
  definition: LanguageRegistrySeedDefinition,
  nowIso: string = SEED_TIMESTAMP,
): LanguageRegistryRecord {
  return {
    languageId: definition.languageId,
    locale: definition.locale,
    languageCode: deriveLanguageCodeFromLocale(definition.locale),
    englishName: definition.englishName,
    nativeName: definition.nativeName,
    textDirection: definition.textDirection,
    fallbackLocale: LANGUAGE_REGISTRY_DEFAULT_FALLBACK_LOCALE,
    enabled: definition.enabled,
    uiTranslationStatus: definition.uiTranslationStatus,
    contentTranslationEnabled: definition.contentTranslationEnabled,
    searchEnabled: definition.searchEnabled,
    seoIndexingEnabled: definition.seoIndexingEnabled,
    aliases: [...definition.aliases],
    providerMappings: {},
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
