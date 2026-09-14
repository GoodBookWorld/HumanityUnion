/**
 * Pack 08I.5 — public resolvePublishedLegalLocalization.
 * Registry canonicalize → published matching canonical version → expected_legal_fallback.
 * Never imports TranslationProvider / Gemini / content_translations.
 * Never serves stale published bodies (version mismatch → fallback + stale flag).
 */

import {
  CANONICAL_LEGAL_SOURCE_VERSIONS,
  isLegalDocumentType,
  type LegalDocumentType,
  type LegalLocalizationRecord,
  type ResolvedLocalizedLegalDocument,
} from "@hu/types";

import { resolveLanguageRegistryLocale } from "../language/language-registry/language-registry.repository.js";
import { LegalLocalizationValidationError } from "./legal-localization.errors.js";
import {
  ensureLegalLocalizationReady,
  getLegalLocalization,
} from "./legal-localization.repository.js";

function fallbackResult(input: {
  documentType: LegalDocumentType;
  locale: string;
  requestedLocale: string;
  isStaleRelativeToCanonical: boolean;
}): ResolvedLocalizedLegalDocument {
  return {
    documentType: input.documentType,
    locale: input.locale,
    requestedLocale: input.requestedLocale,
    canonicalSourceVersion: CANONICAL_LEGAL_SOURCE_VERSIONS[input.documentType],
    localizedBodyHtml: null,
    source: "expected_legal_fallback",
    isStaleRelativeToCanonical: input.isStaleRelativeToCanonical,
  };
}

function isUsablePublishedLegal(record: LegalLocalizationRecord | null): boolean {
  if (!record || record.status !== "published") {
    return false;
  }
  if (!record.localizedBody.trim()) {
    return false;
  }
  return (
    record.canonicalSourceVersion === CANONICAL_LEGAL_SOURCE_VERSIONS[record.documentType]
  );
}

/**
 * Resolve published counsel-approved legal body for a document type + locale.
 * Alias tags (e.g. zh-TW) canonicalize via Language Registry before lookup.
 * English remains the authoritative canonical source when no matching published row exists.
 */
export async function resolvePublishedLegalLocalization(
  documentType: LegalDocumentType | string,
  localeOrAlias: string,
): Promise<ResolvedLocalizedLegalDocument> {
  if (!isLegalDocumentType(documentType)) {
    throw new LegalLocalizationValidationError(
      `documentType must be one of: privacy, terms.`,
    );
  }

  await ensureLegalLocalizationReady();

  const requested = localeOrAlias.trim() || "en";
  const registry = await resolveLanguageRegistryLocale(requested);
  const canonicalLocale = registry?.locale ?? requested;

  const record = await getLegalLocalization(documentType, canonicalLocale);

  if (isUsablePublishedLegal(record)) {
    return {
      documentType,
      locale: record!.locale,
      requestedLocale: requested,
      canonicalSourceVersion: record!.canonicalSourceVersion,
      localizedBodyHtml: record!.localizedBody,
      source: "published_locale",
      isStaleRelativeToCanonical: false,
    };
  }

  const publishedButStale =
    Boolean(record) &&
    record!.status === "published" &&
    record!.canonicalSourceVersion !== CANONICAL_LEGAL_SOURCE_VERSIONS[documentType];

  return fallbackResult({
    documentType,
    locale: canonicalLocale,
    requestedLocale: requested,
    isStaleRelativeToCanonical: publishedButStale,
  });
}
