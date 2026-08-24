/**
 * Pack 16F — Admin publication category management.
 */
import { randomUUID } from "node:crypto";

import type {
  AdminBlogCategoryItem,
  AdminBlogCategoryListResponse,
  BlogCategoryRecord,
  BlogCategoryStatus,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { BlogConflictError, BlogNotFoundError, BlogValidationError } from "./blog.errors.js";
import {
  ensureBlogCategoriesSeeded,
  invalidateBlogCategoryCache,
  isActiveBlogCategoryId,
  refreshBlogCategoryCache,
} from "./blog-categories.js";
import {
  countBlogPostsByCategoryId,
  deleteBlogCategoryRecord,
  findBlogCategoryRecordById,
  findBlogCategoryRecordBySlug,
  reassignBlogPostsCategory,
  upsertBlogCategoryRecord,
} from "./persistence/blog-category.repository.js";

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new AdministrationUnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  // Auth role is the admin gate (same as Admin Publishing / Platform Social Accounts).
  // Do not require the members aggregate — it is unavailable under NODE_TEST_ENV.
  return { userId: user.userId, participantId: user.memberId };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function allocateCategoryId(slug: string): string {
  const base = slug.replace(/-/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 48);
  return base || `category_${randomUUID().slice(0, 8)}`;
}

function sanitizeDescription(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new BlogValidationError("description must be a string.");
  }
  const cleaned = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  return cleaned || undefined;
}

function validateName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 2) {
    throw new BlogValidationError("name must be at least 2 characters.");
  }
  const name = value.trim().slice(0, 80);
  if (/<|>|script/i.test(name)) {
    throw new BlogValidationError("name must not contain HTML.");
  }
  return name;
}

async function toAdminItem(record: BlogCategoryRecord): Promise<AdminBlogCategoryItem> {
  const publicationCount = await countBlogPostsByCategoryId(record.categoryId);
  return { ...record, publicationCount };
}

export async function listAdminBlogCategories(input: {
  actorUserId: string;
}): Promise<AdminBlogCategoryListResponse> {
  await assertAdminActor(input.actorUserId);
  await ensureBlogCategoriesSeeded();
  const records = await refreshBlogCategoryCache();
  const categories = await Promise.all(records.map((record) => toAdminItem(record)));
  categories.sort((a, b) => a.name.localeCompare(b.name));
  return { categories, total: categories.length };
}

export async function createAdminBlogCategory(input: {
  actorUserId: string;
  body: unknown;
}): Promise<AdminBlogCategoryItem> {
  const admin = await assertAdminActor(input.actorUserId);
  await ensureBlogCategoriesSeeded();

  if (!input.body || typeof input.body !== "object") {
    throw new AdministrationValidationError("Category body is required.");
  }
  const body = input.body as Record<string, unknown>;
  const name = validateName(body.name);
  const slugInput = typeof body.slug === "string" && body.slug.trim() ? body.slug : name;
  const slug = slugify(slugInput);
  if (!slug) {
    throw new BlogValidationError("slug is required.");
  }
  const existingSlug = await findBlogCategoryRecordBySlug(slug);
  if (existingSlug) {
    throw new BlogConflictError("A category with this slug already exists.");
  }

  let categoryId =
    typeof body.categoryId === "string" && body.categoryId.trim()
      ? body.categoryId.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64)
      : allocateCategoryId(slug);
  if (!categoryId) {
    categoryId = `category_${randomUUID().slice(0, 8)}`;
  }
  if (await findBlogCategoryRecordById(categoryId)) {
    categoryId = `${allocateCategoryId(slug)}_${randomUUID().slice(0, 6)}`;
  }

  const now = new Date().toISOString();
  const description = sanitizeDescription(body.description);
  const record: BlogCategoryRecord = {
    categoryId,
    slug,
    name,
    status: "active",
    ...(description ? { description } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await upsertBlogCategoryRecord(record);
  invalidateBlogCategoryCache();
  await refreshBlogCategoryCache();

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "blog.category.create",
    targetType: "blog_category",
    targetId: categoryId,
    scope: { scopeType: "blog", scopeId: categoryId },
    afterSummary: `name=${name} slug=${slug} status=active`,
  });

  return toAdminItem(record);
}

