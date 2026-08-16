import type { ClientSession } from "mongodb";

import {
  BLOG_AUTHOR_APPLICATION_ACTIVE_STATUSES,
  type BlogAuthorApplication,
  type BlogCapabilityGrant,
  type BlogCategoryId,
  type BlogPost,
  type BlogPostStatus,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { BlogPersistenceError, BlogPersistenceUnavailableError } from "../blog.errors.js";
import {
  fromBlogAuthorApplicationMongoDocument,
  fromBlogCapabilityGrantMongoDocument,
  fromBlogPostMongoDocument,
  toBlogAuthorApplicationMongoDocument,
  toBlogCapabilityGrantMongoDocument,
  toBlogPostMongoDocument,
  type BlogAuthorApplicationMongoDocument,
  type BlogCapabilityGrantMongoDocument,
  type BlogPostMongoDocument,
} from "./blog.mongo-document.js";

export interface RepositorySessionOptions {
  session?: ClientSession;
}

async function ensureBlogMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new BlogPersistenceUnavailableError();
  }

  await connectMongoClient();
}

function postsCollection() {
  return getMongoCollection<BlogPostMongoDocument>(MONGO_COLLECTIONS.blogPosts);
}

function grantsCollection() {
  return getMongoCollection<BlogCapabilityGrantMongoDocument>(MONGO_COLLECTIONS.blogCapabilityGrants);
}

function applicationsCollection() {
  return getMongoCollection<BlogAuthorApplicationMongoDocument>(
    MONGO_COLLECTIONS.blogAuthorApplications,
  );
}

export async function insertBlogPost(
  post: BlogPost,
  options: RepositorySessionOptions = {},
): Promise<BlogPost> {
  await ensureBlogMongoReady();

  try {
    await postsCollection().insertOne(toBlogPostMongoDocument(post), { session: options.session });
    return post;
  } catch (error) {
    throw new BlogPersistenceError("Failed to insert Blog post.", error);
  }
}

export async function replaceBlogPost(
  post: BlogPost,
  options: RepositorySessionOptions = {},
): Promise<BlogPost> {
  await ensureBlogMongoReady();

  try {
    const result = await postsCollection().replaceOne(
      { postId: post.postId },
      toBlogPostMongoDocument(post),
      { session: options.session },
    );

    if (result.matchedCount === 0) {
      throw new BlogPersistenceError(`Blog post ${post.postId} not found for replace.`);
    }

    return post;
  } catch (error) {
    if (error instanceof BlogPersistenceError) {
      throw error;
    }
    throw new BlogPersistenceError("Failed to replace Blog post.", error);
  }
}

export async function findBlogPostById(postId: string): Promise<BlogPost | null> {
  await ensureBlogMongoReady();
  const doc = await postsCollection().findOne({ postId });
  return doc ? fromBlogPostMongoDocument(doc) : null;
}

export async function findBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  await ensureBlogMongoReady();
  const doc = await postsCollection().findOne({ slug });
  return doc ? fromBlogPostMongoDocument(doc) : null;
}

export async function blogSlugExists(slug: string, excludePostId?: string): Promise<boolean> {
  await ensureBlogMongoReady();
  const filter: Record<string, unknown> = { slug };
  if (excludePostId) {
    filter.postId = { $ne: excludePostId };
  }
  const count = await postsCollection().countDocuments(filter, { limit: 1 });
  return count > 0;
}

export async function listPublishedBlogPosts(input: {
  limit: number;
  offset: number;
  categoryId?: BlogCategoryId;
  q?: string;
}): Promise<{ items: BlogPost[]; total: number }> {
  await ensureBlogMongoReady();

  const filter: Record<string, unknown> = { status: "published" as BlogPostStatus };

  if (input.categoryId) {
    filter.categoryId = input.categoryId;
  }

  if (input.q?.trim()) {
    const q = input.q.trim();
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { excerpt: { $regex: q, $options: "i" } },
      { tags: { $elemMatch: { $regex: q, $options: "i" } } },
    ];
  }

  const [total, docs] = await Promise.all([
    postsCollection().countDocuments(filter),
    postsCollection()
      .find(filter)
      .sort({ publishedAt: -1, updatedAt: -1 })
      .skip(input.offset)
      .limit(input.limit)
      .toArray(),
  ]);

  return {
    total,
    items: docs.map(fromBlogPostMongoDocument),
  };
}

export async function listPublishedBlogPostsForSearch(): Promise<BlogPost[]> {
  await ensureBlogMongoReady();
  const docs = await postsCollection()
    .find({ status: "published" })
    .sort({ publishedAt: -1 })
    .limit(500)
    .toArray();
  return docs.map(fromBlogPostMongoDocument);
}

/** Publishing Workspace Pack 05 — Author-owned posts (optional status filter). */
export async function listBlogPostsByAuthor(input: {
  authorParticipantId: string;
  status?: BlogPostStatus;
  limit: number;
  offset: number;
}): Promise<{ items: BlogPost[]; total: number }> {
  await ensureBlogMongoReady();

  const filter: Record<string, unknown> = {
    authorParticipantId: input.authorParticipantId,
  };

  if (input.status) {
    filter.status = input.status;
  }

  const [total, docs] = await Promise.all([
    postsCollection().countDocuments(filter),
    postsCollection()
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(input.offset)
      .limit(input.limit)
      .toArray(),
  ]);

  return {
    total,
    items: docs.map(fromBlogPostMongoDocument),
  };
}

