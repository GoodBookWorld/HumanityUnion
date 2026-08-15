import type { BlogCategory } from "@hu/types";

/**
 * Blog index URL state (Pack 03):
 * `/blog?q=...&category=human-security&page=2`
 *
 * `category` uses the canonical category slug from the API (not categoryId).
 */
export function buildBlogIndexHref(input: {
  q?: string;
  categorySlug?: string;
  page?: number;
}): string {
  const params = new URLSearchParams();

  if (input.q?.trim()) {
    params.set("q", input.q.trim());
  }

  if (input.categorySlug?.trim() && input.categorySlug !== "all") {
    params.set("category", input.categorySlug.trim());
  }

  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }

  const query = params.toString();
  return query ? `/blog?${query}` : "/blog";
}

export function resolveCategoryIdFromSlug(
  categories: readonly BlogCategory[],
  slug: string | undefined,
): string | undefined {
  if (!slug || slug === "all") {
    return undefined;
  }

  return categories.find((category) => category.slug === slug)?.categoryId;
}

export function parseBlogPageParam(value: string | null | undefined): number {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}
