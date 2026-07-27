import type { CivicMediaCategoriesListing, CivicMediaCenterPublic } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchCivicMediaCenter(): Promise<CivicMediaCenterPublic> {
  return apiRequest<CivicMediaCenterPublic>("/api/v1/public/knowledge/media");
}

export async function fetchCivicMediaCategories(): Promise<CivicMediaCategoriesListing> {
  return apiRequest<CivicMediaCategoriesListing>("/api/v1/public/knowledge/media/categories");
}

export function buildCreateInitiativeHref(input: {
  headline: string;
  source: string;
  originalUrl: string;
}): string {
  const params = new URLSearchParams();
  params.set("mediaHeadline", input.headline);
  params.set("mediaSource", input.source);
  params.set("mediaUrl", input.originalUrl);

  return `/initiatives?${params.toString()}`;
}

export async function searchKnowledgeMedia(input: { q: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  params.set("entityType", "knowledge_media");
  params.set("q", input.q);

  if (input.limit !== undefined) {
    params.set("limit", String(input.limit));
  }

  if (input.offset !== undefined) {
    params.set("offset", String(input.offset));
  }

  return apiRequest<{
    results: Array<{
      entityId: string;
      title: string;
      summary: string;
      publicUrl: string;
      updatedAt: string;
    }>;
    total: number;
  }>(`/api/v1/public/search?${params.toString()}`);
}
