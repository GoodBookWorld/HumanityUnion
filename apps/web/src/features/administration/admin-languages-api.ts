import type {
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
  readonly aliases?: readonly string[];
}

export async function fetchAdminLanguages(): Promise<LanguageRegistryAdminListResponse> {
  return apiRequest<LanguageRegistryAdminListResponse>(ADMIN_LANGUAGES_PATH);
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
