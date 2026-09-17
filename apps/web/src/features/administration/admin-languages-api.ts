import type {
  LanguageActivationAdminView,
  LanguageLocalizationReadinessReport,
  LanguageRegistryAdmin,
  LanguageRegistryAdminListResponse,
  LanguageTextDirection,
  LanguageUiTranslationStatus,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";
import { invalidatePublicLanguagesClientCache } from "../language/public-languages-api";

const ADMIN_LANGUAGES_PATH = "/api/v1/admin/languages";

export interface AdminLanguageCreateInput {
  readonly locale: string;
  readonly englishName: string;
  readonly nativeName: string;
  readonly textDirection: LanguageTextDirection;
  readonly fallbackLocale?: string;
  readonly enabled?: boolean;
  readonly uiTranslationStatus?: LanguageUiTranslationStatus;
  readonly contentTranslationEnabled?: boolean;
  readonly searchEnabled?: boolean;
  readonly seoIndexingEnabled?: boolean;
  readonly pwaPersistedReadingEnabled?: boolean;
  readonly aliases?: readonly string[];
}

export interface AdminLanguagePatchInput {
  readonly englishName?: string;
  readonly nativeName?: string;
  readonly textDirection?: LanguageTextDirection;
  readonly fallbackLocale?: string;
  readonly enabled?: boolean;
  readonly uiTranslationStatus?: LanguageUiTranslationStatus;
  readonly contentTranslationEnabled?: boolean;
  readonly searchEnabled?: boolean;
  readonly seoIndexingEnabled?: boolean;
  readonly pwaPersistedReadingEnabled?: boolean;
  readonly aliases?: readonly string[];
}

export async function fetchAdminLanguages(): Promise<LanguageRegistryAdminListResponse> {
  return apiRequest<LanguageRegistryAdminListResponse>(ADMIN_LANGUAGES_PATH);
}

/** Closure 07 — provider-free localization readiness for one Admin language. */
export async function fetchAdminLanguageLocalizationReadiness(
  languageId: string,
): Promise<LanguageLocalizationReadinessReport> {
  return apiRequest<LanguageLocalizationReadinessReport>(
    `${ADMIN_LANGUAGES_PATH}/${encodeURIComponent(languageId)}/localization-readiness`,
  );
}

/** Explicit async activation — returns job + readiness; no Search/SEO mutation. */
export async function activateAdminLanguageLocalization(
  languageId: string,
): Promise<LanguageActivationAdminView> {
  return apiRequest<LanguageActivationAdminView>(
    `${ADMIN_LANGUAGES_PATH}/${encodeURIComponent(languageId)}/activate-localization`,
    { method: "POST" },
  );
}

/** Refresh durable activation job + measured readiness. */
export async function fetchAdminLanguageActivationStatus(
  languageId: string,
): Promise<LanguageActivationAdminView> {
  return apiRequest<LanguageActivationAdminView>(
    `${ADMIN_LANGUAGES_PATH}/${encodeURIComponent(languageId)}/activation-status`,
  );
}

export async function createAdminLanguage(
  input: AdminLanguageCreateInput,
): Promise<LanguageRegistryAdmin> {
  const created = await apiRequest<LanguageRegistryAdmin>(ADMIN_LANGUAGES_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  invalidatePublicLanguagesClientCache();
  return created;
}

export async function updateAdminLanguage(
  languageId: string,
  input: AdminLanguagePatchInput,
): Promise<LanguageRegistryAdmin> {
  const updated = await apiRequest<LanguageRegistryAdmin>(
    `${ADMIN_LANGUAGES_PATH}/${encodeURIComponent(languageId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  invalidatePublicLanguagesClientCache();
  return updated;
}
