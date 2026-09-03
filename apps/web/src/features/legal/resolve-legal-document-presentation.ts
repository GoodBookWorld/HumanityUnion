/**
 * Pack 08I.4 / 08I.5 — legal document presentation contract.
 *
 * Chrome (title, counsel note, nav) is localized via `legalPublic` catalogs.
 * English legal body remains the authoritative canonical source.
 *
 * Published counsel-approved bodies are fetched from Legal Localization API.
 * Do NOT call Gemini. Do NOT fabricate full uk/zh/ar legal translations.
 * APPROVED_LOCALIZED_LEGAL_BODIES remains an empty optional last-resort override map.
 */

import { resolveLocalizedLegalBody } from "./resolve-localized-legal-body";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages";

export const EXPECTED_LEGAL_FALLBACK = "expected_legal_fallback" as const;

export type LegalDocumentId = "privacy" | "terms";

export type LegalBodySource = "approved_localized" | typeof EXPECTED_LEGAL_FALLBACK;

export interface LegalDocumentChrome {
  readonly title: string;
  readonly counselNote: string;
  readonly navAriaLabel: string;
  readonly privacyLabel: string;
  readonly termsLabel: string;
  readonly expectedFallbackNote: string;
}

export interface LegalDocumentBodyPresentation {
  readonly source: LegalBodySource;
  /**
   * Approved localized HTML body when `source === "approved_localized"`.
   * Null when falling back to the English canonical page body.
   */
  readonly localizedBodyHtml: string | null;
}

export interface LegalDocumentPresentation {
  readonly documentId: LegalDocumentId;
  readonly locale: string;
  readonly chrome: LegalDocumentChrome;
  readonly body: LegalDocumentBodyPresentation;
}

/**
 * Counsel-approved localized legal bodies only (optional code-level last resort).
 * Intentionally empty — prefer Admin Legal Localization API. Never auto-translate with Gemini.
 */
export const APPROVED_LOCALIZED_LEGAL_BODIES: Readonly<
  Partial<Record<string, Partial<Record<LegalDocumentId, string>>>>
> = Object.freeze({});

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`legalPublic missing string at ${path}`);
  }
  return value;
}

function readLegalPublicChrome(
  messages: Record<string, unknown>,
  documentId: LegalDocumentId,
): LegalDocumentChrome {
  const legal = messages.legalPublic as Record<string, unknown> | undefined;
  if (!legal || typeof legal !== "object") {
    throw new Error("legalPublic catalog missing");
  }
  const nav = legal.nav as Record<string, unknown> | undefined;
  const doc = legal[documentId] as Record<string, unknown> | undefined;
  if (!nav || typeof nav !== "object") {
    throw new Error("legalPublic.nav missing");
  }
  if (!doc || typeof doc !== "object") {
    throw new Error(`legalPublic.${documentId} missing`);
  }
  return {
    title: requireString(doc.title, `${documentId}.title`),
    counselNote: requireString(doc.counselNote, `${documentId}.counselNote`),
    navAriaLabel: requireString(nav.ariaLabel, "nav.ariaLabel"),
    privacyLabel: requireString(nav.privacy, "nav.privacy"),
    termsLabel: requireString(nav.terms, "nav.terms"),
    expectedFallbackNote: requireString(legal.expectedFallbackNote, "expectedFallbackNote"),
  };
}

/**
 * Resolves localized legal chrome and whether an approved localized body exists.
 * Prefer published Legal Localization API; optional empty map is last resort.
 * When no approved body is present for the locale, returns
 * `body.source === "expected_legal_fallback"` and `localizedBodyHtml: null`
 * so callers render the English canonical document.
 * Does not claim translated body metadata when falling back.
 */
export async function resolveLegalDocumentPresentation(
  locale: string,
  documentId: LegalDocumentId,
): Promise<LegalDocumentPresentation> {
  const loaded = await loadUiMessagesForLocale(locale);
  const chrome = readLegalPublicChrome(
    loaded.messages as Record<string, unknown>,
    documentId,
  );

  const resolved = await resolveLocalizedLegalBody(documentId, locale);
  if (
    resolved.source === "published_locale" &&
    resolved.localizedBodyHtml &&
    resolved.localizedBodyHtml.trim().length > 0
  ) {
    return {
      documentId,
      locale,
      chrome,
      body: {
        source: "approved_localized",
        localizedBodyHtml: resolved.localizedBodyHtml,
      },
    };
  }

  const codeOverride = APPROVED_LOCALIZED_LEGAL_BODIES[locale]?.[documentId] ?? null;
  if (codeOverride && codeOverride.trim().length > 0) {
    return {
      documentId,
      locale,
      chrome,
      body: {
        source: "approved_localized",
        localizedBodyHtml: codeOverride,
      },
    };
  }

  return {
    documentId,
    locale,
    chrome,
    body: {
      source: EXPECTED_LEGAL_FALLBACK,
      localizedBodyHtml: null,
    },
  };
}
