import type {
  MediaResource,
  MediaResourceScopeType,
  MediaResourceType,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface ListAdminMediaResourcesQuery {
  resourceType?: MediaResourceType | "";
  scopeType?: MediaResourceScopeType | "";
  countryCode?: string;
  active?: "true" | "false" | "";
}

export interface AdminMediaResourceWriteInput {
  resourceType: MediaResourceType;
  scopeType: MediaResourceScopeType;
  countryCode?: string | null;
  name: string;
  logoLabel: string;
  logoUrl?: string | null;
  websiteUrl: string;
  rssUrl?: string | null;
  categoryId?: string | null;
  description?: string | null;
  secondaryText?: string | null;
  language?: string | null;
  providerId?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export async function listAdminMediaResources(
  query: ListAdminMediaResourcesQuery = {},
): Promise<MediaResource[]> {
  const params = new URLSearchParams();
  if (query.resourceType) {
    params.set("resourceType", query.resourceType);
  }
  if (query.scopeType) {
    params.set("scopeType", query.scopeType);
  }
  if (query.countryCode?.trim()) {
    params.set("countryCode", query.countryCode.trim());
  }
  if (query.active === "true" || query.active === "false") {
    params.set("active", query.active);
  }
  const suffix = params.toString();
  return apiRequest<MediaResource[]>(
    `/api/v1/admin/media-resources${suffix ? `?${suffix}` : ""}`,
  );
}

export async function getAdminMediaResource(id: string): Promise<MediaResource> {
  return apiRequest<MediaResource>(`/api/v1/admin/media-resources/${encodeURIComponent(id)}`);
}

export async function createAdminMediaResource(
  input: AdminMediaResourceWriteInput,
): Promise<MediaResource> {
  return apiRequest<MediaResource>("/api/v1/admin/media-resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateAdminMediaResource(
  id: string,
  input: Partial<Omit<AdminMediaResourceWriteInput, "resourceType">>,
): Promise<MediaResource> {
  return apiRequest<MediaResource>(`/api/v1/admin/media-resources/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function activateAdminMediaResource(id: string): Promise<MediaResource> {
  return apiRequest<MediaResource>(
    `/api/v1/admin/media-resources/${encodeURIComponent(id)}/activate`,
    { method: "POST" },
  );
}

export async function deactivateAdminMediaResource(id: string): Promise<MediaResource> {
  return apiRequest<MediaResource>(
    `/api/v1/admin/media-resources/${encodeURIComponent(id)}/deactivate`,
    { method: "POST" },
  );
}

export async function deleteAdminMediaResource(
  id: string,
  options: { hard?: boolean } = {},
): Promise<MediaResource | { id: string; deleted: true }> {
  const suffix = options.hard ? "?hard=true" : "";
  return apiRequest(
    `/api/v1/admin/media-resources/${encodeURIComponent(id)}${suffix}`,
    { method: "DELETE" },
  );
}
