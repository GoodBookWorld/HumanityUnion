import type { PublicNewsArticleItem, PublicNewsListingResponse } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface FetchPublicNewsOptions {
  limit?: number;
  language?: string;
  category?: string;
  source?: string;
}

export async function fetchPublicNewsArticles(
  options: FetchPublicNewsOptions = {},
): Promise<PublicNewsListingResponse> {
  const params = new URLSearchParams();

  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  if (options.language) {
    params.set("language", options.language);
  }

  if (options.category) {
    params.set("category", options.category);
  }

  if (options.source) {
    params.set("source", options.source);
  }

  const query = params.toString();
  const path = query ? `/api/v1/public/news?${query}` : "/api/v1/public/news";

  return apiRequest<PublicNewsListingResponse>(path);
}

export async function fetchPublicNewsArticleById(id: string): Promise<PublicNewsArticleItem> {
  return apiRequest<PublicNewsArticleItem>(`/api/v1/public/news/${encodeURIComponent(id)}`);
}

export function buildCreateInitiativeFromNewsHref(newsId: string): string {
  const params = new URLSearchParams({
    source: "news",
    newsId,
  });

  return `/initiatives/create?${params.toString()}`;
}

export function buildRegisterCreateInitiativeFromNewsHref(newsId: string): string {
  const returnTo = encodeURIComponent(buildCreateInitiativeFromNewsHref(newsId));
  return `/register?returnTo=${returnTo}`;
}

export function formatNewsPublishedDate(isoDate: string): string {
  const parsed = Date.parse(isoDate);

  if (Number.isNaN(parsed)) {
    return isoDate;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(parsed));
}
