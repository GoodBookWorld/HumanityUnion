import type {
  LegalDocumentType,
  LegalLocalizationAdminListResponse,
  LegalLocalizationRecord,
  LegalLocalizationStatus,
  LegalLocalizationUpdateInput,
  LegalLocalizationUpsertInput,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

const ADMIN_LEGAL_LOCALIZATION_PATH = "/api/v1/admin/legal-localization";

export type AdminLegalLocalizationUpsertInput = LegalLocalizationUpsertInput;
export type AdminLegalLocalizationPatchInput = LegalLocalizationUpdateInput;

export async function fetchAdminLegalLocalizations(): Promise<LegalLocalizationAdminListResponse> {
  return apiRequest<LegalLocalizationAdminListResponse>(ADMIN_LEGAL_LOCALIZATION_PATH);
}

export async function fetchAdminLegalLocalization(
  documentType: LegalDocumentType,
  locale: string,
): Promise<LegalLocalizationRecord> {
  return apiRequest<LegalLocalizationRecord>(
    `${ADMIN_LEGAL_LOCALIZATION_PATH}/${encodeURIComponent(documentType)}/${encodeURIComponent(locale)}`,
  );
}

export async function upsertAdminLegalLocalization(
  input: AdminLegalLocalizationUpsertInput,
): Promise<LegalLocalizationRecord> {
  return apiRequest<LegalLocalizationRecord>(ADMIN_LEGAL_LOCALIZATION_PATH, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateAdminLegalLocalization(
  documentType: LegalDocumentType,
  locale: string,
  input: AdminLegalLocalizationPatchInput,
): Promise<LegalLocalizationRecord> {
  return apiRequest<LegalLocalizationRecord>(
    `${ADMIN_LEGAL_LOCALIZATION_PATH}/${encodeURIComponent(documentType)}/${encodeURIComponent(locale)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishAdminLegalLocalization(
  documentType: LegalDocumentType,
  locale: string,
): Promise<LegalLocalizationRecord> {
  return apiRequest<LegalLocalizationRecord>(
    `${ADMIN_LEGAL_LOCALIZATION_PATH}/${encodeURIComponent(documentType)}/${encodeURIComponent(locale)}/publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

export type { LegalLocalizationStatus };
