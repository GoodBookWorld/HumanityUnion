/**
 * Pack 16F — Blog category catalog (seed + Mongo-backed cache).
 *
 * Public surfaces list active categories. Historical posts may still resolve
 * inactive categories by id/slug so relationships are never orphaned.
 */
import type { BlogCategory, BlogCategoryId, BlogCategoryRecord } from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import {
  findBlogCategoryRecordById,
  findBlogCategoryRecordBySlug,
  listBlogCategoryRecords,
  upsertBlogCategoryRecord,
} from "./persistence/blog-category.repository.js";

let recordsCache: BlogCategoryRecord[] | null = null;
let seedPromise: Promise<void> | null = null;

function seedTimestamp(): string {
  return "2022-01-01T00:00:00.000Z";
}

function seedRecords(): BlogCategoryRecord[] {
  const at = seedTimestamp();
  return BLOG_CATEGORIES.map((category) => ({
    categoryId: category.categoryId,
    slug: category.slug,
    name: category.name,
    status: "active" as const,
    createdAt: at,
    updatedAt: at,
  }));
}

function toPublicCategory(record: BlogCategoryRecord): BlogCategory {
  return {
    categoryId: record.categoryId,
    slug: record.slug,
    name: record.name,
  };
}

export function invalidateBlogCategoryCache(): void {
  recordsCache = null;
}

export async function ensureBlogCategoriesSeeded(): Promise<void> {
  if (recordsCache && recordsCache.length > 0) {
    return;
  }
  if (!seedPromise) {
    seedPromise = (async () => {
      if (!isMongoConfigured()) {
        recordsCache = seedRecords();
        return;
      }
      try {
        for (const seed of seedRecords()) {
          const existing = await findBlogCategoryRecordById(seed.categoryId);
          if (!existing) {
            await upsertBlogCategoryRecord(seed);
          }
        }
        recordsCache = [...(await listBlogCategoryRecords())];
      } catch {
        recordsCache = seedRecords();
      }
    })().finally(() => {
      seedPromise = null;
    });
  }
  await seedPromise;
}

export async function refreshBlogCategoryCache(): Promise<readonly BlogCategoryRecord[]> {
  invalidateBlogCategoryCache();
  if (!isMongoConfigured()) {
    recordsCache = seedRecords();
    return recordsCache;
  }
  try {
    await ensureBlogCategoriesSeeded();
    recordsCache = [...(await listBlogCategoryRecords())];
  } catch {
    recordsCache = seedRecords();
  }
  return recordsCache;
}

function cachedRecords(): readonly BlogCategoryRecord[] {
  return recordsCache ?? seedRecords();
}

/** Active categories for selectors, public dropdown, and chart axes. */
export function listBlogCategories(): readonly BlogCategory[] {
  return cachedRecords()
    .filter((record) => record.status === "active")
    .map(toPublicCategory);
}

/** All records including inactive (Admin + historical resolution). */
export function listBlogCategoryRecordsCached(): readonly BlogCategoryRecord[] {
  return cachedRecords();
}

export function getBlogCategoryById(categoryId: string): BlogCategory | undefined {
  const record = cachedRecords().find((entry) => entry.categoryId === categoryId);
  return record ? toPublicCategory(record) : undefined;
}

export function getBlogCategoryRecordById(categoryId: string): BlogCategoryRecord | undefined {
  return cachedRecords().find((entry) => entry.categoryId === categoryId);
}

export function getBlogCategoryBySlug(slug: string): BlogCategory | undefined {
  const normalized = slug.trim().toLowerCase();
  const record = cachedRecords().find((entry) => entry.slug === normalized);
  return record ? toPublicCategory(record) : undefined;
}

export function isBlogCategoryId(value: string): value is BlogCategoryId {
  return cachedRecords().some((entry) => entry.categoryId === value);
}

export function isActiveBlogCategoryId(value: string): boolean {
  return cachedRecords().some(
    (entry) => entry.categoryId === value && entry.status === "active",
  );
}

/** Async lookup that refreshes from Mongo when needed (public API bootstrap). */
export async function listPublicBlogCategoriesResolved(): Promise<readonly BlogCategory[]> {
  await ensureBlogCategoriesSeeded();
  return listBlogCategories();
}

export async function resolveBlogCategoryBySlugAsync(
  slug: string,
): Promise<BlogCategory | undefined> {
  await ensureBlogCategoriesSeeded();
  const cached = getBlogCategoryBySlug(slug);
  if (cached) {
    return cached;
  }
  if (!isMongoConfigured()) {
    return undefined;
  }
  try {
    const record = await findBlogCategoryRecordBySlug(slug);
    return record ? toPublicCategory(record) : undefined;
  } catch {
    return undefined;
  }
}
