/**
 * Production Completion Pack 02B — Language Registry domain contract.
 *
 * Admin/Mongo-managed registry of supported languages.
 * Hardcoded PRIORITY_LANGUAGE_CATALOG is legacy compatibility data only.
 */

import type { LanguageCode } from "./language.js";
import { DEFAULT_PLATFORM_LANGUAGE } from "./language.js";

/** Stable registry row identity (not a BCP-47 tag). */
export type LanguageRegistryId = string;

/** Canonical BCP-47 locale tag as stored in the registry (e.g. `zh-Hant`). */
export type LanguageRegistryLocale = string;

export type LanguageTextDirection = "ltr" | "rtl";

/**
 * UI message-pack coverage for this locale.
 * Policy/status only — does not enable the language by itself.
 */
export type LanguageUiTranslationStatus = "none" | "partial" | "complete";

export const LANGUAGE_UI_TRANSLATION_STATUSES: readonly LanguageUiTranslationStatus[] = [
  "none",
  "partial",
  "complete",
] as const;

/**
 * Opaque provider-specific mappings (server-side).
 * Must not become the public domain identity for a language.
 */
export type LanguageProviderMappings = Readonly<Record<string, string>>;

/**
 * Canonical Language Registry record.
 * English (`en`) is the platform fallback locale.
 */
export interface LanguageRegistryRecord {
  readonly languageId: LanguageRegistryId;
  /** Canonical BCP-47 locale (unique). */
  readonly locale: LanguageRegistryLocale;
  /** ISO 639 language code / base subtag (e.g. `zh` for `zh-Hant`). */
  readonly languageCode: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: LanguageTextDirection;
  /** Fallback locale when content/UI for this locale is unavailable (typically `en`). */
  readonly fallbackLocale: LanguageRegistryLocale;
  /** Available to users when true — Admin policy, not compile-time. */
  readonly enabled: boolean;
  readonly uiTranslationStatus: LanguageUiTranslationStatus;
  readonly contentTranslationEnabled: boolean;
  readonly searchEnabled: boolean;
  /** Independent of `enabled` — SEO/indexing readiness. */
  readonly seoIndexingEnabled: boolean;
  /** Alternate tags that resolve to this canonical locale (e.g. zh-TW → zh-Hant). */
  readonly aliases: readonly LanguageRegistryLocale[];
  readonly providerMappings: LanguageProviderMappings;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LanguageRegistryCreateInput {
  readonly languageId?: LanguageRegistryId;
  readonly locale: LanguageRegistryLocale;
  readonly languageCode?: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: LanguageTextDirection;
  readonly fallbackLocale?: LanguageRegistryLocale;
  readonly enabled?: boolean;
  readonly uiTranslationStatus?: LanguageUiTranslationStatus;
  readonly contentTranslationEnabled?: boolean;
  readonly searchEnabled?: boolean;
  readonly seoIndexingEnabled?: boolean;
  readonly aliases?: readonly LanguageRegistryLocale[];
  readonly providerMappings?: LanguageProviderMappings;
}

export interface LanguageRegistryUpdateInput {
  readonly englishName?: string;
  readonly nativeName?: string;
  readonly textDirection?: LanguageTextDirection;
  readonly fallbackLocale?: LanguageRegistryLocale;
  readonly enabled?: boolean;
  readonly uiTranslationStatus?: LanguageUiTranslationStatus;
  readonly contentTranslationEnabled?: boolean;
  readonly searchEnabled?: boolean;
  readonly seoIndexingEnabled?: boolean;
  readonly aliases?: readonly LanguageRegistryLocale[];
  readonly providerMappings?: LanguageProviderMappings;
  /**
   * @deprecated Canonical locale is immutable after creation (Pack 02B Task 04).
   * Passing a different locale is rejected.
   */
  readonly locale?: LanguageRegistryLocale;
  readonly languageCode?: string;
}

/**
 * Public-safe Language Registry projection (enabled languages only).
 * Omits providerMappings, persistence keys, and Admin/audit internals.
 */
export interface LanguageRegistryPublic {
  readonly languageId: LanguageRegistryId;
  readonly locale: LanguageRegistryLocale;
  readonly languageCode: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: LanguageTextDirection;
  readonly fallbackLocale: LanguageRegistryLocale;
  readonly uiTranslationStatus: LanguageUiTranslationStatus;
  readonly aliases: readonly LanguageRegistryLocale[];
}

export interface LanguageRegistryPublicListResponse {
  readonly languages: readonly LanguageRegistryPublic[];
}

/**
 * Admin Language Registry projection (all records, including disabled).
 * Omits providerMappings until an Admin UI requirement is demonstrated.
 */
export interface LanguageRegistryAdmin {
  readonly languageId: LanguageRegistryId;
  readonly locale: LanguageRegistryLocale;
  readonly languageCode: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: LanguageTextDirection;
  readonly fallbackLocale: LanguageRegistryLocale;
  readonly enabled: boolean;
  readonly uiTranslationStatus: LanguageUiTranslationStatus;
  readonly contentTranslationEnabled: boolean;
  readonly searchEnabled: boolean;
  readonly seoIndexingEnabled: boolean;
  readonly aliases: readonly LanguageRegistryLocale[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LanguageRegistryAdminListResponse {
  readonly languages: readonly LanguageRegistryAdmin[];
}

export function isLanguageUiTranslationStatus(
  value: unknown,
): value is LanguageUiTranslationStatus {
  return (
    typeof value === "string" &&
    (LANGUAGE_UI_TRANSLATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isLanguageTextDirection(value: unknown): value is LanguageTextDirection {
  return value === "ltr" || value === "rtl";
}

/**
 * Normalize a locale/alias for case-insensitive comparison.
 * Preserves structure; does not collapse `zh-Hant` → `zh`.
 */
export function normalizeLanguageRegistryLocaleKey(value: string): string {
  return value.trim().toLowerCase();
}

export function deriveLanguageCodeFromLocale(locale: string): string {
  const trimmed = locale.trim();
  const base = trimmed.split("-")[0] ?? trimmed;
  return base.toLowerCase();
}

export const LANGUAGE_REGISTRY_DEFAULT_FALLBACK_LOCALE: LanguageCode =
  DEFAULT_PLATFORM_LANGUAGE;