/** Editorial Review Pack 06 — cross-author queue (oldest submitted first). */
export async function listBlogPostsForEditorialQueue(input: {
  status: BlogPostStatus;
  limit: number;
  offset: number;
}): Promise<{ items: BlogPost[]; total: number }> {
  await ensureBlogMongoReady();

  const filter: Record<string, unknown> = { status: input.status };

  const [total, docs] = await Promise.all([
    postsCollection().countDocuments(filter),
    postsCollection()
      .find(filter)
      .sort({ submittedAt: 1, updatedAt: 1 })
      .skip(input.offset)
      .limit(input.limit)
      .toArray(),
  ]);

  return {
    total,
    items: docs.map(fromBlogPostMongoDocument),
  };
}

export async function upsertBlogCapabilityGrant(
  grant: BlogCapabilityGrant,
  options: RepositorySessionOptions = {},
): Promise<BlogCapabilityGrant> {
  await ensureBlogMongoReady();

  await grantsCollection().replaceOne(
    { participantId: grant.participantId },
    toBlogCapabilityGrantMongoDocument(grant),
    { upsert: true, session: options.session },
  );

  return grant;
}

export async function findBlogCapabilityGrant(
  participantId: string,
): Promise<BlogCapabilityGrant | null> {
  await ensureBlogMongoReady();
  const doc = await grantsCollection().findOne({ participantId });
  return doc ? fromBlogCapabilityGrantMongoDocument(doc) : null;
}

/**
 * Count distinct Participants who hold Author or Trusted Author capability
 * via `blog_capability_grants` (one grant document per participant).
 * Returns 0 when Mongo blog persistence is not configured.
 */
export async function countParticipantsWithBlogAuthorCapability(): Promise<number> {
  if (!isMongoConfigured()) {
    return 0;
  }

  await ensureBlogMongoReady();

  return grantsCollection().countDocuments({
    capabilities: { $in: ["author", "trusted_author"] },
  });
}

export async function insertBlogAuthorApplication(
  application: BlogAuthorApplication,
  options: RepositorySessionOptions = {},
): Promise<BlogAuthorApplication> {
  await ensureBlogMongoReady();
  await applicationsCollection().insertOne(toBlogAuthorApplicationMongoDocument(application), {
    session: options.session,
  });
  return application;
}

/** Active = submitted | under_review | changes_requested (and legacy pending). */
export async function findActiveBlogAuthorApplication(
  participantId: string,
): Promise<BlogAuthorApplication | null> {
  await ensureBlogMongoReady();
  const doc = await applicationsCollection().findOne({
    participantId,
    status: { $in: [...BLOG_AUTHOR_APPLICATION_ACTIVE_STATUSES] },
  });
  return doc ? fromBlogAuthorApplicationMongoDocument(doc) : null;
}

/** @deprecated Pack 02 name — use findActiveBlogAuthorApplication. */
export async function findPendingBlogAuthorApplication(
  participantId: string,
): Promise<BlogAuthorApplication | null> {
  return findActiveBlogAuthorApplication(participantId);
}

export async function findBlogAuthorApplicationById(
  applicationId: string,
): Promise<BlogAuthorApplication | null> {
  await ensureBlogMongoReady();
  const doc = await applicationsCollection().findOne({ applicationId });
  return doc ? fromBlogAuthorApplicationMongoDocument(doc) : null;
}

export async function findLatestBlogAuthorApplication(
  participantId: string,
): Promise<BlogAuthorApplication | null> {
  await ensureBlogMongoReady();
  const doc = await applicationsCollection().findOne(
    { participantId },
    { sort: { updatedAt: -1 } },
  );
  return doc ? fromBlogAuthorApplicationMongoDocument(doc) : null;
}

export async function replaceBlogAuthorApplication(
  application: BlogAuthorApplication,
  options: RepositorySessionOptions = {},
): Promise<BlogAuthorApplication> {
  await ensureBlogMongoReady();
  await applicationsCollection().replaceOne(
    { applicationId: application.applicationId },
    toBlogAuthorApplicationMongoDocument(application),
    { session: options.session, upsert: false },
  );
  return application;
}

export async function deleteBlogPostsByAuthorPrefixForTests(prefix: string): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await ensureBlogMongoReady();
  await postsCollection().deleteMany({
    authorParticipantId: { $regex: `^${escapeRegex(prefix)}` },
  });
  await postsCollection().deleteMany({
    title: { $regex: escapeRegex(prefix), $options: "i" },
  });
}

export async function deleteBlogCapabilityGrantsByParticipantIdsForTests(
  participantIds: readonly string[],
): Promise<void> {
  if (!isMongoConfigured() || participantIds.length === 0) {
    return;
  }

  await ensureBlogMongoReady();
  await grantsCollection().deleteMany({ participantId: { $in: [...participantIds] } });
  await applicationsCollection().deleteMany({ participantId: { $in: [...participantIds] } });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
