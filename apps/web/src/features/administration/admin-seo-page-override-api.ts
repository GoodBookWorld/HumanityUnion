import type {
  SeoPageOverrideFamily,
  SeoPageOverrideFields,
  SeoPageOverridePublicView,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchAdminSeoPageOverride(input: {
  family: SeoPageOverrideFamily;
  entityKey: string;
}): Promise<SeoPageOverridePublicView> {
  return apiRequest<SeoPageOverridePublicView>(
    `/api/v1/admin/seo/page-overrides/${encodeURIComponent(input.family)}/${encodeURIComponent(input.entityKey)}`,
  );
}

export async function listAdminSeoPageOverrideIds(input?: {
  family?: SeoPageOverrideFamily;
}): Promise<{ pageIds: string[] }> {
  const params = new URLSearchParams();
  if (input?.family) {
    params.set("family", input.family);
  }
  const suffix = params.toString();
  return apiRequest<{ pageIds: string[] }>(
    `/api/v1/admin/seo/page-overrides${suffix ? `?${suffix}` : ""}`,
  );
}

export async function saveAdminSeoPageOverride(input: {
  family: SeoPageOverrideFamily;
  entityKey: string;
  canonicalPath: string;
  fields: SeoPageOverrideFields;
}): Promise<SeoPageOverridePublicView> {
  return apiRequest<SeoPageOverridePublicView>(
    `/api/v1/admin/seo/page-overrides/${encodeURIComponent(input.family)}/${encodeURIComponent(input.entityKey)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canonicalPath: input.canonicalPath,
        fields: input.fields,
      }),
    },
  );
}

export async function clearAdminSeoPageOverride(input: {
  family: SeoPageOverrideFamily;
  entityKey: string;
}): Promise<SeoPageOverridePublicView> {
  return apiRequest<SeoPageOverridePublicView>(
    `/api/v1/admin/seo/page-overrides/${encodeURIComponent(input.family)}/${encodeURIComponent(input.entityKey)}`,
    { method: "DELETE" },
  );
}
