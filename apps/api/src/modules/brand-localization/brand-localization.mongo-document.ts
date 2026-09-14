import type { BrandLocalizationRecord, BrandLocalizationStatus } from "@hu/types";
import { isBrandLocalizationStatus } from "@hu/types";

import { BrandLocalizationValidationError } from "./brand-localization.errors.js";

export interface BrandLocalizationMongoDocument {
  brandId: string;
  locale: string;
  siteName: string;
  shortName?: string;
  slogan: string;
  heroUnityQuote?: string;
  seoSiteName: string;
  seoTitleSuffix?: string;
  defaultMetaDescription: string;
  openGraphBrandName?: string;
  status: BrandLocalizationStatus;
  createdAt: string;
  updatedAt: string;
  updatedByParticipantId?: string | null;
}

export function toBrandLocalizationMongoDocument(
  record: BrandLocalizationRecord,
): BrandLocalizationMongoDocument {
  return {
    brandId: record.brandId,
    locale: record.locale,
    siteName: record.siteName,
    ...(record.shortName !== undefined ? { shortName: record.shortName } : {}),
    slogan: record.slogan,
    heroUnityQuote: record.heroUnityQuote,
    seoSiteName: record.seoSiteName,
    ...(record.seoTitleSuffix !== undefined ? { seoTitleSuffix: record.seoTitleSuffix } : {}),
    defaultMetaDescription: record.defaultMetaDescription,
    ...(record.openGraphBrandName !== undefined
      ? { openGraphBrandName: record.openGraphBrandName }
      : {}),
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    updatedByParticipantId: record.updatedByParticipantId ?? null,
  };
}

export function fromBrandLocalizationMongoDocument(
  doc: BrandLocalizationMongoDocument,
): BrandLocalizationRecord {
  if (!isBrandLocalizationStatus(doc.status)) {
    throw new BrandLocalizationValidationError(
      `Invalid brand localization status in persistence: ${String(doc.status)}`,
    );
  }
  const heroUnityQuote =
    typeof doc.heroUnityQuote === "string" ? doc.heroUnityQuote : "";
  return {
    brandId: doc.brandId,
    locale: doc.locale,
    siteName: doc.siteName,
    ...(doc.shortName !== undefined ? { shortName: doc.shortName } : {}),
    slogan: doc.slogan,
    heroUnityQuote,
    seoSiteName: doc.seoSiteName,
    ...(doc.seoTitleSuffix !== undefined ? { seoTitleSuffix: doc.seoTitleSuffix } : {}),
    defaultMetaDescription: doc.defaultMetaDescription,
    ...(doc.openGraphBrandName !== undefined
      ? { openGraphBrandName: doc.openGraphBrandName }
      : {}),
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    updatedByParticipantId: doc.updatedByParticipantId ?? null,
  };
}
