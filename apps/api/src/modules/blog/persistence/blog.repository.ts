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

  const filter: Record<string, unknown> = {
    status: "published" as BlogPostStatus,
    administrativelyBlocked: { $ne: true },
    publishedAt: { $lte: new Date().toISOString() },
  };

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
  const now = new Date().toISOString();
  const docs = await postsCollection()
    .find({
      status: "published",
      administrativelyBlocked: { $ne: true },
      publishedAt: { $lte: now },
    })
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
  sortByPublicationDate?: boolean;
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
    input.sortByPublicationDate
      ? postsCollection()
          .find(filter)
          .sort({ publishedAt: -1, updatedAt: -1 })
          .skip(input.offset)
          .limit(input.limit)
          .toArray()
      : postsCollection()
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

/** Pack 13B — list Author/Trusted Author capability grants (accepted Author authority). */
export async function listBlogAuthorCapabilityGrants(input: {
  status?: "active" | "blocked" | "all";
}): Promise<{ items: BlogCapabilityGrant[]; activeCount: number; blockedCount: number }> {
  await ensureBlogMongoReady();

  const authorMatch: Record<string, unknown> = {
    capabilities: { $in: ["author", "trusted_author"] },
  };

  const status = input.status ?? "all";
  if (status === "blocked") {
    authorMatch.administrativelyBlocked = true;
  } else if (status === "active") {
    authorMatch.administrativelyBlocked = { $ne: true };
  }

  const [activeCount, blockedCount, docs] = await Promise.all([
    grantsCollection().countDocuments({
      capabilities: { $in: ["author", "trusted_author"] },
      administrativelyBlocked: { $ne: true },
    }),
    grantsCollection().countDocuments({
      capabilities: { $in: ["author", "trusted_author"] },
      administrativelyBlocked: true,
    }),
    grantsCollection().find(authorMatch).sort({ updatedAt: -1 }).toArray(),
  ]);

  return {
    items: docs.map(fromBlogCapabilityGrantMongoDocument),
    activeCount,
    blockedCount,
  };
}

export async function countBlogPostsByAuthorParticipantId(
  authorParticipantId: string,
): Promise<number> {
  await ensureBlogMongoReady();
  return postsCollection().countDocuments({ authorParticipantId });
}

export async function findLatestPublishedAtForAuthor(
  authorParticipantId: string,
): Promise<string | undefined> {
  await ensureBlogMongoReady();
  const doc = await postsCollection().findOne(
    { authorParticipantId, status: "published" },
    { sort: { publishedAt: -1 }, projection: { publishedAt: 1 } },
  );
  return typeof doc?.publishedAt === "string" ? doc.publishedAt : undefined;
}

export async function findApprovedAuthorApplicationAcceptedAt(
  participantId: string,
): Promise<string | undefined> {
  await ensureBlogMongoReady();
  const doc = await applicationsCollection().findOne(
    { participantId, status: "approved" },
    { sort: { decidedAt: -1, updatedAt: -1 } },
  );
  if (!doc) {
    return undefined;
  }
  return doc.decidedAt ?? doc.updatedAt ?? doc.createdAt;
}

/** Pack 13B — Admin Publications directory (includes blocked; status ≠ block). */
export async function listAdminBlogPublications(input: {
  statusFilter?:
    | "all"
    | "draft"
    | "scheduled"
    | "published"
    | "blocked"
    | "submitted_for_review"
    | "archived";
  q?: string;
  limit: number;
  offset: number;
}): Promise<{ items: BlogPost[]; total: number }> {
  await ensureBlogMongoReady();

  const filter: Record<string, unknown> = {};
  const statusFilter = input.statusFilter ?? "all";

  if (statusFilter === "blocked") {
    filter.administrativelyBlocked = true;
  } else if (statusFilter === "scheduled") {
    filter.status = "scheduled";
    filter.administrativelyBlocked = { $ne: true };
  } else if (statusFilter !== "all") {
    filter.status = statusFilter;
    filter.administrativelyBlocked = { $ne: true };
  }

  if (input.q?.trim()) {
    const q = escapeRegex(input.q.trim());
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { authorDisplayNameSnapshot: { $regex: q, $options: "i" } },
      { categoryId: { $regex: q, $options: "i" } },
      { tags: { $elemMatch: { $regex: q, $options: "i" } } },
    ];
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

export async function deleteBlogPostsByIdsForTests(postIds: readonly string[]): Promise<void> {
  if (!isMongoConfigured() || postIds.length === 0) {
    return;
  }
  await ensureBlogMongoReady();
  await postsCollection().deleteMany({ postId: { $in: [...postIds] } });
}

/** Pack 13C — due scheduled posts awaiting auto-release. */
export async function listDueScheduledBlogPosts(input: {
  nowIso: string;
  limit?: number;
}): Promise<BlogPost[]> {
  await ensureBlogMongoReady();
  const docs = await postsCollection()
    .find({
      status: "scheduled",
      publishedAt: { $lte: input.nowIso },
      administrativelyBlocked: { $ne: true },
    })
    .sort({ publishedAt: 1 })
    .limit(input.limit ?? 100)
    .toArray();
  return docs.map(fromBlogPostMongoDocument);
}

/** Pack 13D — latest visible public post per author (blocked/scheduled excluded). */
export async function listLatestPublicBlogPostsByAuthor(input?: {
  limitAuthors?: number;
}): Promise<
  Array<{
    authorParticipantId: string;
    authorDisplayNameSnapshot: string;
    postId: string;
    slug: string;
    title: string;
    publishedAt: string;
  }>
> {
  await ensureBlogMongoReady();
  const now = new Date().toISOString();
  const limitAuthors = Math.min(Math.max(input?.limitAuthors ?? 40, 1), 100);

  const rows = await postsCollection()
    .aggregate<{
      _id: string;
      authorDisplayNameSnapshot: string;
      postId: string;
      slug: string;
      title: string;
      publishedAt: string;
    }>([
      {
        $match: {
          status: "published" as BlogPostStatus,
          administrativelyBlocked: { $ne: true },
          publishedAt: { $lte: now, $type: "string" },
        },
      },
      { $sort: { publishedAt: -1 } },
      {
        $group: {
          _id: "$authorParticipantId",
          authorDisplayNameSnapshot: { $first: "$authorDisplayNameSnapshot" },
          postId: { $first: "$postId" },
          slug: { $first: "$slug" },
          title: { $first: "$title" },
          publishedAt: { $first: "$publishedAt" },
        },
      },
      { $sort: { publishedAt: -1 } },
      { $limit: limitAuthors },
    ])
    .toArray();

  return rows.map((row) => ({
    authorParticipantId: row._id,
    authorDisplayNameSnapshot: row.authorDisplayNameSnapshot,
    postId: row.postId,
    slug: row.slug,
    title: row.title,
    publishedAt: row.publishedAt,
  }));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