export async function updateAdminBlogCategory(input: {
  actorUserId: string;
  categoryId: string;
  body: unknown;
}): Promise<AdminBlogCategoryItem> {
  const admin = await assertAdminActor(input.actorUserId);
  await ensureBlogCategoriesSeeded();
  const existing = await findBlogCategoryRecordById(input.categoryId);
  if (!existing) {
    throw new BlogNotFoundError("Category not found.");
  }
  if (!input.body || typeof input.body !== "object") {
    throw new AdministrationValidationError("Category body is required.");
  }
  const body = input.body as Record<string, unknown>;

  const name = "name" in body ? validateName(body.name) : existing.name;
  let slug = existing.slug;
  if ("slug" in body && typeof body.slug === "string" && body.slug.trim()) {
    slug = slugify(body.slug);
    const clash = await findBlogCategoryRecordBySlug(slug);
    if (clash && clash.categoryId !== existing.categoryId) {
      throw new BlogConflictError("A category with this slug already exists.");
    }
  }
  const description =
    "description" in body ? sanitizeDescription(body.description) : existing.description;

  const updated: BlogCategoryRecord = {
    categoryId: existing.categoryId,
    slug,
    name,
    status: existing.status,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    ...(description ? { description } : {}),
  };
  await upsertBlogCategoryRecord(updated);

  invalidateBlogCategoryCache();
  await refreshBlogCategoryCache();
  const saved = (await findBlogCategoryRecordById(existing.categoryId))!;

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "blog.category.update",
    targetType: "blog_category",
    targetId: existing.categoryId,
    scope: { scopeType: "blog", scopeId: existing.categoryId },
    beforeSummary: `name=${existing.name} slug=${existing.slug}`,
    afterSummary: `name=${saved.name} slug=${saved.slug}`,
  });

  return toAdminItem(saved);
}

async function setCategoryStatus(input: {
  actorUserId: string;
  categoryId: string;
  status: BlogCategoryStatus;
}): Promise<AdminBlogCategoryItem> {
  const admin = await assertAdminActor(input.actorUserId);
  await ensureBlogCategoriesSeeded();
  const existing = await findBlogCategoryRecordById(input.categoryId);
  if (!existing) {
    throw new BlogNotFoundError("Category not found.");
  }
  const updated: BlogCategoryRecord = {
    ...existing,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  await upsertBlogCategoryRecord(updated);
  invalidateBlogCategoryCache();
  await refreshBlogCategoryCache();

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: input.status === "active" ? "blog.category.activate" : "blog.category.deactivate",
    targetType: "blog_category",
    targetId: existing.categoryId,
    scope: { scopeType: "blog", scopeId: existing.categoryId },
    beforeSummary: `status=${existing.status}`,
    afterSummary: `status=${input.status}`,
  });

  return toAdminItem(updated);
}

export async function activateAdminBlogCategory(input: {
  actorUserId: string;
  categoryId: string;
}): Promise<AdminBlogCategoryItem> {
  return setCategoryStatus({ ...input, status: "active" });
}

export async function deactivateAdminBlogCategory(input: {
  actorUserId: string;
  categoryId: string;
}): Promise<AdminBlogCategoryItem> {
  return setCategoryStatus({ ...input, status: "inactive" });
}

export async function deleteAdminBlogCategory(input: {
  actorUserId: string;
  categoryId: string;
  reassignToCategoryId?: string;
}): Promise<{ deleted: true; reassignedCount: number }> {
  const admin = await assertAdminActor(input.actorUserId);
  await ensureBlogCategoriesSeeded();
  const existing = await findBlogCategoryRecordById(input.categoryId);
  if (!existing) {
    throw new BlogNotFoundError("Category not found.");
  }

  const publicationCount = await countBlogPostsByCategoryId(existing.categoryId);
  let reassignedCount = 0;

  if (publicationCount > 0) {
    const reassignTo = input.reassignToCategoryId?.trim();
    if (!reassignTo) {
      throw new BlogConflictError(
        `Category is referenced by ${publicationCount} publication(s). Provide reassignToCategoryId or deactivate instead of deleting.`,
      );
    }
    if (reassignTo === existing.categoryId) {
      throw new BlogValidationError("reassignToCategoryId must be a different category.");
    }
    if (!isActiveBlogCategoryId(reassignTo)) {
      throw new BlogValidationError("reassignToCategoryId must be an active category.");
    }
    reassignedCount = await reassignBlogPostsCategory({
      fromCategoryId: existing.categoryId,
      toCategoryId: reassignTo,
    });
  }

  await deleteBlogCategoryRecord(existing.categoryId);
  invalidateBlogCategoryCache();
  await refreshBlogCategoryCache();

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "blog.category.delete",
    targetType: "blog_category",
    targetId: existing.categoryId,
    scope: { scopeType: "blog", scopeId: existing.categoryId },
    beforeSummary: `name=${existing.name} publications=${publicationCount}`,
    afterSummary:
      reassignedCount > 0
        ? `deleted; reassigned=${reassignedCount} to=${input.reassignToCategoryId}`
        : "deleted",
  });

  return { deleted: true, reassignedCount };
}
