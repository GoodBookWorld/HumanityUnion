import type {
  LanguageActivationAdminView,
  LanguageLocalizationReadinessReport,
  LanguageRegistryAdmin,
  LanguageRegistryAdminListResponse,
  LanguageTextDirection,
  LanguageUiTranslationStatus,
  LanguageWebUiReadinessSlice,
  WebUiMessagePackAddMissingPreview,
  WebUiMessagePackAddMissingResult,
  WebUiMessagePackPreparation,
  WebUiMessagePackRecord,
  WebUiMessagePackValidationReport,
  WebUiMessageTree,
} from "@hu/types";

import { ApiRequestError, apiRequest } from "../../lib/api-client";
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

const ADMIN_WEB_UI_PACKS_PATH = "/api/v1/admin/web-ui-message-packs";

export async function fetchAdminWebUiMessagePackPreparation(
  locale: string,
  scope: "public" | "full",
): Promise<WebUiMessagePackPreparation> {
  return apiRequest<WebUiMessagePackPreparation>(
    `${ADMIN_WEB_UI_PACKS_PATH}/${encodeURIComponent(locale)}/preparation?scope=${scope}`,
  );
}

/**
 * Resolve the optimistic-concurrency token for an Admin pack import.
 * - Existing pack → current revision
 * - Missing pack (404) → null (create-only)
 */
export async function resolveAdminWebUiMessagePackExpectedRevision(
  locale: string,
): Promise<number | null> {
  try {
    const result = await apiRequest<{
      readonly pack: WebUiMessagePackRecord;
    }>(`${ADMIN_WEB_UI_PACKS_PATH}/${encodeURIComponent(locale)}`);
    return result.pack.revision;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function formatWebUiPackRevisionConflictMessage(serverMessage?: string): string {
  const detail = serverMessage?.trim();
  return (
    (detail && detail.length > 0 ? `${detail} ` : "") +
    "The catalog pack was changed by another administrator. Refresh the current pack data, then import again. The previous import was not saved."
  );
}

export async function importAdminWebUiMessagePack(
  locale: string,
  input: {
    readonly messages: WebUiMessageTree;
    readonly status: "draft" | "published";
    readonly sourceNote?: string | null;
    readonly expectedRevision: number | null;
  },
): Promise<{
  readonly pack: WebUiMessagePackRecord;
  readonly validation: WebUiMessagePackValidationReport;
  readonly readiness: LanguageWebUiReadinessSlice;
}> {
  return apiRequest(
    `${ADMIN_WEB_UI_PACKS_PATH}/${encodeURIComponent(locale)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        messages: input.messages,
        status: input.status,
        sourceNote: input.sourceNote ?? null,
        expectedRevision: input.expectedRevision,
      }),
    },
  );
}

export async function previewAdminAddMissingWebUiFromPackaged(
  locale: string,
): Promise<WebUiMessagePackAddMissingPreview> {
  return apiRequest<WebUiMessagePackAddMissingPreview>(
    `${ADMIN_WEB_UI_PACKS_PATH}/${encodeURIComponent(locale)}/add-missing-from-packaged`,
  );
}

export async function applyAdminAddMissingWebUiFromPackaged(
  locale: string,
  input: { readonly expectedRevision: number | null },
): Promise<WebUiMessagePackAddMissingResult> {
  return apiRequest<WebUiMessagePackAddMissingResult>(
    `${ADMIN_WEB_UI_PACKS_PATH}/${encodeURIComponent(locale)}/add-missing-from-packaged`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedRevision: input.expectedRevision,
      }),
    },
  );
}

export function formatAddMissingWebUiPreviewMessage(
  preview: WebUiMessagePackAddMissingPreview,
): string {
  if (!preview.packagedCatalogExists) {
    return (
      `No packaged WEB_UI catalog is available for ${preview.locale} in this build. ` +
      `Current pack revision: ${preview.currentRevision ?? "none"}. ` +
      `Existing keys: ${preview.existingKeyCount}.`
    );
  }
  return (
    `Add missing translations for ${preview.locale}. ` +
    `Current revision: ${preview.currentRevision ?? "none (create)"}. ` +
    `Existing keys: ${preview.existingKeyCount}. ` +
    `Missing keys: ${preview.missingKeyCount}. ` +
    `Expected final keys: ${preview.expectedFinalCount}. ` +
    `Existing translation values will be preserved.`
  );
}
