import type { AdminAuditBrowserResponse, AdminAuditCategory } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface ListAdminAuditParams {
  q?: string;
  action?: string;
  category?: AdminAuditCategory | "";
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function listAdminAudit(
  params: ListAdminAuditParams = {},
): Promise<AdminAuditBrowserResponse> {
  const search = new URLSearchParams();
  if (params.q?.trim()) {
    search.set("q", params.q.trim());
  }
  if (params.action?.trim()) {
    search.set("action", params.action.trim());
  }
  if (params.category) {
    search.set("category", params.category);
  }
  if (params.actorId?.trim()) {
    search.set("actorId", params.actorId.trim());
  }
  if (params.from?.trim()) {
    search.set("from", params.from.trim());
  }
  if (params.to?.trim()) {
    search.set("to", params.to.trim());
  }
  if (params.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    search.set("offset", String(params.offset));
  }
  const query = search.toString();
  return apiRequest<AdminAuditBrowserResponse>(
    `/api/v1/admin/audit${query ? `?${query}` : ""}`,
  );
}
