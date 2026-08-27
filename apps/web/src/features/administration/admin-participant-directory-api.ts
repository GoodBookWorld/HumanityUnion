import type { AdminParticipantDirectoryResponse, AdminParticipantPublicProfileResolve } from "@hu/types";

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

/** Pack 24A — Admin resolver path (stable memberId; never embeds publicName). */
export function adminParticipantPublicProfilePath(participantId: string): string {
  return `/admin/participants/${encodeURIComponent(participantId)}/public-profile`;
}

/**
 * Pack 24A — resolve CURRENT canonical `/member/{publicName}` via Admin API.
 * Does not trust directory-row uniqueName / stale slugs.
 */
export async function resolveAdminParticipantPublicProfile(
  participantId: string,
): Promise<AdminParticipantPublicProfileResolve> {
  return apiRequest<AdminParticipantPublicProfileResolve>(
    `/api/v1/admin/participants/${encodeURIComponent(participantId)}/public-profile`,
  );
}
