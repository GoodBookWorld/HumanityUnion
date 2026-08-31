import type { LanguageRegistryRecord, LanguageProviderMappings } from "@hu/types";
import {
  deriveLanguageCodeFromLocale,
  isLanguageTextDirection,
  isLanguageUiTranslationStatus,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import { LanguageRegistryValidationError } from "./language-registry.errors.js";

export interface LanguageRegistryMongoDocument {
  languageId: string;
  locale: string;
  /** Lowercase uniqueness key for locale. */
  localeKey: string;
  languageCode: string;
  englishName: string;
  nativeName: string;
  textDirection: "ltr" | "rtl";
  fallbackLocale: string;
  enabled: boolean;
  uiTranslationStatus: "none" | "partial" | "complete";
  contentTranslationEnabled: boolean;
  searchEnabled: boolean;
  seoIndexingEnabled: boolean;
  aliases: string[];
  /**
   * Lowercase uniqueness keys for aliases (multikey unique index).
   * Omitted when empty so multiple no-alias languages do not collide under
   * unique multikey indexing (Mongo indexes missing/null array fields as
   * undefined without a partial filter).
   */
  aliasKeys?: string[];
  providerMappings: LanguageProviderMappings;
  createdAt: string;
  updatedAt: string;
}

export function toLanguageRegistryMongoDocument(
  record: LanguageRegistryRecord,
): LanguageRegistryMongoDocument {
  const locale = record.locale.trim();
  const aliases = normalizeAliasList(record.aliases);
  const aliasKeys = aliases.map((alias) => normalizeLanguageRegistryLocaleKey(alias));
  return {
    languageId: record.languageId.trim(),
    locale,
    localeKey: normalizeLanguageRegistryLocaleKey(locale),
    languageCode: record.languageCode.trim().toLowerCase() || deriveLanguageCodeFromLocale(locale),
    englishName: record.englishName.trim(),
    nativeName: record.nativeName.trim(),
    textDirection: record.textDirection,
    fallbackLocale: record.fallbackLocale.trim() || "en",
    enabled: record.enabled === true,
    uiTranslationStatus: record.uiTranslationStatus,
    contentTranslationEnabled: record.contentTranslationEnabled === true,
    searchEnabled: record.searchEnabled === true,
    seoIndexingEnabled: record.seoIndexingEnabled === true,
    aliases,
    ...(aliasKeys.length > 0 ? { aliasKeys } : {}),
    providerMappings: { ...record.providerMappings },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function fromLanguageRegistryMongoDocument(
  doc: LanguageRegistryMongoDocument,
): LanguageRegistryRecord {
  if (!isLanguageTextDirection(doc.textDirection)) {
    throw new LanguageRegistryValidationError(
      `Invalid textDirection on language registry document ${doc.languageId}.`,
    );
  }
  if (!isLanguageUiTranslationStatus(doc.uiTranslationStatus)) {
    throw new LanguageRegistryValidationError(
      `Invalid uiTranslationStatus on language registry document ${doc.languageId}.`,
    );
  }

  return {
    languageId: doc.languageId,
    locale: doc.locale,
    languageCode: doc.languageCode,
    englishName: doc.englishName,
    nativeName: doc.nativeName,
    textDirection: doc.textDirection,
    fallbackLocale: doc.fallbackLocale,
    enabled: doc.enabled === true,
    uiTranslationStatus: doc.uiTranslationStatus,
    contentTranslationEnabled: doc.contentTranslationEnabled === true,
    searchEnabled: doc.searchEnabled === true,
    seoIndexingEnabled: doc.seoIndexingEnabled === true,
    aliases: Array.isArray(doc.aliases) ? [...doc.aliases] : [],
    providerMappings: { ...(doc.providerMappings ?? {}) },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function normalizeAliasList(aliases: readonly string[] | undefined): string[] {
  if (!aliases?.length) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of aliases) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const key = normalizeLanguageRegistryLocaleKey(trimmed);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
