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

function withResourceType(path: string, resourceType: MediaResourceType): string {
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}resourceType=${encodeURIComponent(resourceType)}`;
}

export async function getAdminMediaResource(
  id: string,
  resourceType: MediaResourceType,
): Promise<MediaResource> {
  return apiRequest<MediaResource>(
    withResourceType(`/api/v1/admin/media-resources/${encodeURIComponent(id)}`, resourceType),
  );
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
  resourceType: MediaResourceType,
  input: Partial<Omit<AdminMediaResourceWriteInput, "resourceType">>,
): Promise<MediaResource> {
  return apiRequest<MediaResource>(
    withResourceType(`/api/v1/admin/media-resources/${encodeURIComponent(id)}`, resourceType),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function activateAdminMediaResource(
  id: string,
  resourceType: MediaResourceType,
): Promise<MediaResource> {
  return apiRequest<MediaResource>(
    withResourceType(
      `/api/v1/admin/media-resources/${encodeURIComponent(id)}/activate`,
      resourceType,
    ),
    { method: "POST" },
  );
}

export async function deactivateAdminMediaResource(
  id: string,
  resourceType: MediaResourceType,
): Promise<MediaResource> {
  return apiRequest<MediaResource>(
    withResourceType(
      `/api/v1/admin/media-resources/${encodeURIComponent(id)}/deactivate`,
      resourceType,
    ),
    { method: "POST" },
  );
}

export async function deleteAdminMediaResource(
  id: string,
  resourceType: MediaResourceType,
  options: { hard?: boolean } = {},
): Promise<MediaResource | { id: string; deleted: true }> {
  const suffix = options.hard ? "?hard=true" : "";
  return apiRequest(
    withResourceType(
      `/api/v1/admin/media-resources/${encodeURIComponent(id)}${suffix}`,
      resourceType,
    ),
    { method: "DELETE" },
  );
}
