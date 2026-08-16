import type {
  AdminInitiativeDetail,
  AdminInitiativeDirectoryResponse,
  AdminInitiativeVisibilityCommandResult,
  InitiativeLifecyclePhase,
  InitiativeStatus,
  InitiativeVisibilityPolicy,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface ListAdminInitiativesQuery {
  search?: string;
  lifecyclePhase?: InitiativeLifecyclePhase;
  status?: InitiativeStatus;
  visibility?: InitiativeVisibilityPolicy;
  geography?: string;
  steward?: string;
  sort?: "updatedAt" | "createdAt" | "title";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export async function listAdminInitiatives(
  query: ListAdminInitiativesQuery = {},
): Promise<AdminInitiativeDirectoryResponse> {
  const params = new URLSearchParams();

  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }
  if (query.lifecyclePhase) {
    params.set("lifecyclePhase", query.lifecyclePhase);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.visibility) {
    params.set("visibility", query.visibility);
  }
  if (query.geography?.trim()) {
    params.set("geography", query.geography.trim());
  }
  if (query.steward?.trim()) {
    params.set("steward", query.steward.trim());
  }
  if (query.sort) {
    params.set("sort", query.sort);
  }
  if (query.order) {
    params.set("order", query.order);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }

  const suffix = params.toString();
  return apiRequest<AdminInitiativeDirectoryResponse>(
    `/api/v1/admin/initiatives${suffix ? `?${suffix}` : ""}`,
  );
}

export async function getAdminInitiativeDetail(
  initiativeId: string,
): Promise<AdminInitiativeDetail> {
  return apiRequest<AdminInitiativeDetail>(
    `/api/v1/admin/initiatives/${encodeURIComponent(initiativeId)}`,
  );
}

export async function hideAdminInitiativeFromPublic(input: {
  initiativeId: string;
  reason: string;
}): Promise<AdminInitiativeVisibilityCommandResult> {
  return apiRequest<AdminInitiativeVisibilityCommandResult>(
    `/api/v1/admin/initiatives/${encodeURIComponent(input.initiativeId)}/visibility/hide`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason }),
    },
  );
}

export async function restoreAdminInitiativePublicVisibility(input: {
  initiativeId: string;
  reason: string;
}): Promise<AdminInitiativeVisibilityCommandResult> {
  return apiRequest<AdminInitiativeVisibilityCommandResult>(
    `/api/v1/admin/initiatives/${encodeURIComponent(input.initiativeId)}/visibility/restore`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason }),
    },
  );
}
