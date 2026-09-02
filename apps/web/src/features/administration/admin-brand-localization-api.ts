import type {
  BrandLocalizationAdminListResponse,
  BrandLocalizationRecord,
  BrandLocalizationStatus,
  BrandLocalizationUpdateInput,
  BrandLocalizationUpsertInput,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

const ADMIN_BRAND_LOCALIZATION_PATH = "/api/v1/admin/brand-localization";

export type AdminBrandLocalizationUpsertInput = BrandLocalizationUpsertInput;
export type AdminBrandLocalizationPatchInput = BrandLocalizationUpdateInput;

export async function fetchAdminBrandLocalizations(): Promise<BrandLocalizationAdminListResponse> {
  return apiRequest<BrandLocalizationAdminListResponse>(ADMIN_BRAND_LOCALIZATION_PATH);
}

export async function fetchAdminBrandLocalization(
  locale: string,
): Promise<BrandLocalizationRecord> {
  return apiRequest<BrandLocalizationRecord>(
    `${ADMIN_BRAND_LOCALIZATION_PATH}/${encodeURIComponent(locale)}`,
  );
}

export async function upsertAdminBrandLocalization(
  input: AdminBrandLocalizationUpsertInput,
): Promise<BrandLocalizationRecord> {
  return apiRequest<BrandLocalizationRecord>(ADMIN_BRAND_LOCALIZATION_PATH, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateAdminBrandLocalization(
  locale: string,
  input: AdminBrandLocalizationPatchInput,
): Promise<BrandLocalizationRecord> {
  return apiRequest<BrandLocalizationRecord>(
    `${ADMIN_BRAND_LOCALIZATION_PATH}/${encodeURIComponent(locale)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function publishAdminBrandLocalization(
  locale: string,
): Promise<BrandLocalizationRecord> {
  return apiRequest<BrandLocalizationRecord>(
    `${ADMIN_BRAND_LOCALIZATION_PATH}/${encodeURIComponent(locale)}/publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

export type { BrandLocalizationStatus };
