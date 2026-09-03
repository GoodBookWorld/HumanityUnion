/**
 * Pack 08I.7 — localized Blog category display names from blogPublic.categories catalogs.
 * Category ids/slugs stay invariant; only the displayed `name` is localized.
 */

import { BLOG_CATEGORIES } from "@hu/types";

export type BlogCategoryTranslator = {
  (key: string): string;
  has: (key: string) => boolean;
};

function resolveCategoryId(categoryIdOrSlug: string): string | null {
  const trimmed = categoryIdOrSlug.trim();
  if (!trimmed) {
    return null;
  }
  const match = BLOG_CATEGORIES.find(
    (category) => category.categoryId === trimmed || category.slug === trimmed,
  );
  return match?.categoryId ?? null;
}

/**
 * Resolve a localized display name for a Blog category id or slug.
 * Falls back to the seed English name, then the raw id/slug.
 */
export function resolveBlogCategoryDisplayName(
  categoryIdOrSlug: string,
  t: BlogCategoryTranslator,
): string {
  const categoryId = resolveCategoryId(categoryIdOrSlug);
  if (!categoryId) {
    return categoryIdOrSlug;
  }

  const key = `categories.${categoryId}.name`;
  if (t.has(key)) {
    return t(key);
  }

  return BLOG_CATEGORIES.find((category) => category.categoryId === categoryId)?.name ?? categoryId;
}
