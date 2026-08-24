/**
 * Pack 16F — Mongo persistence for managed Blog publication categories.
 */
import type { BlogCategoryRecord, BlogCategoryStatus } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { BlogPersistenceError, BlogPersistenceUnavailableError } from "../blog.errors.js";

export interface BlogCategoryMongoDocument {
  categoryId: string;
  slug: string;
  name: string;
  status: BlogCategoryStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new BlogPersistenceUnavailableError();
  }
  await connectMongoClient();
}

function categoriesCollection() {
  return getMongoCollection<BlogCategoryMongoDocument>(MONGO_COLLECTIONS.blogCategories);
}

export function toBlogCategoryRecord(doc: BlogCategoryMongoDocument): BlogCategoryRecord {
  return {
    categoryId: doc.categoryId,
    slug: doc.slug,
    name: doc.name,
    status: doc.status === "inactive" ? "inactive" : "active",
    ...(doc.description ? { description: doc.description } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listBlogCategoryRecords(): Promise<readonly BlogCategoryRecord[]> {
  await ensureReady();
  try {
    const docs = await categoriesCollection().find({}).sort({ name: 1 }).toArray();
    return docs.map(toBlogCategoryRecord);
  } catch (error) {
    throw new BlogPersistenceError("Failed to list Blog categories.", error);
  }
}

export async function findBlogCategoryRecordById(
  categoryId: string,
): Promise<BlogCategoryRecord | null> {
  await ensureReady();
  try {
    const doc = await categoriesCollection().findOne({ categoryId });
    return doc ? toBlogCategoryRecord(doc) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Blog category.", error);
  }
}

export async function findBlogCategoryRecordBySlug(
  slug: string,
): Promise<BlogCategoryRecord | null> {
  await ensureReady();
  try {
    const doc = await categoriesCollection().findOne({ slug: slug.trim().toLowerCase() });
    return doc ? toBlogCategoryRecord(doc) : null;
  } catch (error) {
    throw new BlogPersistenceError("Failed to load Blog category by slug.", error);
  }
}

export async function upsertBlogCategoryRecord(
  record: BlogCategoryRecord,
): Promise<BlogCategoryRecord> {
  await ensureReady();
  const doc: BlogCategoryMongoDocument = {
    categoryId: record.categoryId,
    slug: record.slug,
    name: record.name,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.description ? { description: record.description } : {}),
  };
  try {
    await categoriesCollection().replaceOne({ categoryId: record.categoryId }, doc, {
      upsert: true,
    });
    return record;
  } catch (error) {
    throw new BlogPersistenceError("Failed to upsert Blog category.", error);
  }
}

export async function deleteBlogCategoryRecord(categoryId: string): Promise<boolean> {
  await ensureReady();
  try {
    const result = await categoriesCollection().deleteOne({ categoryId });
    return result.deletedCount === 1;
  } catch (error) {
    throw new BlogPersistenceError("Failed to delete Blog category.", error);
  }
}

export async function countBlogPostsByCategoryId(categoryId: string): Promise<number> {
  await ensureReady();
  try {
    return await getMongoCollection(MONGO_COLLECTIONS.blogPosts).countDocuments({ categoryId });
  } catch (error) {
    throw new BlogPersistenceError("Failed to count Blog posts by category.", error);
  }
}

export async function reassignBlogPostsCategory(input: {
  fromCategoryId: string;
  toCategoryId: string;
}): Promise<number> {
  await ensureReady();
  try {
    const result = await getMongoCollection(MONGO_COLLECTIONS.blogPosts).updateMany(
      { categoryId: input.fromCategoryId },
      { $set: { categoryId: input.toCategoryId, updatedAt: new Date().toISOString() } },
    );
    return result.modifiedCount;
  } catch (error) {
    throw new BlogPersistenceError("Failed to reassign Blog post categories.", error);
  }
}

export async function deleteBlogCategoryRecordsByIdPrefixForTests(
  prefix: string,
): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }
  await connectMongoClient();
  const result = await categoriesCollection().deleteMany({
    categoryId: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
  });
  return result.deletedCount;
}
