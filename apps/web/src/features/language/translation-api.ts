import type {
  ContentTranslationSourceKind,
  LanguageCode,
  ResolvedTranslatedDisplay,
  TranslateDraftResult,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface PriorityLanguageOption {
  readonly code: LanguageCode;
  readonly englishName: string;
  readonly nativeName: string;
  readonly rtl: boolean;
}

export async function listPriorityLanguages(): Promise<readonly PriorityLanguageOption[]> {
  return apiRequest<readonly PriorityLanguageOption[]>("/api/v1/translations/languages");
}

export async function resolveTranslatedContent(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  language?: LanguageCode;
}): Promise<ResolvedTranslatedDisplay<Record<string, string>>> {
  const params = new URLSearchParams();
  if (input.language) {
    params.set("language", input.language);
  }
  const query = params.toString();
  return apiRequest<ResolvedTranslatedDisplay<Record<string, string>>>(
    `/api/v1/translations/resolve/${input.sourceKind}/${encodeURIComponent(input.sourceRecordId)}${
      query ? `?${query}` : ""
    }`,
  );
}

export async function generateContentTranslation(input: {
  sourceKind: ContentTranslationSourceKind;
  sourceRecordId: string;
  targetLanguage: LanguageCode;
}): Promise<{
  generated: boolean;
  display: ResolvedTranslatedDisplay<Record<string, string>>;
}> {
  return apiRequest("/api/v1/translations/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestTranslateDraft(input: {
  sourceKind?: ContentTranslationSourceKind;
  sourceRecordId: string;
  sourceVersion: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  draftContent: Record<string, unknown> | string;
  initiativeId?: string;
}): Promise<TranslateDraftResult> {
  return apiRequest<TranslateDraftResult>("/api/v1/translations/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
