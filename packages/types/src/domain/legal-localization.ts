/**
 * Pack 08I.5 — Admin-managed Legal Localization (counsel-approved only).
 * English legal documents remain the canonical authoritative source.
 * Never depends on Gemini / TranslationProvider / machine translation.
 */

export type LegalDocumentType = "privacy" | "terms";

export type LegalLocalizationStatus = "draft" | "approved" | "published";

export const LEGAL_DOCUMENT_TYPES = ["privacy", "terms"] as const;

export const LEGAL_LOCALIZATION_STATUSES = ["draft", "approved", "published"] as const;

export function isLegalDocumentType(value: unknown): value is LegalDocumentType {
  return (
    typeof value === "string" &&
    (LEGAL_DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

export function isLegalLocalizationStatus(value: unknown): value is LegalLocalizationStatus {
  return (
    typeof value === "string" &&
    (LEGAL_LOCALIZATION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Canonical English legal source versions — bump when English privacy/terms change.
 * Published locale copies must match to be served publicly.
 */
export const CANONICAL_LEGAL_SOURCE_VERSIONS = {
  privacy: "privacy-2026-03-v1",
  terms: "terms-2026-03-v1",
} as const satisfies Record<LegalDocumentType, string>;

export interface LegalLocalizationRecord {
  readonly legalId: string;
  readonly documentType: LegalDocumentType;
  /** Canonical Registry locale — immutable after create. */
  readonly locale: string;
  readonly canonicalSourceVersion: string;
  /** Counsel-approved localized HTML body. */
  readonly localizedBody: string;
  readonly status: LegalLocalizationStatus;
  readonly approvedAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedByParticipantId?: string | null;
}

export interface ResolvedLocalizedLegalDocument {
  readonly documentType: LegalDocumentType;
  /** Locale used for lookup (Registry canonical). */
  readonly locale: string;
  readonly requestedLocale: string;
  readonly canonicalSourceVersion: string;
  /** Published counsel-approved HTML, or null when falling back to English canonical. */
  readonly localizedBodyHtml: string | null;
  readonly source: "published_locale" | "expected_legal_fallback";
  /** True when a published row exists but its version does not match current canonical. */
  readonly isStaleRelativeToCanonical: boolean;
}

export interface LegalLocalizationAdminListItem extends LegalLocalizationRecord {
  readonly isStaleRelativeToCanonical: boolean;
}

export interface LegalLocalizationAdminListResponse {
  readonly localizations: readonly LegalLocalizationAdminListItem[];
}

export interface LegalLocalizationUpsertInput {
  readonly documentType: LegalDocumentType;
  readonly locale: string;
  readonly localizedBody: string;
  readonly status?: LegalLocalizationStatus;
  readonly canonicalSourceVersion?: string;
}

export interface LegalLocalizationUpdateInput {
  readonly localizedBody?: string;
  readonly status?: LegalLocalizationStatus;
  readonly canonicalSourceVersion?: string;
}
