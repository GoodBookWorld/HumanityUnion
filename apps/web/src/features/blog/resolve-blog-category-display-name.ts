/**
 * Pack 08I.7 — localized Blog category display names from blogPublic.categories catalogs.
 * Category ids/slugs stay invariant; only the displayed `name` is localized.
 *
 * Priority: WEB_UI catalog → API/category human-readable name → humanized token
 * (never prefer a raw underscore slug when a safer label exists).
 */

import { BLOG_CATEGORIES } from "@hu/types";

export type BlogCategoryTranslator = {
  (key: string): string;
  has: (key: string) => boolean;
};

function catalogIdCandidates(categoryIdOrSlug: string): string[] {
  const trimmed = categoryIdOrSlug.trim();
  if (!trimmed) {
    return [];
  }
  const underscored = trimmed.replace(/-/g, "_");
  const fromSeed = BLOG_CATEGORIES.find(
    (category) =>
      category.categoryId === trimmed ||
      category.slug === trimmed ||
      category.categoryId === underscored ||
      category.slug === underscored,
  )?.categoryId;

  const candidates = [trimmed, underscored];
  if (fromSeed) {
    candidates.push(fromSeed);
  }
  return [...new Set(candidates)];
}

/**
 * Absolute technical fallback: title-case words from underscores/hyphens.
 * Avoids exposing raw underscore/hyphen slugs in participant UI.
 */
export function humanizeBlogCategoryToken(categoryIdOrSlug: string): string {
  const trimmed = categoryIdOrSlug.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Resolve a localized display name for a Blog category id or slug.
 */
export function resolveBlogCategoryDisplayName(
  categoryIdOrSlug: string,
  t: BlogCategoryTranslator,
  apiName?: string | null,
): string {
  for (const categoryId of catalogIdCandidates(categoryIdOrSlug)) {
    const key = `categories.${categoryId}.name`;
    if (t.has(key)) {
      return t(key);
    }
  }

  const readableApiName = typeof apiName === "string" ? apiName.trim() : "";
  if (readableApiName.length > 0) {
    return readableApiName;
  }

  for (const categoryId of catalogIdCandidates(categoryIdOrSlug)) {
    const seedName = BLOG_CATEGORIES.find(
      (category) => category.categoryId === categoryId,
    )?.name;
    if (seedName) {
      return seedName;
    }
  }

  return humanizeBlogCategoryToken(categoryIdOrSlug);
}
