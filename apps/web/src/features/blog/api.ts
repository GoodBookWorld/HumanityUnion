import type {
  BlogCategory,
  PublicBlogPostDetail,
  PublicBlogPostListResponse,
} from "@hu/types";

import { apiRequest, apiRequestOptional } from "../../lib/api-client";

export const BLOG_PAGE_SIZE = 12;

export interface FetchPublicBlogPostsOptions {
  q?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
  /** Launch Readiness Pack 06 — abort stale Blog list/search navigations. */
  signal?: AbortSignal;
}

export async function fetchPublicBlogCategories(): Promise<readonly BlogCategory[]> {
  const data = await apiRequest<{ categories: BlogCategory[] }>("/api/v1/public/blog/categories");
  return data.categories;
}

export async function fetchPublicBlogPosts(
  options: FetchPublicBlogPostsOptions = {},
): Promise<PublicBlogPostListResponse> {
  const params = new URLSearchParams();
  const limit = options.limit ?? BLOG_PAGE_SIZE;
  params.set("limit", String(limit));
  params.set("offset", String(options.offset ?? 0));

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  if (options.categoryId?.trim()) {
    params.set("categoryId", options.categoryId.trim());
  }

  return apiRequest<PublicBlogPostListResponse>(
    `/api/v1/public/blog?${params.toString()}`,
    options.signal ? { signal: options.signal } : undefined,
  );
}

export async function fetchPublicBlogPostBySlug(slug: string): Promise<PublicBlogPostDetail> {
  return apiRequest<PublicBlogPostDetail>(`/api/v1/public/blog/${encodeURIComponent(slug)}`);
}

export async function fetchPublicBlogPostBySlugOptional(
  slug: string,
): Promise<PublicBlogPostDetail | null> {
  return apiRequestOptional<PublicBlogPostDetail>(
    `/api/v1/public/blog/${encodeURIComponent(slug)}`,
  );
}

export function formatBlogPublishedDate(isoDate: string): string {
  const parsed = Date.parse(isoDate);

  if (Number.isNaN(parsed)) {
    return isoDate;
  }

  // Deterministic locale avoids SSR/client hydration mismatches until
  // Language Architecture supplies a Participant-facing date locale.
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(parsed));
}
