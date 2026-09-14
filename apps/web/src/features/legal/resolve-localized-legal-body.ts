/**
 * Pack 08I.5 — fetch published counsel-approved legal body from Legal Localization API.
 * On failure → expected_legal_fallback. Never calls Gemini / TranslationProvider.
 */

import type { LegalDocumentType, ResolvedLocalizedLegalDocument } from "@hu/types";
import { CANONICAL_LEGAL_SOURCE_VERSIONS } from "@hu/types";

import { API_BASE_URL } from "../../lib/api-base-url";

const EXPECTED_LEGAL_FALLBACK_SOURCE = "expected_legal_fallback" as const;

export function fallbackLocalizedLegalBody(
  documentType: LegalDocumentType,
  requestedLocale: string,
): ResolvedLocalizedLegalDocument {
  const locale = requestedLocale.trim() || "en";
  return {
    documentType,
    locale,
    requestedLocale: locale,
    canonicalSourceVersion: CANONICAL_LEGAL_SOURCE_VERSIONS[documentType],
    localizedBodyHtml: null,
    source: EXPECTED_LEGAL_FALLBACK_SOURCE,
    isStaleRelativeToCanonical: false,
  };
}

function parseResolved(
  payload: unknown,
  documentType: LegalDocumentType,
  requestedLocale: string,
): ResolvedLocalizedLegalDocument {
  const envelope = payload as {
    success?: boolean;
    data?: ResolvedLocalizedLegalDocument;
  };
  const data = envelope.data;
  if (
    !data ||
    (data.source !== "published_locale" && data.source !== EXPECTED_LEGAL_FALLBACK_SOURCE) ||
    (data.documentType !== "privacy" && data.documentType !== "terms")
  ) {
    return fallbackLocalizedLegalBody(documentType, requestedLocale);
  }
  return data;
}

/**
 * Resolve published localized legal HTML for a document type + locale.
 * Network/parse failure returns expected_legal_fallback (English page body remains canonical).
 */
export async function resolveLocalizedLegalBody(
  documentType: LegalDocumentType,
  locale: string,
): Promise<ResolvedLocalizedLegalDocument> {
  const requested = locale.trim() || "en";
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/legal-localization?documentType=${encodeURIComponent(documentType)}&locale=${encodeURIComponent(requested)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
        credentials: "omit",
        signal: AbortSignal.timeout(3_000),
      },
    );
    if (!response.ok) {
      return fallbackLocalizedLegalBody(documentType, requested);
    }
    return parseResolved(await response.json(), documentType, requested);
  } catch {
    return fallbackLocalizedLegalBody(documentType, requested);
  }
}
