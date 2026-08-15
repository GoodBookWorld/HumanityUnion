import type { AdminParticipantDirectoryResponse } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface ListAdminParticipantsQuery {
  search?: string;
  status?: "active" | "disabled";
  role?: "member" | "admin";
  membershipStatus?: string;
  sort?: "createdAt" | "lastLoginAt" | "email";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export async function listAdminParticipants(
  query: ListAdminParticipantsQuery = {},
): Promise<AdminParticipantDirectoryResponse> {
  const params = new URLSearchParams();

  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.role) {
    params.set("role", query.role);
  }
  if (query.membershipStatus) {
    params.set("membershipStatus", query.membershipStatus);
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
  return apiRequest<AdminParticipantDirectoryResponse>(
    `/api/v1/admin/participants${suffix ? `?${suffix}` : ""}`,
  );
}
