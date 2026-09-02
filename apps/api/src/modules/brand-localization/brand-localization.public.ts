/**
 * Pack 08I.2 — public resolveLocalizedBrand.
 * Registry canonicalize → published locale → published en → builtin English.
 * Never imports TranslationProvider / Gemini / content_translations.
 */

import {
  CANONICAL_ENGLISH_BRAND_FALLBACK,
  type BrandLocalizationPublicSummary,
  type BrandLocalizationRecord,
  type ResolvedLocalizedBrand,
} from "@hu/types";

import { resolveLanguageRegistryLocale } from "../language/language-registry/language-registry.repository.js";
import {
  ensureBrandLocalizationSeeded,
  getBrandLocalizationByLocale,
  listBrandLocalizations,
} from "./brand-localization.repository.js";
import { ENGLISH_BRAND_LOCALIZATION_LOCALE } from "./brand-localization.seed.js";

function fromPublishedRecord(
  record: BrandLocalizationRecord,
  requestedLocale: string,
  source: ResolvedLocalizedBrand["source"],
): ResolvedLocalizedBrand {
  return {
    locale: record.locale,
    requestedLocale,
    siteName: record.siteName,
    shortName: record.shortName?.trim() || CANONICAL_ENGLISH_BRAND_FALLBACK.shortName,
    slogan: record.slogan,
    heroUnityQuote:
      record.heroUnityQuote?.trim() || CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote,
    seoSiteName: record.seoSiteName,
    seoTitleSuffix:
      record.seoTitleSuffix?.trim() ||
      record.seoSiteName ||
      CANONICAL_ENGLISH_BRAND_FALLBACK.seoTitleSuffix,
    defaultMetaDescription: record.defaultMetaDescription,
    openGraphBrandName:
      record.openGraphBrandName?.trim() ||
      record.siteName ||
      CANONICAL_ENGLISH_BRAND_FALLBACK.openGraphBrandName,
    source,
  };
}

function fromBuiltin(requestedLocale: string): ResolvedLocalizedBrand {
  return {
    locale: ENGLISH_BRAND_LOCALIZATION_LOCALE,
    requestedLocale,
    siteName: CANONICAL_ENGLISH_BRAND_FALLBACK.siteName,
    shortName: CANONICAL_ENGLISH_BRAND_FALLBACK.shortName,
    slogan: CANONICAL_ENGLISH_BRAND_FALLBACK.slogan,
    heroUnityQuote: CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote,
    seoSiteName: CANONICAL_ENGLISH_BRAND_FALLBACK.seoSiteName,
    seoTitleSuffix: CANONICAL_ENGLISH_BRAND_FALLBACK.seoTitleSuffix,
    defaultMetaDescription: CANONICAL_ENGLISH_BRAND_FALLBACK.defaultMetaDescription,
    openGraphBrandName: CANONICAL_ENGLISH_BRAND_FALLBACK.openGraphBrandName,
    source: "builtin_english",
  };
}

function isUsablePublishedBrand(record: BrandLocalizationRecord | null): boolean {
  return Boolean(
    record &&
      record.status === "published" &&
      record.siteName.trim() &&
      record.slogan.trim() &&
      record.heroUnityQuote.trim() &&
      record.seoSiteName.trim() &&
      record.defaultMetaDescription.trim(),
  );
}

/**
 * Resolve presentation brand for a requested locale.
 * Alias tags (e.g. zh-TW) canonicalize via Language Registry before lookup.
 */
export async function resolveLocalizedBrand(
  localeOrAlias: string,
): Promise<ResolvedLocalizedBrand> {
  await ensureBrandLocalizationSeeded();

  const requested = localeOrAlias.trim() || ENGLISH_BRAND_LOCALIZATION_LOCALE;
  const registry = await resolveLanguageRegistryLocale(requested);
  const canonicalLocale = registry?.locale ?? requested;

  const localeRecord = await getBrandLocalizationByLocale(canonicalLocale);
  if (isUsablePublishedBrand(localeRecord)) {
    return fromPublishedRecord(localeRecord!, requested, "published_locale");
  }

  if (canonicalLocale !== ENGLISH_BRAND_LOCALIZATION_LOCALE) {
    const english = await getBrandLocalizationByLocale(ENGLISH_BRAND_LOCALIZATION_LOCALE);
    if (isUsablePublishedBrand(english)) {
      return fromPublishedRecord(english!, requested, "published_english");
    }
  }

  return fromBuiltin(requested);
}

export async function listPublishedBrandLocalizationSummaries(): Promise<
  readonly BrandLocalizationPublicSummary[]
> {
  await ensureBrandLocalizationSeeded();
  const records = await listBrandLocalizations();
  return records
    .filter((row) => row.status === "published")
    .map((row) => ({
      locale: row.locale,
      siteName: row.siteName,
      slogan: row.slogan,
      status: "published" as const,
    }));
}
