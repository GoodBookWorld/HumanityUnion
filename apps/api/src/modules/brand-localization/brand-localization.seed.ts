/**
 * Pack 08I.2 — seed English published brand from canonical builtin fallback.
 * Never calls Gemini / TranslationProvider.
 */

import {
  CANONICAL_ENGLISH_BRAND_FALLBACK,
  type BrandLocalizationRecord,
} from "@hu/types";

export const ENGLISH_BRAND_LOCALIZATION_LOCALE = "en";
export const ENGLISH_BRAND_LOCALIZATION_ID = "brand-en";

export function buildEnglishPublishedBrandLocalization(
  nowIso: string = new Date().toISOString(),
): BrandLocalizationRecord {
  return {
    brandId: ENGLISH_BRAND_LOCALIZATION_ID,
    locale: ENGLISH_BRAND_LOCALIZATION_LOCALE,
    siteName: CANONICAL_ENGLISH_BRAND_FALLBACK.siteName,
    shortName: CANONICAL_ENGLISH_BRAND_FALLBACK.shortName,
    slogan: CANONICAL_ENGLISH_BRAND_FALLBACK.slogan,
    heroUnityQuote: CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote,
    seoSiteName: CANONICAL_ENGLISH_BRAND_FALLBACK.seoSiteName,
    seoTitleSuffix: CANONICAL_ENGLISH_BRAND_FALLBACK.seoTitleSuffix,
    defaultMetaDescription: CANONICAL_ENGLISH_BRAND_FALLBACK.defaultMetaDescription,
    openGraphBrandName: CANONICAL_ENGLISH_BRAND_FALLBACK.openGraphBrandName,
    status: "published",
    createdAt: nowIso,
    updatedAt: nowIso,
    updatedByParticipantId: null,
  };
}
