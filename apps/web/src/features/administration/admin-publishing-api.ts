import type {
  AdminAuthorDirectoryResponse,
  AdminAuthorDirectoryStatusFilter,
  AdminPublicationDirectoryResponse,
  AdminPublicationDirectoryStatusFilter,
  AdminPublishingBlockCommandResult,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function listAdminPublishingAuthors(query: {
  status?: AdminAuthorDirectoryStatusFilter;
  q?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminAuthorDirectoryResponse> {
  const params = new URLSearchParams();
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return apiRequest<AdminAuthorDirectoryResponse>(
    `/api/v1/admin/publishing/authors${suffix ? `?${suffix}` : ""}`,
  );
}

export async function blockAdminPublishingAuthor(
  participantId: string,
  reason?: string,
): Promise<AdminPublishingBlockCommandResult> {
  return apiRequest<AdminPublishingBlockCommandResult>(
    `/api/v1/admin/publishing/authors/${encodeURIComponent(participantId)}/block`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export async function unblockAdminPublishingAuthor(
  participantId: string,
  reason?: string,
): Promise<AdminPublishingBlockCommandResult> {
  return apiRequest<AdminPublishingBlockCommandResult>(
    `/api/v1/admin/publishing/authors/${encodeURIComponent(participantId)}/unblock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export async function listAdminPublishingPublications(query: {
  status?: AdminPublicationDirectoryStatusFilter;
  q?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminPublicationDirectoryResponse> {
  const params = new URLSearchParams();
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }
  const suffix = params.toString();
  return apiRequest<AdminPublicationDirectoryResponse>(
    `/api/v1/admin/publishing/publications${suffix ? `?${suffix}` : ""}`,
  );
}

export async function blockAdminPublishingPublication(
  postId: string,
  reason?: string,
): Promise<AdminPublishingBlockCommandResult> {
  return apiRequest<AdminPublishingBlockCommandResult>(
    `/api/v1/admin/publishing/publications/${encodeURIComponent(postId)}/block`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export async function unblockAdminPublishingPublication(
  postId: string,
  reason?: string,
): Promise<AdminPublishingBlockCommandResult> {
  return apiRequest<AdminPublishingBlockCommandResult>(
    `/api/v1/admin/publishing/publications/${encodeURIComponent(postId)}/unblock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}
