import type {
  BlogCategory,
  PublicBlogAuthorDirectoryResponse,
  PublicBlogPostDetail,
  PublicBlogPostListResponse,
} from "@hu/types";

import { apiRequest, apiRequestOptional } from "../../lib/api-client";

/** Pack 14D — center feed page size. */
export const BLOG_PAGE_SIZE = 9;

export interface FetchPublicBlogPostsOptions {
  q?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  includeDiscovery?: boolean;
  /** Launch Readiness Pack 06 — abort stale Blog list/search navigations. */
  signal?: AbortSignal;
}

export async function fetchPublicBlogCategories(): Promise<readonly BlogCategory[]> {
  const data = await apiRequest<{ categories: BlogCategory[] }>("/api/v1/public/blog/categories");
  return data.categories;
}

/** Pack 13D — Authors rail (authors with at least one visible public publication). */
export async function fetchPublicBlogAuthors(input?: {
  limit?: number;
  signal?: AbortSignal;
}): Promise<PublicBlogAuthorDirectoryResponse> {
  const params = new URLSearchParams();
  if (input?.limit !== undefined) {
    params.set("limit", String(input.limit));
  }
  const query = params.toString();
  return apiRequest<PublicBlogAuthorDirectoryResponse>(
    `/api/v1/public/blog/authors${query ? `?${query}` : ""}`,
    input?.signal ? { signal: input.signal } : undefined,
  );
}

export async function fetchPublicBlogPosts(
  options: FetchPublicBlogPostsOptions = {},
): Promise<PublicBlogPostListResponse> {
  const params = new URLSearchParams();
  const pageSize = options.pageSize ?? options.limit ?? BLOG_PAGE_SIZE;
  params.set("pageSize", String(pageSize));

  if (options.page !== undefined) {
    params.set("page", String(options.page));
  } else {
    params.set("offset", String(options.offset ?? 0));
  }

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  if (options.categoryId?.trim()) {
    params.set("categoryId", options.categoryId.trim());
  }

  if (options.includeDiscovery === false) {
    params.set("includeDiscovery", "0");
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
  // UTC keeps noon-UTC publication dates on the intended calendar day.
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
}
