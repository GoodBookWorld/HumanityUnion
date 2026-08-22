import type {
  AdminInitiativeBlockCommandResult,
  AdminPublicChoiceDetail,
  AdminPublicChoiceDirectoryResponse,
  PublicChoiceCandidatePublicProjection,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface ListAdminPublicChoiceQuery {
  search?: string;
  blocked?: "blocked" | "unblocked" | "";
  sort?: "updatedAt" | "createdAt" | "title";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export async function listAdminPublicChoiceElections(
  query: ListAdminPublicChoiceQuery = {},
): Promise<AdminPublicChoiceDirectoryResponse> {
  const params = new URLSearchParams();
  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }
  if (query.blocked) {
    params.set("blocked", query.blocked);
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
  return apiRequest<AdminPublicChoiceDirectoryResponse>(
    `/api/v1/admin/public-choice${suffix ? `?${suffix}` : ""}`,
  );
}

export async function getAdminPublicChoiceDetail(
  initiativeId: string,
): Promise<AdminPublicChoiceDetail> {
  return apiRequest<AdminPublicChoiceDetail>(
    `/api/v1/admin/public-choice/${encodeURIComponent(initiativeId)}`,
  );
}

export async function blockAdminInitiative(input: {
  initiativeId: string;
  reason?: string;
}): Promise<AdminInitiativeBlockCommandResult> {
  return apiRequest<AdminInitiativeBlockCommandResult>(
    `/api/v1/admin/initiatives/${encodeURIComponent(input.initiativeId)}/block`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason }),
    },
  );
}

export async function unblockAdminInitiative(input: {
  initiativeId: string;
  reason?: string;
}): Promise<AdminInitiativeBlockCommandResult> {
  return apiRequest<AdminInitiativeBlockCommandResult>(
    `/api/v1/admin/initiatives/${encodeURIComponent(input.initiativeId)}/unblock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason }),
    },
  );
}

export async function blockAdminPublicChoiceElection(input: {
  initiativeId: string;
  reason?: string;
}): Promise<AdminInitiativeBlockCommandResult> {
  return apiRequest<AdminInitiativeBlockCommandResult>(
    `/api/v1/admin/public-choice/${encodeURIComponent(input.initiativeId)}/block`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason }),
    },
  );
}

export async function unblockAdminPublicChoiceElection(input: {
  initiativeId: string;
  reason?: string;
}): Promise<AdminInitiativeBlockCommandResult> {
  return apiRequest<AdminInitiativeBlockCommandResult>(
    `/api/v1/admin/public-choice/${encodeURIComponent(input.initiativeId)}/unblock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason }),
    },
  );
}

export async function blockAdminPublicChoiceCandidate(input: {
  initiativeId: string;
  candidateId: string;
  reason?: string;
}): Promise<PublicChoiceCandidatePublicProjection> {
  return apiRequest<PublicChoiceCandidatePublicProjection>(
    `/api/v1/admin/public-choice/${encodeURIComponent(input.initiativeId)}/candidates/${encodeURIComponent(input.candidateId)}/block`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason }),
    },
  );
}

export async function unblockAdminPublicChoiceCandidate(input: {
  initiativeId: string;
  candidateId: string;
}): Promise<PublicChoiceCandidatePublicProjection> {
  return apiRequest<PublicChoiceCandidatePublicProjection>(
    `/api/v1/admin/public-choice/${encodeURIComponent(input.initiativeId)}/candidates/${encodeURIComponent(input.candidateId)}/unblock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

export async function updateAdminPublicChoiceCandidate(input: {
  initiativeId: string;
  candidateId: string;
  name?: string;
  photoUrl?: string | null;
  campaignPageUrl?: string | null;
}): Promise<PublicChoiceCandidatePublicProjection> {
  return apiRequest<PublicChoiceCandidatePublicProjection>(
    `/api/v1/admin/public-choice/${encodeURIComponent(input.initiativeId)}/candidates/${encodeURIComponent(input.candidateId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        photoUrl: input.photoUrl,
        campaignPageUrl: input.campaignPageUrl,
      }),
    },
  );
}
