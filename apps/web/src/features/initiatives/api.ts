import type { Initiative, PublicInitiativeProjection } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface CreateInitiativeDraftInput {
  title: string;
  description: string;
  communitySlug: string;
  activityArea: string;
}

export interface SaveInitiativeDraftInput {
  title?: string;
  description?: string;
  communitySlug?: string;
  activityArea?: string;
}

export const INITIATIVE_COMMUNITY_OPTIONS = [
  {
    slug: "nelson-community-garden",
    label: "Nelson Community Garden",
  },
  {
    slug: "kootenay-lake-protection-society",
    label: "Kootenay Lake Protection Society",
  },
] as const;

export async function listInitiatives(): Promise<Initiative[]> {
  return apiRequest<Initiative[]>("/api/v1/initiatives");
}

export async function listMyInitiatives(): Promise<Initiative[]> {
  return apiRequest<Initiative[]>("/api/v1/initiatives/mine");
}

export async function getInitiativeById(initiativeId: string): Promise<Initiative> {
  return apiRequest<Initiative>(`/api/v1/initiatives/${encodeURIComponent(initiativeId)}`);
}

export async function getPublicInitiative(
  initiativeId: string,
): Promise<PublicInitiativeProjection> {
  return apiRequest<PublicInitiativeProjection>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}`,
  );
}

export async function createInitiativeDraft(
  input: CreateInitiativeDraftInput,
): Promise<Initiative> {
  return apiRequest<Initiative>("/api/v1/initiatives/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function saveInitiativeDraft(
  initiativeId: string,
  input: SaveInitiativeDraftInput,
): Promise<Initiative> {
  return apiRequest<Initiative>(`/api/v1/initiatives/${encodeURIComponent(initiativeId)}/draft`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function updatePublishedInitiative(
  initiativeId: string,
  input: SaveInitiativeDraftInput,
): Promise<Initiative> {
  return apiRequest<Initiative>(
    `/api/v1/initiatives/${encodeURIComponent(initiativeId)}/published`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiative(initiativeId: string): Promise<Initiative> {
  return apiRequest<Initiative>(`/api/v1/initiatives/${encodeURIComponent(initiativeId)}/publish`, {
    method: "POST",
  });
}

export async function republishInitiative(
  initiativeId: string,
  input: SaveInitiativeDraftInput = {},
): Promise<Initiative> {
  return apiRequest<Initiative>(
    `/api/v1/initiatives/${encodeURIComponent(initiativeId)}/republish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function archiveInitiative(initiativeId: string): Promise<Initiative> {
  return apiRequest<Initiative>(`/api/v1/initiatives/${encodeURIComponent(initiativeId)}/archive`, {
    method: "POST",
  });
}

/** @deprecated Use createInitiativeDraft for the lifecycle workflow. */
export async function createInitiative(initiative: Initiative): Promise<Initiative> {
  return apiRequest<Initiative>("/api/v1/initiatives", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(initiative),
  });
}
