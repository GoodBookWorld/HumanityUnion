import type { BlogCategory, BlogCategoryId } from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

const BY_ID = new Map<BlogCategoryId, BlogCategory>(
  BLOG_CATEGORIES.map((category) => [category.categoryId, category]),
);

const BY_SLUG = new Map<string, BlogCategory>(
  BLOG_CATEGORIES.map((category) => [category.slug, category]),
);

export function listBlogCategories(): readonly BlogCategory[] {
  return BLOG_CATEGORIES;
}

export function getBlogCategoryById(categoryId: string): BlogCategory | undefined {
  return BY_ID.get(categoryId as BlogCategoryId);
}

export function getBlogCategoryBySlug(slug: string): BlogCategory | undefined {
  return BY_SLUG.get(slug.trim().toLowerCase());
}

export function isBlogCategoryId(value: string): value is BlogCategoryId {
  return BY_ID.has(value as BlogCategoryId);
}
