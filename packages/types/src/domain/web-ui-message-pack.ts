/**
 * Admin/persisted WEB_UI message packs for arbitrary Registry locales.
 * Complements bundled verification catalogs (en/uk/ar/zh-Hant).
 * Never machine-translated via Gemini / TranslationProvider on read.
 */

import type { LanguageWebUiReadinessSlice } from "./language-localization-readiness.js";

export type WebUiMessagePackStatus = "draft" | "published";

export const WEB_UI_MESSAGE_PACK_STATUSES = ["draft", "published"] as const;

export function isWebUiMessagePackStatus(value: unknown): value is WebUiMessagePackStatus {
  return (
    typeof value === "string" &&
    (WEB_UI_MESSAGE_PACK_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Nested next-intl-compatible message tree (string leaves only at publish time).
 */
export type WebUiMessageTree = {
  readonly [key: string]: string | WebUiMessageTree;
};

export interface WebUiMessagePackRecord {
  readonly packId: string;
  /** Canonical Registry locale — immutable after create. */
  readonly locale: string;
  /** Monotonic revision for audit / cache busting. */
  readonly revision: number;
  readonly status: WebUiMessagePackStatus;
  readonly messages: WebUiMessageTree;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedByParticipantId?: string | null;
  /** Optional operator note (import source, ticket, etc.). */
  readonly sourceNote?: string | null;
}

export interface WebUiMessagePackUpsertInput {
  readonly locale: string;
  readonly messages: WebUiMessageTree;
  readonly status?: WebUiMessagePackStatus;
  readonly sourceNote?: string | null;
  readonly updatedByParticipantId?: string | null;
}

export interface WebUiMessagePackPublicPayload {
  readonly locale: string;
  readonly revision: number;
  readonly messages: WebUiMessageTree;
  readonly source: "remote";
}

export interface WebUiMessagePackAdminListResponse {
  readonly packs: readonly WebUiMessagePackRecord[];
}

export interface WebUiMessagePackValidationReport {
  readonly acceptedKeyCount: number;
  readonly rejectedUnknownPaths: readonly string[];
  readonly rejectedNonStringPaths: readonly string[];
  /** Present but not a hard reject — public readiness already treats these as not ready. */
  readonly emptyPaths: readonly string[];
  /** Hard reject on import. Top-level placeholders and rich-text tags must match English. */
  readonly placeholderMismatchPaths: readonly string[];
}

export type WebUiMessagePackPreparationScope = "public" | "full";

/**
 * English starting catalog for one Registry locale.
 * `messages` is the existing pack tree. Replace values, then PUT the same shape.
 */
export interface WebUiMessagePackPreparation {
  readonly locale: string;
  readonly scope: WebUiMessagePackPreparationScope;
  readonly source: "english-catalog";
  readonly publicRequiredKeyCount: number;
  /** Step 15D.2 — ordinary Participant WEB_UI required path count. */
  readonly participantRequiredKeyCount: number;
  readonly fullCatalogKeyCount: number;
  readonly pack: {
    readonly status: WebUiMessagePackStatus;
    readonly revision: number;
  } | null;
  readonly publicReadiness: LanguageWebUiReadinessSlice;
  /** Step 15D.2 — Participant WEB_UI readiness against the effective pack. */
  readonly participantReadiness: LanguageWebUiReadinessSlice;
  readonly fullCatalog: {
    readonly requiredKeyCount: number;
    readonly missingKeyCount: number;
    readonly emptyKeyCount: number;
    readonly dataReady: boolean;
  };
  readonly messages: WebUiMessageTree;
}
