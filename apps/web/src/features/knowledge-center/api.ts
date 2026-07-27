import type { KnowledgeArticlePublic, KnowledgeCenterListing } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function fetchKnowledgeListing(): Promise<KnowledgeCenterListing> {
  return apiRequest<KnowledgeCenterListing>("/api/v1/public/knowledge");
}

export async function fetchKnowledgeArticle(slug: string): Promise<KnowledgeArticlePublic> {
  return apiRequest<KnowledgeArticlePublic>(`/api/v1/public/knowledge/${encodeURIComponent(slug)}`);
}

export async function searchKnowledgeArticles(input: {
  q: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  params.set("entityType", "knowledge_article");
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
